import cron from 'node-cron';
import db from '../db.js';
import fetch from 'node-fetch';

/**
 * Office Temperature Scheduler - Smart Climate Control
 *
 * Automatically maintains office temperature at target (73°F) by adjusting
 * the Nest thermostat based on real-time sensor readings and historical trends.
 *
 * Features:
 * - Temperature checks every 2 minutes
 * - Intelligent adjustment with hysteresis (prevents HVAC cycling)
 * - 15-minute cooldown between thermostat changes
 * - Hourly trend analysis to optimize responsiveness
 * - Complete audit trail in database
 *
 * Schedule:
 * - Every 2 minutes: Check temperature and adjust if needed
 * - Every hour: Analyze temperature trends
 */
class TemperatureScheduler {
  constructor() {
    this.enabled = false;
    this.TARGET_TEMP = 73;           // Target office temperature (°F)
    this.TEMP_THRESHOLD = 0.5;       // Act when ±0.5°F from target
    this.ADJUSTMENT_STEP = 1;        // Adjust by 1°F at a time
    this.MIN_ADJUSTMENT_INTERVAL = 15 * 60 * 1000; // 15 minutes between adjustments
    this.lastAdjustmentTime = 0;
    this.lastMonitoringLog = 0;
    this.lastHvacAction = null;      // Track AC on/off state
    this.cronJobs = [];
    this.currentJobId = null;

    // Home Assistant connection
    this.HA_URL = process.env.HA_URL || 'http://192.168.1.222:8123';
    this.HA_TOKEN = process.env.HA_TOKEN || '';

    // Entity IDs
    this.OFFICE_SENSOR = 'sensor.walkway_temperature';  // Office temperature sensor
    this.THERMOSTAT = 'climate.walkway';                // Nest thermostat

    // Safety limits
    this.MIN_SETPOINT = 68;
    this.MAX_SETPOINT = 78;

    // Temperature sampling for rate tracking
    this.MAX_SAMPLES = 720;          // 24 hours at 2-minute intervals
    this.temperatureSamples = [];    // Circular buffer of {timestamp, temp, setpoint, hvacMode}
  }

  /**
   * Start the temperature automation scheduler
   */
  async start() {
    if (this.enabled) {
      console.log('[TempScheduler] Already running');
      return;
    }

    this.enabled = true;
    console.log('[TempScheduler] 🌡️  Starting smart office temperature automation...');
    console.log(`[TempScheduler] Target: ${this.TARGET_TEMP}°F | Threshold: ±${this.TEMP_THRESHOLD}°F`);
    console.log(`[TempScheduler] Office Sensor: ${this.OFFICE_SENSOR}`);
    console.log(`[TempScheduler] Thermostat: ${this.THERMOSTAT}`);

    // Every 2 minutes - Check and adjust temperature
    const tempCheckJob = cron.schedule('*/2 * * * *', async () => {
      console.log('[TempScheduler] Running 2-minute temperature check');
      await this.checkAndAdjustTemperature();
    }, {
      timezone: 'America/New_York'
    });
    this.cronJobs.push(tempCheckJob);

    // Every hour - Analyze temperature trends
    const trendAnalysisJob = cron.schedule('0 * * * *', async () => {
      console.log('[TempScheduler] Running hourly trend analysis');
      await this.analyzeTrends();
    }, {
      timezone: 'America/New_York'
    });
    this.cronJobs.push(trendAnalysisJob);

    // Initial check on startup
    console.log('[TempScheduler] Running initial temperature check...');
    await this.checkAndAdjustTemperature();

    console.log('[TempScheduler] ✓ Started successfully');
    console.log('[TempScheduler] 📅 Cron jobs:');
    console.log('[TempScheduler]    - Every 5 minutes: Temperature check & adjustment');
    console.log('[TempScheduler]    - Every hour: Trend analysis');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.enabled) return;

    console.log('[TempScheduler] Stopping temperature automation...');
    this.cronJobs.forEach(job => job.stop());
    this.cronJobs = [];
    this.enabled = false;
    console.log('[TempScheduler] ✓ Stopped');
  }

  /**
   * Main temperature control logic
   * Checks current office temperature and adjusts thermostat if needed
   */
  async checkAndAdjustTemperature() {
    const now = Date.now();

    try {
      // Get current office temperature
      const officeTemp = await this.getOfficeTemperature();

      // Get current thermostat state
      const climateState = await this.getClimateState();
      const currentSetpoint = climateState.attributes.temperature;
      const currentTemp = climateState.attributes.current_temperature;
      const hvacMode = climateState.attributes.hvac_mode;
      const hvacAction = climateState.attributes.hvac_action || 'idle';

      // Track HVAC action state changes (AC on/off) - do this EVERY check
      if (this.lastHvacAction !== null && this.lastHvacAction !== hvacAction) {
        await this.logHvacEvent(hvacAction, officeTemp, currentSetpoint);
      }
      this.lastHvacAction = hvacAction;

      // Prevent too-frequent adjustments (HVAC needs time to stabilize)
      if (now - this.lastAdjustmentTime < this.MIN_ADJUSTMENT_INTERVAL) {
        const waitMinutes = Math.round((this.MIN_ADJUSTMENT_INTERVAL - (now - this.lastAdjustmentTime)) / 60000);
        console.log(`[TempScheduler] ⏸️  Too soon since last adjustment (wait ${waitMinutes}min), skipping`);
        return;
      }

      // Record temperature sample for rate tracking
      this.recordTemperatureSample(officeTemp, currentSetpoint, hvacMode);

      // Calculate temperature change rates
      const rate15min = this.calculateTemperatureRate(15);
      const rate30min = this.calculateTemperatureRate(30);

      // Calculate temperature delta (how far from target)
      const delta = this.TARGET_TEMP - officeTemp;

      console.log(`[TempScheduler] 📊 Current Status:`);
      console.log(`[TempScheduler]    Office: ${officeTemp}°F | Target: ${this.TARGET_TEMP}°F | Delta: ${delta.toFixed(1)}°F`);
      console.log(`[TempScheduler]    Thermostat: ${currentSetpoint}°F | HVAC Mode: ${hvacMode}`);
      console.log(`[TempScheduler]    Rate (15min): ${rate15min.rate}°F/min (${rate15min.confidence}, ${rate15min.sampleSize} samples)`);
      console.log(`[TempScheduler]    Rate (30min): ${rate30min.rate}°F/min (${rate30min.confidence}, ${rate30min.sampleSize} samples)`);

      // Only adjust if outside acceptable threshold
      if (Math.abs(delta) < this.TEMP_THRESHOLD) {
        console.log('[TempScheduler] ✓ Temperature within acceptable range');

        // Log monitoring data (every 10 minutes to avoid too much data)
        if (!this.lastMonitoringLog || now - this.lastMonitoringLog >= 10 * 60 * 1000) {
          await this.logMonitoring(officeTemp, currentSetpoint, delta, rate15min, rate30min);
          this.lastMonitoringLog = now;
        }

        return;
      }

      // Calculate new setpoint (conservative adjustment)
      let newSetpoint = currentSetpoint;
      let action = '';

      if (delta > 0) {
        // Office is too cold, increase setpoint
        newSetpoint = Math.min(currentSetpoint + this.ADJUSTMENT_STEP, this.MAX_SETPOINT);
        action = 'increase';
        console.log(`[TempScheduler] ❄️  Office too cold, increasing setpoint ${currentSetpoint}°F → ${newSetpoint}°F`);
      } else {
        // Office is too hot, decrease setpoint
        // Never set AC below target temperature to prevent overcooling
        newSetpoint = Math.max(currentSetpoint - this.ADJUSTMENT_STEP, this.TARGET_TEMP);
        action = 'decrease';
        console.log(`[TempScheduler] 🔥 Office too warm, decreasing setpoint ${currentSetpoint}°F → ${newSetpoint}°F`);
      }

      // Don't adjust if we're already at the limit
      if (newSetpoint === currentSetpoint) {
        console.log(`[TempScheduler] ⚠️  Already at ${action === 'increase' ? 'maximum' : 'minimum'} setpoint (${currentSetpoint}°F), cannot adjust further`);
        return;
      }

      // Apply adjustment to thermostat
      await this.setThermostatTemperature(newSetpoint);
      this.lastAdjustmentTime = now;

      // Track in database for audit trail
      await this.logAdjustment(officeTemp, currentSetpoint, newSetpoint, delta, action, rate15min, rate30min);

      console.log('[TempScheduler] ✓ Adjustment applied successfully');

    } catch (error) {
      console.error('[TempScheduler] ❌ Error checking/adjusting temperature:', error);
    }
  }

  /**
   * Get current temperature from office sensor
   * @returns {Promise<number>} Temperature in Fahrenheit
   */
  async getOfficeTemperature() {
    try {
      const response = await fetch(`${this.HA_URL}/api/states/${this.OFFICE_SENSOR}`, {
        headers: {
          'Authorization': `Bearer ${this.HA_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const temp = parseFloat(data.state);

      // Validate temperature is reasonable
      if (isNaN(temp) || temp < 40 || temp > 100) {
        console.warn('[TempScheduler] ⚠️  Invalid office temperature reading, using fallback');
        return this.TARGET_TEMP;
      }

      return temp;

    } catch (error) {
      console.error('[TempScheduler] ⚠️  Error fetching office temperature:', error.message);
      return this.TARGET_TEMP; // Fallback to target temp
    }
  }

  /**
   * Get current thermostat state from Home Assistant
   * @returns {Promise<Object>} Climate entity state with attributes
   */
  async getClimateState() {
    try {
      const response = await fetch(`${this.HA_URL}/api/states/${this.THERMOSTAT}`, {
        headers: {
          'Authorization': `Bearer ${this.HA_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('[TempScheduler] ⚠️  Error fetching climate state:', error.message);
      throw error;
    }
  }

  /**
   * Set thermostat to new target temperature
   * @param {number} temp - Target temperature in Fahrenheit
   */
  async setThermostatTemperature(temp) {
    try {
      const response = await fetch(`${this.HA_URL}/api/services/climate/set_temperature`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.HA_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          entity_id: this.THERMOSTAT,
          temperature: temp
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      console.log(`[TempScheduler] 🌡️  Thermostat set to ${temp}°F`);

    } catch (error) {
      console.error(`[TempScheduler] ❌ Error setting thermostat:`, error.message);
      throw error;
    }
  }

  /**
   * Get historical temperature data from Home Assistant
   * @param {number} hours - Number of hours of history to fetch
   * @returns {Promise<Array>} Array of temperature readings with timestamps
   */
  async getTemperatureHistory(hours = 6) {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

      const url = `${this.HA_URL}/api/history/period/${startTime.toISOString()}` +
                  `?filter_entity_id=${this.OFFICE_SENSOR}` +
                  `&end_time=${endTime.toISOString()}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.HA_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const history = await response.json();
      return history[0] || []; // Returns first entity's history

    } catch (error) {
      console.error('[TempScheduler] ⚠️  Error fetching temperature history:', error.message);
      return [];
    }
  }

  /**
   * Analyze temperature trends over the past 6 hours
   * Used to optimize adjustment strategy
   */
  async analyzeTrends() {
    try {
      const history = await this.getTemperatureHistory(6);

      if (history.length < 3) {
        console.log('[TempScheduler] 📊 Insufficient data for trend analysis');
        return;
      }

      // Extract temperature values
      const temps = history
        .map(h => parseFloat(h.state))
        .filter(t => !isNaN(t));

      // Calculate statistics
      const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
      const minTemp = Math.min(...temps);
      const maxTemp = Math.max(...temps);
      const variance = maxTemp - minTemp;

      // Calculate trend direction (simple comparison of halves)
      const trend = this.calculateTrend(temps);

      console.log(`[TempScheduler] 📊 Trend Analysis (last 6 hours):`);
      console.log(`[TempScheduler]    Avg: ${avgTemp.toFixed(1)}°F | Min: ${minTemp}°F | Max: ${maxTemp}°F`);
      console.log(`[TempScheduler]    Variance: ${variance.toFixed(1)}°F | Trend: ${trend}`);

      // Adjust strategy based on variance
      // High variance = unstable temperature, be more responsive
      if (variance > 4) {
        console.log('[TempScheduler] ⚡ High temperature variance detected, increasing responsiveness');
        this.ADJUSTMENT_STEP = 2;
      } else {
        console.log('[TempScheduler] 🎯 Temperature stable, using standard adjustment');
        this.ADJUSTMENT_STEP = 1;
      }

    } catch (error) {
      console.error('[TempScheduler] ❌ Error analyzing trends:', error);
    }
  }

  /**
   * Calculate temperature trend direction
   * @param {Array<number>} temps - Array of temperature readings
   * @returns {string} 'rising', 'falling', or 'stable'
   */
  calculateTrend(temps) {
    if (temps.length < 3) return 'stable';

    // Compare first half to second half average
    const mid = Math.floor(temps.length / 2);
    const firstHalf = temps.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const secondHalf = temps.slice(mid).reduce((a, b) => a + b, 0) / (temps.length - mid);

    const diff = secondHalf - firstHalf;

    if (diff > 0.5) return 'rising';
    if (diff < -0.5) return 'falling';
    return 'stable';
  }

  /**
   * Log temperature adjustment to database
   * @param {number} officeTemp - Current office temperature
   * @param {number} oldSetpoint - Previous thermostat setpoint
   * @param {number} newSetpoint - New thermostat setpoint
   * @param {number} delta - Temperature delta from target
   * @param {string} action - 'increase' or 'decrease'
   * @param {Object} rate15min - Temperature change rate over 15 minutes
   * @param {Object} rate30min - Temperature change rate over 30 minutes
   */
  async logAdjustment(officeTemp, oldSetpoint, newSetpoint, delta, action, rate15min, rate30min) {
    try {
      const conditions = {
        officeTemp: officeTemp.toFixed(1),
        targetTemp: this.TARGET_TEMP,
        delta: delta.toFixed(2),
        oldSetpoint,
        newSetpoint,
        action,
        tempChangeRate15min: rate15min.rate,
        sampleSize15min: rate15min.sampleSize,
        confidence15min: rate15min.confidence,
        tempChangeRate30min: rate30min.rate,
        sampleSize30min: rate30min.sampleSize,
        confidence30min: rate30min.confidence,
        timestamp: new Date().toISOString()
      };

      const stmt = db.prepare(`
        INSERT INTO jobs (device, session, start_time, end_time, duration, conditions)
        VALUES (?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'), 0, ?)
      `);

      stmt.run(
        'Office Temperature',
        'Auto Climate Control',
        JSON.stringify(conditions)
      );

      console.log('[TempScheduler] 📝 Adjustment logged to database');

    } catch (error) {
      console.error('[TempScheduler] ⚠️  Error logging adjustment:', error);
    }
  }

  /**
   * Log temperature monitoring to database (when no adjustment is needed)
   * @param {number} officeTemp - Current office temperature
   * @param {number} currentSetpoint - Current thermostat setpoint
   * @param {number} delta - Temperature delta from target
   * @param {Object} rate15min - Temperature change rate over 15 minutes
   * @param {Object} rate30min - Temperature change rate over 30 minutes
   */
  async logMonitoring(officeTemp, currentSetpoint, delta, rate15min, rate30min) {
    try {
      const conditions = {
        officeTemp: officeTemp.toFixed(1),
        targetTemp: this.TARGET_TEMP,
        delta: delta.toFixed(2),
        setpoint: currentSetpoint,
        tempChangeRate15min: rate15min.rate,
        sampleSize15min: rate15min.sampleSize,
        confidence15min: rate15min.confidence,
        tempChangeRate30min: rate30min.rate,
        sampleSize30min: rate30min.sampleSize,
        confidence30min: rate30min.confidence,
        timestamp: new Date().toISOString()
      };

      const stmt = db.prepare(`
        INSERT INTO jobs (device, session, start_time, end_time, duration, conditions)
        VALUES (?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'), 0, ?)
      `);

      stmt.run(
        'Office Temperature',
        'Temperature Monitoring',
        JSON.stringify(conditions)
      );

      console.log('[TempScheduler] 📝 Monitoring data logged to database');

    } catch (error) {
      console.error('[TempScheduler] ⚠️  Error logging monitoring data:', error);
    }
  }

  /**
   * Log HVAC action state changes (AC/Heat on/off)
   * @param {string} hvacAction - Current HVAC action (cooling, heating, idle, off)
   * @param {number} officeTemp - Current office temperature
   * @param {number} currentSetpoint - Current thermostat setpoint
   */
  async logHvacEvent(hvacAction, officeTemp, currentSetpoint) {
    try {
      const conditions = {
        hvacAction,
        officeTemp: officeTemp.toFixed(1),
        setpoint: currentSetpoint,
        targetTemp: this.TARGET_TEMP,
        action: hvacAction === 'cooling' ? 'ac_on' :
                hvacAction === 'heating' ? 'heat_on' :
                hvacAction === 'idle' ? 'hvac_idle' : 'hvac_off',
        timestamp: new Date().toISOString()
      };

      const stmt = db.prepare(`
        INSERT INTO jobs (device, session, start_time, end_time, duration, conditions)
        VALUES (?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'), 0, ?)
      `);

      stmt.run(
        'Office Temperature',
        'HVAC Event',
        JSON.stringify(conditions)
      );

      const eventLabel = hvacAction === 'cooling' ? 'AC turned ON' :
                        hvacAction === 'heating' ? 'Heat turned ON' :
                        'HVAC turned OFF/IDLE';

      console.log(`[TempScheduler] ${eventLabel} (Office: ${officeTemp.toFixed(1)}°F, Setpoint: ${currentSetpoint}°F)`);

    } catch (error) {
      console.error('[TempScheduler] ⚠️  Error logging HVAC event:', error);
    }
  }

  /**
   * Change the target temperature
   * @param {number} temp - New target temperature (65-80°F)
   */
  setTargetTemperature(temp) {
    if (temp < 65 || temp > 80) {
      throw new Error('Target temperature must be between 65-80°F');
    }

    console.log(`[TempScheduler] 🎯 Target temperature changed: ${this.TARGET_TEMP}°F → ${temp}°F`);
    this.TARGET_TEMP = temp;

    // Reset adjustment timer to allow immediate re-evaluation
    this.lastAdjustmentTime = 0;
  }

  /**
   * Record a temperature sample for rate tracking
   * @param {number} temp - Current temperature
   * @param {number} setpoint - Current thermostat setpoint
   * @param {string} hvacMode - Current HVAC mode (heat/cool/off)
   */
  recordTemperatureSample(temp, setpoint, hvacMode) {
    const sample = {
      timestamp: Date.now(),
      temp,
      setpoint,
      hvacMode
    };

    this.temperatureSamples.push(sample);

    // Maintain circular buffer (remove old samples if exceeds max)
    if (this.temperatureSamples.length > this.MAX_SAMPLES) {
      this.temperatureSamples.shift();
    }
  }

  /**
   * Calculate temperature change rate over specified minutes
   * @param {number} minutes - Time window to calculate rate over (15 or 30)
   * @returns {Object} Rate information {rate, sampleSize, confidence}
   */
  calculateTemperatureRate(minutes = 15) {
    if (this.temperatureSamples.length < 2) {
      return { rate: 0, sampleSize: 0, confidence: 'insufficient_data' };
    }

    const now = Date.now();
    const timeWindow = minutes * 60 * 1000; // Convert to milliseconds
    const targetTime = now - timeWindow;

    // Find sample closest to target time
    let targetSample = null;
    let minTimeDiff = Infinity;

    for (const sample of this.temperatureSamples) {
      const timeDiff = Math.abs(sample.timestamp - targetTime);
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        targetSample = sample;
      }
    }

    if (!targetSample) {
      return { rate: 0, sampleSize: 0, confidence: 'insufficient_data' };
    }

    // Get current temperature (most recent sample)
    const currentSample = this.temperatureSamples[this.temperatureSamples.length - 1];

    // Calculate rate (degrees per minute)
    const tempChange = currentSample.temp - targetSample.temp;
    const timeElapsed = (currentSample.timestamp - targetSample.timestamp) / 60000; // minutes
    const rate = timeElapsed > 0 ? tempChange / timeElapsed : 0;

    // Count samples in window for confidence
    const samplesInWindow = this.temperatureSamples.filter(
      s => s.timestamp >= targetTime
    ).length;

    // Determine confidence based on sample size
    let confidence;
    if (samplesInWindow >= 10) confidence = 'high';
    else if (samplesInWindow >= 5) confidence = 'medium';
    else confidence = 'low';

    return {
      rate: parseFloat(rate.toFixed(4)),
      sampleSize: samplesInWindow,
      confidence,
      timeWindow: minutes
    };
  }

  /**
   * Get current scheduler status
   * @returns {Object} Current configuration and state
   */
  getStatus() {
    return {
      enabled: this.enabled,
      targetTemp: this.TARGET_TEMP,
      threshold: this.TEMP_THRESHOLD,
      adjustmentStep: this.ADJUSTMENT_STEP,
      minSetpoint: this.MIN_SETPOINT,
      maxSetpoint: this.MAX_SETPOINT,
      lastAdjustment: this.lastAdjustmentTime ? new Date(this.lastAdjustmentTime).toISOString() : null,
      officeSensor: this.OFFICE_SENSOR,
      thermostat: this.THERMOSTAT
    };
  }
}

// Export singleton instance
export const temperatureScheduler = new TemperatureScheduler();
