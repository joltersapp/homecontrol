import db from '../db.js';
import { weatherService } from './weatherService.js';
import { geminiService } from './geminiService.js';
import { sprinklerControl } from './sprinklerControl.js';

/**
 * Get current date in America/New_York timezone as YYYY-MM-DD
 * @returns {string} Date string in YYYY-MM-DD format (Miami/EST timezone)
 */
function getLocalDate() {
  const dateStr = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  // Converts "MM/DD/YYYY, HH:MM:SS" to "YYYY-MM-DD"
  const [datePart] = dateStr.split(',');
  const [month, day, year] = datePart.split('/');
  return `${year}-${month}-${day}`;
}

class SchedulerService {
  constructor() {
    this.isRunning = false;
    this.location = process.env.LOCATION || 'Miami, FL';
    this.calculationTimeout = null;
    this.wateringTimeout = null;
  }

  /**
   * Starts the daily sprinkler AI scheduler with dynamic sunrise-based timing
   * Timing adjusts daily based on sunrise calculations from Gemini
   */
  async start() {
    if (this.isRunning) {
      console.log('Scheduler already running');
      return;
    }

    this.isRunning = true;

    // Run immediately on startup for testing
    console.log('[Scheduler] Running initial calculation on startup');
    await this.calculateDailySprinklerDuration();

    // Schedule tomorrow's timing based on sunrise
    await this.scheduleTomorrowsWatering();

    console.log('[Scheduler] Started - Dynamic scheduling based on sunrise times');
  }

  /**
   * Schedules tomorrow's watering based on Gemini's sunrise calculation
   */
  async scheduleTomorrowsWatering() {
    try {
      // Get tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDate = tomorrow.toISOString().split('T')[0];

      // Ask Gemini for optimal watering time
      console.log(`[Scheduler] Calculating optimal watering time for ${tomorrowDate}`);
      const timing = await geminiService.getOptimalWateringTime(this.location, tomorrowDate);

      console.log(`[Scheduler] Sunrise: ${timing.sunrise}, Optimal watering: ${timing.hour}:${String(timing.minute).padStart(2, '0')}`);
      console.log(`[Scheduler] Reasoning: ${timing.reasoning}`);

      // Calculate milliseconds until tomorrow's watering time
      const now = new Date();

      // Create watering time in America/New_York timezone
      // Format: 2025-11-30T06:13:00 (EST)
      const estDateString = `${tomorrowDate}T${String(timing.hour).padStart(2, '0')}:${String(timing.minute).padStart(2, '0')}:00`;

      // Parse as EST by creating date string with timezone
      const wateringTime = new Date(estDateString + '-05:00'); // EST is UTC-5

      const msUntilWatering = wateringTime.getTime() - now.getTime();

      // Calculate time 30 minutes before watering for AI calculation
      const calculationTime = new Date(wateringTime.getTime() - 30 * 60 * 1000);
      const msUntilCalculation = calculationTime.getTime() - now.getTime();

      // Clear existing timeouts
      if (this.calculationTimeout) clearTimeout(this.calculationTimeout);
      if (this.wateringTimeout) clearTimeout(this.wateringTimeout);

      // Schedule AI calculation (30 min before watering)
      if (msUntilCalculation > 0) {
        this.calculationTimeout = setTimeout(async () => {
          console.log('[Scheduler] Running scheduled AI calculation');
          await this.calculateDailySprinklerDuration();
        }, msUntilCalculation);
        console.log(`[Scheduler] AI calculation scheduled for ${calculationTime.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
      }

      // Schedule watering
      if (msUntilWatering > 0) {
        this.wateringTimeout = setTimeout(async () => {
          console.log('[Scheduler] Running scheduled automatic watering');
          await this.triggerAutoWatering();
          // After watering, schedule tomorrow's watering
          await this.scheduleTomorrowsWatering();
        }, msUntilWatering);
        console.log(`[Scheduler] Watering scheduled for ${wateringTime.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
      }

    } catch (error) {
      console.error('[Scheduler] Error scheduling tomorrow\'s watering:', error);
      // Fallback: try again in 1 hour
      setTimeout(() => this.scheduleTomorrowsWatering(), 60 * 60 * 1000);
    }
  }

  /**
   * Stops the scheduler
   */
  stop() {
    if (this.calculationTimeout) {
      clearTimeout(this.calculationTimeout);
      this.calculationTimeout = null;
    }
    if (this.wateringTimeout) {
      clearTimeout(this.wateringTimeout);
      this.wateringTimeout = null;
    }
    this.isRunning = false;
    console.log('[Scheduler] Stopped');
  }

  /**
   * Calculates and stores today's sprinkler duration using AI
   */
  async calculateDailySprinklerDuration() {
    try {
      const device = 'Sprinkler';
      const today = getLocalDate(); // YYYY-MM-DD in America/New_York timezone

      console.log(`[Scheduler] Calculating sprinkler duration for ${today}`);

      // Fetch current weather from Home Assistant
      const weatherData = await weatherService.getCurrentWeather();
      console.log('[Scheduler] Weather data:', weatherData);

      // Get watering history from last 7 days
      const wateringHistory = this.getRecentWateringHistory(7);
      console.log('[Scheduler] Watering history:', wateringHistory);

      // Get AI recommendation with history context
      const aiDecision = await geminiService.calculateSprinklerDuration(weatherData, wateringHistory);
      console.log('[Scheduler] AI decision:', aiDecision);

      // Store decision in database
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO ai_decisions
        (device, date, duration, temperature, humidity, forecast, reasoning, should_water)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        device,
        today,
        aiDecision.duration,
        weatherData.temperature,
        weatherData.humidity,
        weatherData.forecast,
        aiDecision.reasoning,
        aiDecision.shouldWater ? 1 : 0
      );

      console.log(`[Scheduler] ✓ Stored AI decision: ${aiDecision.shouldWater ? 'WATER' : 'SKIP'} - ${aiDecision.duration} minutes per zone`);
      console.log(`[Scheduler] Reasoning: ${aiDecision.reasoning}`);

      return aiDecision;

    } catch (error) {
      console.error('[Scheduler] Error calculating sprinkler duration:', error);

      // Store fallback decision
      const today = getLocalDate();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO ai_decisions
        (device, date, duration, temperature, humidity, forecast, reasoning, should_water)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        'Sprinkler',
        today,
        15, // Default fallback
        null,
        null,
        'Error',
        'Fallback due to error: ' + error.message,
        1 // Default to watering on error
      );

      return { duration: 15, reasoning: 'Fallback due to error', shouldWater: true };
    }
  }

  /**
   * Triggers automatic watering based on AI decision
   * Called by cron job at 6:30 AM
   */
  async triggerAutoWatering() {
    try {
      console.log('[Scheduler] Checking if automatic watering should run...');
      const result = await sprinklerControl.autoWater();
      console.log('[Scheduler] Auto-watering result:', result);
      return result;
    } catch (error) {
      console.error('[Scheduler] Error during automatic watering:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Gets watering history for the last N days
   */
  getRecentWateringHistory(days = 7) {
    const stmt = db.prepare(`
      SELECT
        date(start_time) as date,
        SUM(duration) as total_minutes,
        COUNT(*) as num_runs
      FROM jobs
      WHERE device = 'Sprinkler'
        AND end_time IS NOT NULL
        AND start_time >= datetime('now', '-' || ? || ' days')
      GROUP BY date(start_time)
      ORDER BY date(start_time) DESC
    `);

    const history = stmt.all(days);

    // Calculate summary stats
    const totalMinutes = history.reduce((sum, day) => sum + (day.total_minutes || 0), 0);
    const lastWatered = history.length > 0 ? history[0].date : null;
    const daysSinceLastWatering = lastWatered
      ? Math.floor((Date.now() - new Date(lastWatered).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    return {
      lastWatered,
      daysSinceLastWatering,
      totalMinutesLast7Days: totalMinutes,
      dailyHistory: history
    };
  }

  /**
   * Gets today's AI-calculated duration
   */
  getTodaysDuration() {
    const today = new Date().toISOString().split('T')[0];
    const stmt = db.prepare(`
      SELECT * FROM ai_decisions
      WHERE device = 'Sprinkler' AND date = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);

    return stmt.get(today);
  }

  /**
   * Gets historical AI decisions
   */
  getHistory(limit = 30) {
    const stmt = db.prepare(`
      SELECT * FROM ai_decisions
      WHERE device = 'Sprinkler'
      ORDER BY date DESC
      LIMIT ?
    `);

    return stmt.all(limit);
  }

  /**
   * Manual trigger for testing
   */
  async triggerManually() {
    console.log('[Scheduler] Manual trigger requested');
    return await this.calculateDailySprinklerDuration();
  }
}

export const schedulerService = new SchedulerService();
