import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import jobsRouter from './routes/jobs.js';
import schedulesRouter from './routes/schedules.js';
import sprinklerRouter from './routes/sprinkler.js';
import { schedulerService } from './services/schedulerService.js';
import { poolScheduler } from './services/poolScheduler.js';
import { temperatureScheduler } from './services/temperatureScheduler.js';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
}

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/jobs', jobsRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/sprinkler', sprinklerRouter);

// Pool Scheduler API Routes
console.log('[Server] Registering pool scheduler routes...');
app.get('/api/pool/schedule', (req, res) => {
  console.log('[Server] GET /api/pool/schedule called');
  try {
    const schedule = poolScheduler.getSchedule();
    res.json({ success: true, ...schedule });
  } catch (error) {
    console.error('Error getting pool schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/pool/schedule/toggle', (req, res) => {
  try {
    if (poolScheduler.enabled) {
      poolScheduler.stop();
    } else {
      poolScheduler.start();
    }
    const schedule = poolScheduler.getSchedule();
    res.json({ success: true, ...schedule });
  } catch (error) {
    console.error('Error toggling pool schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/pool/schedule/recalculate', async (req, res) => {
  try {
    const schedule = await poolScheduler.forceRecalculate();
    res.json({ success: true, schedule });
  } catch (error) {
    console.error('Error recalculating pool schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Temperature Scheduler API Routes
console.log('[Server] Registering temperature scheduler routes...');
app.get('/api/temperature/status', (req, res) => {
  console.log('[Server] GET /api/temperature/status called');
  try {
    const status = temperatureScheduler.getStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('Error getting temperature status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/temperature/toggle', (req, res) => {
  console.log('[Server] POST /api/temperature/toggle called');
  try {
    if (temperatureScheduler.enabled) {
      temperatureScheduler.stop();
    } else {
      temperatureScheduler.start();
    }
    const status = temperatureScheduler.getStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('Error toggling temperature scheduler:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/temperature/set-target', (req, res) => {
  console.log('[Server] POST /api/temperature/set-target called');
  try {
    const { temperature } = req.body;

    if (!temperature || typeof temperature !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Temperature is required and must be a number'
      });
    }

    temperatureScheduler.setTargetTemperature(temperature);
    const status = temperatureScheduler.getStatus();
    res.json({ success: true, targetTemp: temperature, ...status });
  } catch (error) {
    console.error('Error setting target temperature:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/temperature/feedback', async (req, res) => {
  console.log('[Server] POST /api/temperature/feedback called');
  try {
    const { feedbackType } = req.body;

    if (!feedbackType || !['too_hot', 'too_cold'].includes(feedbackType)) {
      return res.status(400).json({
        success: false,
        error: 'feedbackType is required and must be "too_hot" or "too_cold"'
      });
    }

    // Get current climate state
    const officeTemp = await temperatureScheduler.getOfficeTemperature();
    const climateState = await temperatureScheduler.getClimateState();
    const thermostatSetpoint = climateState.attributes.temperature;
    const hvacMode = climateState.attributes.hvac_mode;

    // Calculate current rates
    const rate15min = temperatureScheduler.calculateTemperatureRate(15);
    const rate30min = temperatureScheduler.calculateTemperatureRate(30);

    // Insert feedback into database
    const stmt = db.prepare(`
      INSERT INTO user_feedback (
        feedback_type, office_temp, thermostat_setpoint, hvac_mode,
        temp_change_rate_15min, temp_change_rate_30min
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      feedbackType,
      officeTemp,
      thermostatSetpoint,
      hvacMode,
      rate15min.rate,
      rate30min.rate
    );

    console.log(`[Server] Feedback recorded: ${feedbackType} at ${officeTemp}°F (setpoint: ${thermostatSetpoint}°F)`);

    res.json({
      success: true,
      feedback: {
        id: result.lastInsertRowid,
        feedbackType,
        officeTemp,
        thermostatSetpoint,
        hvacMode
      }
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/temperature/analytics', (req, res) => {
  console.log('[Server] GET /api/temperature/analytics called');
  try {
    // Get recent feedback (last 7 days)
    const feedbackStmt = db.prepare(`
      SELECT * FROM user_feedback
      WHERE created_at >= datetime('now', '-7 days', 'localtime')
      ORDER BY created_at DESC
    `);
    const recentFeedback = feedbackStmt.all();

    // Get feedback summary
    const summaryStmt = db.prepare(`
      SELECT
        feedback_type,
        COUNT(*) as count,
        AVG(office_temp) as avg_temp,
        AVG(thermostat_setpoint) as avg_setpoint
      FROM user_feedback
      WHERE created_at >= datetime('now', '-7 days', 'localtime')
      GROUP BY feedback_type
    `);
    const feedbackSummary = summaryStmt.all();

    // Get recent adjustments with rate data (last 7 days)
    const adjustmentsStmt = db.prepare(`
      SELECT * FROM jobs
      WHERE device = 'Office Temperature'
      AND start_time >= datetime('now', '-7 days', 'localtime')
      ORDER BY start_time DESC
      LIMIT 100
    `);
    const recentAdjustments = adjustmentsStmt.all();

    // Parse conditions JSON for adjustments
    const adjustmentsWithConditions = recentAdjustments.map(adj => ({
      ...adj,
      conditions: JSON.parse(adj.conditions || '{}')
    }));

    // Calculate statistics
    const tooHotCount = feedbackSummary.find(f => f.feedback_type === 'too_hot')?.count || 0;
    const tooColdCount = feedbackSummary.find(f => f.feedback_type === 'too_cold')?.count || 0;

    res.json({
      success: true,
      analytics: {
        feedbackSummary: {
          tooHot: tooHotCount,
          tooCold: tooColdCount,
          total: tooHotCount + tooColdCount
        },
        recentFeedback: recentFeedback.slice(0, 20), // Last 20 feedback entries
        recentAdjustments: adjustmentsWithConditions.slice(0, 20), // Last 20 adjustments
        detailedFeedback: feedbackSummary
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Home Control API server running on http://localhost:${PORT}`);
  console.log(`Database: data/homecontrol.db`);

  // Start the AI scheduler for daily sprinkler calculations
  schedulerService.start();
  console.log('AI Scheduler started');

  // Start the pool pump scheduler
  poolScheduler.start();
  console.log('Pool Scheduler started');

  // Start the office temperature automation
  temperatureScheduler.start();
  console.log('Temperature Scheduler started');
});
