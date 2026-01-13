import express from 'express';
import { schedulerService } from '../services/schedulerService.js';
import { sprinklerControl } from '../services/sprinklerControl.js';

const router = express.Router();

/**
 * GET /api/sprinkler/duration
 * Returns today's AI-calculated sprinkler duration
 */
router.get('/duration', (req, res) => {
  try {
    const decision = schedulerService.getTodaysDuration();

    if (!decision) {
      return res.json({
        success: true,
        data: {
          duration: 15,
          reasoning: 'No AI decision calculated yet (using default)',
          calculated: false
        }
      });
    }

    res.json({
      success: true,
      data: {
        duration: decision.duration,
        shouldWater: decision.should_water === 1,
        temperature: decision.temperature,
        humidity: decision.humidity,
        forecast: decision.forecast,
        reasoning: decision.reasoning,
        date: decision.date,
        calculated: true
      }
    });
  } catch (error) {
    console.error('Error fetching sprinkler duration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sprinkler/history
 * Returns historical AI decisions
 */
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const history = schedulerService.getHistory(limit);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching sprinkler history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sprinkler/calculate
 * Manually triggers AI calculation (for testing)
 */
router.post('/calculate', async (req, res) => {
  try {
    console.log('Manual AI calculation triggered');
    const decision = await schedulerService.triggerManually();

    res.json({
      success: true,
      data: decision
    });
  } catch (error) {
    console.error('Error calculating sprinkler duration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sprinkler/auto-water
 * Manually triggers automatic watering check (for testing)
 * Checks AI decision and runs sprinklers if shouldWater is true
 */
router.post('/auto-water', async (req, res) => {
  try {
    console.log('Manual auto-watering triggered');
    const result = await sprinklerControl.autoWater();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error during auto-watering:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sprinkler/simulate
 * Runs a simulation cycle with custom short durations for testing
 * Body: { duration: 3, breakTime: 1 } (in minutes)
 */
router.post('/simulate', async (req, res) => {
  try {
    const duration = req.body?.duration || 3; // 3 minutes per zone
    const breakTime = req.body?.breakTime || 1; // 1 minute break

    console.log(`Simulation cycle triggered: ${duration}min/zone, ${breakTime}min break`);

    const result = await sprinklerControl.runSprinklerCycle(duration, {
      simulation: true,
      duration,
      breakTime
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error during simulation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
