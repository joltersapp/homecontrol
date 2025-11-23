import express from 'express';
import db from '../db.js';

const router = express.Router();

// Start a new job
router.post('/', (req, res) => {
  try {
    const { device, session, conditions } = req.body;

    const stmt = db.prepare(`
      INSERT INTO jobs (device, session, start_time, conditions)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      device,
      session || null,
      new Date().toISOString(),
      JSON.stringify(conditions || {})
    );

    res.json({
      success: true,
      jobId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// End a job (update with end time and duration)
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const endTime = new Date();

    // Get start time to calculate duration
    const job = db.prepare('SELECT start_time FROM jobs WHERE id = ?').get(id);

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const startTime = new Date(job.start_time);
    const duration = Math.round((endTime - startTime) / 1000 / 60); // minutes

    const stmt = db.prepare(`
      UPDATE jobs
      SET end_time = ?, duration = ?
      WHERE id = ?
    `);

    stmt.run(endTime.toISOString(), duration, id);

    res.json({ success: true, duration });
  } catch (error) {
    console.error('Error ending job:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get job history for a device
router.get('/:device', (req, res) => {
  try {
    const { device } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    const stmt = db.prepare(`
      SELECT * FROM jobs
      WHERE device = ?
      ORDER BY start_time DESC
      LIMIT ?
    `);

    const jobs = stmt.all(device, limit);

    // Parse JSON conditions
    const parsedJobs = jobs.map(job => ({
      ...job,
      conditions: JSON.parse(job.conditions || '{}')
    }));

    res.json({ success: true, jobs: parsedJobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get active job for a device (no end_time)
router.get('/:device/active', (req, res) => {
  try {
    const { device } = req.params;

    const stmt = db.prepare(`
      SELECT * FROM jobs
      WHERE device = ? AND end_time IS NULL
      ORDER BY start_time DESC
      LIMIT 1
    `);

    const job = stmt.get(device);

    if (job) {
      job.conditions = JSON.parse(job.conditions || '{}');
    }

    res.json({ success: true, job });
  } catch (error) {
    console.error('Error fetching active job:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
