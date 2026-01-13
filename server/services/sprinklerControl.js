import fetch from 'node-fetch';
import db from '../db.js';

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

class SprinklerControl {
  constructor() {
    this.haUrl = process.env.HA_URL || 'http://192.168.1.222:8123';
    this.haToken = process.env.HA_TOKEN;
    this.sprinklerOnScript = 'script.turn_on_sprinkler';
    this.sprinklerOffScript = 'script.turn_off_sprinkler';
    this.numZones = 4;
    this.breakPeriodMs = 3 * 60 * 1000; // 3 minutes between zones

    if (!this.haToken) {
      console.error('HA_TOKEN not found in environment variables');
    }
  }

  /**
   * Calls a Home Assistant service
   * @param {string} domain - Service domain (e.g., 'switch')
   * @param {string} service - Service name (e.g., 'turn_on')
   * @param {string} entityId - Target entity ID
   */
  async callService(domain, service, entityId) {
    if (!this.haToken) {
      throw new Error('Cannot control sprinkler: HA_TOKEN not configured');
    }

    const url = `${this.haUrl}/api/services/${domain}/${service}`;
    const body = JSON.stringify({ entity_id: entityId });

    console.log(`[SprinklerControl] Calling HA API: ${url}`);
    console.log(`[SprinklerControl] Entity: ${entityId}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.haToken}`,
          'Content-Type': 'application/json'
        },
        body,
        timeout: 10000 // 10 second timeout
      });

      console.log(`[SprinklerControl] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SprinklerControl] Error response: ${errorText}`);
        throw new Error(`HA API error: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[SprinklerControl] Success: Script ${entityId} triggered`);
      return result;
    } catch (error) {
      console.error(`[SprinklerControl] Error calling service ${domain}.${service}:`, error.message);
      throw error;
    }
  }

  /**
   * Gets the latest AI decision for today
   * @returns {Promise<{shouldWater: boolean, duration: number, reasoning: string}>}
   */
  async getLatestDecision() {
    const today = getLocalDate(); // YYYY-MM-DD in America/New_York timezone

    const decision = db.prepare(`
      SELECT duration, should_water, reasoning
      FROM ai_decisions
      WHERE device = 'Sprinkler' AND date = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(today);

    if (!decision) {
      return null;
    }

    return {
      shouldWater: decision.should_water === 1,
      duration: decision.duration,
      reasoning: decision.reasoning
    };
  }

  /**
   * Starts a job tracking record
   * @param {string} session - Session description
   * @param {Object} conditions - Weather conditions
   * @returns {number} Job ID
   */
  startJob(session, conditions = {}) {
    const result = db.prepare(`
      INSERT INTO jobs (device, session, start_time, conditions)
      VALUES (?, ?, datetime('now'), ?)
    `).run('Sprinkler', session, JSON.stringify(conditions));

    return result.lastInsertRowid;
  }

  /**
   * Ends a job tracking record
   * @param {number} jobId - Job ID to complete
   */
  endJob(jobId) {
    db.prepare(`
      UPDATE jobs
      SET end_time = datetime('now'),
          duration = (julianday(datetime('now')) - julianday(start_time)) * 24 * 60
      WHERE id = ?
    `).run(jobId);
  }

  /**
   * Runs the complete 4-zone sprinkler cycle
   * @param {number} duration - Duration in minutes per zone
   * @param {Object} conditions - Weather conditions for job tracking
   */
  async runSprinklerCycle(duration, conditions = {}) {
    const durationMs = duration * 60 * 1000;
    const breakTime = conditions.breakTime || 3; // Default 3 minutes, or custom for simulation
    const breakPeriodMs = breakTime * 60 * 1000;

    console.log(`Starting sprinkler cycle: ${this.numZones} zones, ${duration} min each, ${breakTime} min break`);

    // Start job tracking
    const jobId = this.startJob(`AI Auto-Water (${duration}m/zone)`, conditions);

    try {
      for (let zone = 1; zone <= this.numZones; zone++) {
        console.log(`Zone ${zone}: Turning pump ON for ${duration} minutes`);

        // Turn pump ON by calling the script
        await this.callService('script', 'turn_on', this.sprinklerOnScript);

        // Wait for zone duration
        await new Promise(resolve => setTimeout(resolve, durationMs));

        console.log(`Zone ${zone}: Turning pump OFF`);

        // Turn pump OFF by calling the script
        await this.callService('script', 'turn_on', this.sprinklerOffScript);

        // Wait for break period (except after last zone)
        if (zone < this.numZones) {
          console.log(`Break period: Waiting ${breakTime} minutes for check valve to rotate to Zone ${zone + 1}`);
          await new Promise(resolve => setTimeout(resolve, breakPeriodMs));
        }
      }

      console.log('Sprinkler cycle complete');
      return { success: true, message: 'Sprinkler cycle completed successfully' };

    } catch (error) {
      console.error('Sprinkler cycle error:', error);
      throw error;
    } finally {
      // End job tracking
      this.endJob(jobId);
    }
  }

  /**
   * Main entry point: Check AI decision and run sprinklers if needed
   * Called by cron job at 6:30 AM
   */
  async autoWater() {
    console.log('=== Auto-Watering Check Started ===');

    try {
      // Get today's AI decision
      const decision = await this.getLatestDecision();

      if (!decision) {
        console.log('No AI decision found for today. Skipping watering.');
        return { success: false, message: 'No AI decision available' };
      }

      console.log('AI Decision:', decision);

      if (!decision.shouldWater) {
        console.log(`Skipping watering: ${decision.reasoning}`);
        return {
          success: true,
          message: `Watering skipped: ${decision.reasoning}`
        };
      }

      console.log(`Starting automatic watering: ${decision.duration} minutes per zone`);
      console.log(`Reasoning: ${decision.reasoning}`);

      // Run the sprinkler cycle
      const result = await this.runSprinklerCycle(decision.duration, {
        reasoning: decision.reasoning,
        autoTriggered: true
      });

      console.log('=== Auto-Watering Complete ===');
      return result;

    } catch (error) {
      console.error('Auto-watering error:', error);
      throw error;
    }
  }
}

export const sprinklerControl = new SprinklerControl();
