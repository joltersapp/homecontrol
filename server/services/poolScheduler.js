import cron from 'node-cron';
import db from '../db.js';
import fetch from 'node-fetch';
import { weatherService } from './weatherService.js';

/**
 * Pool Pump Backend Scheduler - Miami Climate Optimized
 *
 * Runs 24/7 in Node.js - no browser required!
 *
 * Miami-specific features:
 * - Runs during peak sun hours (10 AM start) to combat UV depletion
 * - Temperature-based duration (1hr per 10°F industry standard)
 * - Automatic rain detection with 2-4 hour extension
 *
 * Daily Schedule:
 * - 5:00 AM: Calculate hours based on current temperature
 * - 10:00 AM: Start pump (runs during peak sun to fight algae)
 * - Auto-stop after calculated hours
 * - Hourly: Check for rain, extend if detected
 */
class PoolScheduler {
  constructor() {
    this.enabled = false;
    this.currentSchedule = {
      hours: 8,
      totalHours: 8,
      reason: 'Not calculated yet',
      startTime: '10:00',
      nextStart: null,
      nextEnd: null
    };
    this.stopTimer = null;
    this.cronJobs = [];
    this.currentJobId = null;
    this.rainExtensionApplied = false;

    this.HA_URL = process.env.HA_URL || 'http://192.168.1.222:8123';
    this.HA_TOKEN = process.env.HA_TOKEN || '';
  }

  /**
   * Start the pool pump scheduler
   */
  async start() {
    if (this.enabled) {
      console.log('[PoolScheduler] Already running');
      return;
    }

    this.enabled = true;

    // Load saved schedule from database
    await this.loadSchedule();

    console.log('[PoolScheduler] 🏊 Starting 24/7 Miami-optimized pool pump scheduler...');
    console.log('[PoolScheduler] Current schedule:', this.currentSchedule);

    // 5:00 AM - Daily temperature-based recalculation
    const dailyCalcJob = cron.schedule('0 5 * * *', async () => {
      console.log('[PoolScheduler] 5:00 AM - Running daily schedule recalculation');
      await this.calculateSchedule();
      this.rainExtensionApplied = false; // Reset rain extension flag for new day
    }, {
      timezone: 'America/New_York'
    });
    this.cronJobs.push(dailyCalcJob);

    // 10:00 AM - Start pump during peak sun (Miami best practice)
    const pumpStartJob = cron.schedule('0 10 * * *', async () => {
      console.log('[PoolScheduler] ☀️  10:00 AM - Starting pump during peak sun hours');
      await this.startPumpSession();
    }, {
      timezone: 'America/New_York'
    });
    this.cronJobs.push(pumpStartJob);

    // Every hour - Check for rain and extend if needed
    const rainCheckJob = cron.schedule('0 * * * *', async () => {
      await this.checkRainAndExtend();
    }, {
      timezone: 'America/New_York'
    });
    this.cronJobs.push(rainCheckJob);

    // Initial calculation on startup
    await this.calculateSchedule();

    console.log('[PoolScheduler] ✓ Started successfully');
    console.log('[PoolScheduler] 📅 Cron jobs:');
    console.log('[PoolScheduler]    - 5:00 AM: Daily recalculation');
    console.log('[PoolScheduler]    - 10:00 AM: Pump start (peak sun)');
    console.log('[PoolScheduler]    - Every hour: Rain detection');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.enabled) return;

    console.log('[PoolScheduler] Stopping scheduler...');
    this.cronJobs.forEach(job => job.stop());
    this.cronJobs = [];

    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    this.enabled = false;
    console.log('[PoolScheduler] Stopped');
  }

  /**
   * Calculate schedule based on temperature
   * Miami formula: 1 hour per 10°F (industry standard)
   */
  async calculateSchedule() {
    try {
      // Get current temperature from Home Assistant
      const temp = await this.getTemperature();
      console.log(`[PoolScheduler] 🌡️  Current temperature: ${temp}°F`);

      // Industry formula: 1 hour per 10°F
      let hours = temp / 10;

      // Apply bounds for Miami
      if (hours < 4) hours = 4;      // Minimum 4 hours even in "winter"
      if (hours > 10) hours = 10;    // Maximum 10 hours to prevent over-circulation

      // Round to nearest 0.5 hour
      hours = Math.round(hours * 2) / 2;

      // Generate reason
      let reason = `${temp}°F = ${hours}hrs (1hr per 10°F Miami standard)`;
      if (temp < 40) reason += ' - minimum 4hrs for circulation';
      if (temp > 100) reason += ' - capped at 10hrs maximum';

      // Calculate next start/end times
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextStart = new Date(tomorrow);
      nextStart.setHours(10, 0, 0, 0);

      const nextEnd = new Date(nextStart);
      nextEnd.setHours(nextStart.getHours() + Math.floor(hours), (hours % 1) * 60, 0, 0);

      this.currentSchedule = {
        hours,
        totalHours: hours,
        reason,
        startTime: '10:00',
        nextStart: nextStart.toISOString(),
        nextEnd: nextEnd.toISOString()
      };

      // Save to database
      await this.saveSchedule();

      console.log(`[PoolScheduler] ✓ Schedule calculated: ${hours} hours during peak sun`);
      console.log(`[PoolScheduler] 📊 ${reason}`);
      console.log(`[PoolScheduler] ⏰ Next run: 10:00 AM - ${this.formatTime(nextEnd)} (${hours}hrs)`);

      return this.currentSchedule;

    } catch (error) {
      console.error('[PoolScheduler] ❌ Error calculating schedule:', error);
      // Keep existing schedule on error
      return this.currentSchedule;
    }
  }

  /**
   * Get temperature from Home Assistant
   */
  async getTemperature() {
    try {
      const response = await fetch(`${this.HA_URL}/api/states/sensor.nws_temperature`, {
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

      if (isNaN(temp) || temp < 30 || temp > 120) {
        console.warn('[PoolScheduler] ⚠️  Invalid temperature, using 80°F fallback');
        return 80;
      }

      return temp;

    } catch (error) {
      console.error('[PoolScheduler] ⚠️  Error fetching temperature:', error.message);
      return 80; // Default fallback for Miami
    }
  }

  /**
   * Check for rain and extend pump time if needed
   * Miami gets frequent afternoon thunderstorms - this is critical!
   */
  async checkRainAndExtend() {
    // Only check if pump is currently running
    if (!this.currentJobId) return;

    // Only apply rain extension once per day
    if (this.rainExtensionApplied) return;

    try {
      const weatherData = await weatherService.getCurrentWeather();

      // Check if it's raining or recently rained
      const condition = weatherData.forecast?.toLowerCase() || '';
      const isRaining = condition.includes('rain') ||
                       condition.includes('storm') ||
                       condition.includes('shower');

      if (isRaining) {
        // Extend pump time by 2-4 hours (average 3 hours for Miami storms)
        const extensionHours = 3;
        const extensionMs = extensionHours * 60 * 60 * 1000;

        console.log(`[PoolScheduler] 🌧️  Rain detected! Extending pump time by ${extensionHours} hours`);
        console.log(`[PoolScheduler] Reason: Post-storm circulation to combat debris, pH changes, and phosphates`);

        // Clear existing stop timer and create new one with extension
        if (this.stopTimer) {
          clearTimeout(this.stopTimer);
          this.stopTimer = setTimeout(async () => {
            await this.stopPumpSession();
          }, extensionMs);
        }

        // Update schedule with extension
        this.currentSchedule.totalHours += extensionHours;
        this.currentSchedule.reason += ` + ${extensionHours}hrs rain extension`;
        await this.saveSchedule();

        this.rainExtensionApplied = true;

        console.log(`[PoolScheduler] ✓ Extended to ${this.currentSchedule.totalHours} total hours`);
      }

    } catch (error) {
      console.error('[PoolScheduler] ⚠️  Error checking rain:', error.message);
    }
  }

  /**
   * Start pump session at 10 AM (peak sun)
   */
  async startPumpSession() {
    try {
      await this.controlPump('on');
      await this.startJobTracking();

      // Schedule automatic stop
      const stopDelayMs = this.currentSchedule.hours * 60 * 60 * 1000;
      if (this.stopTimer) clearTimeout(this.stopTimer);

      this.stopTimer = setTimeout(async () => {
        console.log(`[PoolScheduler] ⏱️  Session complete (${this.currentSchedule.hours}hrs)`);
        await this.stopPumpSession();
      }, stopDelayMs);

      const endTime = new Date(Date.now() + stopDelayMs);
      console.log(`[PoolScheduler] ✓ Pump started - will run until ${this.formatTime(endTime)} (${this.currentSchedule.hours}hrs)`);
      console.log(`[PoolScheduler] 💡 Running during peak sun to combat UV chlorine depletion`);

    } catch (error) {
      console.error('[PoolScheduler] ❌ Error starting session:', error);
    }
  }

  /**
   * Stop pump session
   */
  async stopPumpSession() {
    try {
      await this.controlPump('off');
      await this.endJobTracking();

      if (this.stopTimer) {
        clearTimeout(this.stopTimer);
        this.stopTimer = null;
      }

      console.log('[PoolScheduler] ✓ Pump session stopped');

    } catch (error) {
      console.error('[PoolScheduler] ❌ Error stopping session:', error);
    }
  }

  /**
   * Control the pool pump via Home Assistant
   */
  async controlPump(action) {
    try {
      const scriptName = action === 'on' ? 'turn_on_pool_pump' : 'turn_off_pool_pump';

      const response = await fetch(`${this.HA_URL}/api/services/script/turn_on`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.HA_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          entity_id: `script.${scriptName}`
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      console.log(`[PoolScheduler] ${action === 'on' ? '▶️' : '⏸️'}  Pump ${action === 'on' ? 'started' : 'stopped'} via Home Assistant`);

    } catch (error) {
      console.error(`[PoolScheduler] ❌ Error controlling pump:`, error.message);
      throw error;
    }
  }

  /**
   * Start job tracking in database
   */
  async startJobTracking() {
    try {
      const conditions = {
        temperature: await this.getTemperature(),
        reason: this.currentSchedule.reason,
        startTime: '10:00',
        expectedHours: this.currentSchedule.hours
      };

      const stmt = db.prepare(`
        INSERT INTO jobs (device, session, start_time, conditions)
        VALUES (?, ?, datetime('now', 'localtime'), ?)
      `);

      const result = stmt.run('Pool Pump', 'Daily Peak Sun', JSON.stringify(conditions));
      this.currentJobId = result.lastInsertRowid;

      console.log(`[PoolScheduler] 📝 Started job tracking (ID: ${this.currentJobId})`);

    } catch (error) {
      console.error('[PoolScheduler] ⚠️  Error starting job tracking:', error);
    }
  }

  /**
   * End job tracking in database
   */
  async endJobTracking() {
    if (!this.currentJobId) return;

    try {
      const stmt = db.prepare(`
        UPDATE jobs
        SET end_time = datetime('now', 'localtime'),
            duration = CAST((julianday(datetime('now', 'localtime')) - julianday(start_time)) * 24 * 60 AS INTEGER)
        WHERE id = ?
      `);

      stmt.run(this.currentJobId);
      console.log(`[PoolScheduler] ✓ Ended job tracking (ID: ${this.currentJobId})`);
      this.currentJobId = null;

    } catch (error) {
      console.error('[PoolScheduler] ⚠️  Error ending job tracking:', error);
    }
  }

  /**
   * Save schedule to database
   */
  async saveSchedule() {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO schedules (device, config, updated_at)
        VALUES ('Pool Pump', ?, datetime('now', 'localtime'))
      `);

      stmt.run(JSON.stringify(this.currentSchedule));

    } catch (error) {
      console.error('[PoolScheduler] ⚠️  Error saving schedule:', error);
    }
  }

  /**
   * Load schedule from database
   */
  async loadSchedule() {
    try {
      const stmt = db.prepare(`
        SELECT config FROM schedules WHERE device = 'Pool Pump'
      `);

      const result = stmt.get();
      if (result && result.config) {
        this.currentSchedule = JSON.parse(result.config);
        console.log('[PoolScheduler] ✓ Loaded saved schedule:', this.currentSchedule);
      }
    } catch (error) {
      console.error('[PoolScheduler] ⚠️  Error loading schedule:', error);
    }
  }

  /**
   * Get current schedule (for API endpoint)
   */
  getSchedule() {
    return {
      enabled: this.enabled,
      schedule: this.currentSchedule,
      isRunning: this.currentJobId !== null,
      currentJobId: this.currentJobId,
      rainExtensionApplied: this.rainExtensionApplied
    };
  }

  /**
   * Format time for display
   */
  formatTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York'
    });
  }

  /**
   * Manual control for testing
   */
  async forceRecalculate() {
    console.log('[PoolScheduler] 🔄 Manual recalculation requested');
    return await this.calculateSchedule();
  }
}

export const poolScheduler = new PoolScheduler();
