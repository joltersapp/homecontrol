import express from 'express';
import db from '../db.js';

const router = express.Router();

// Get schedule for a device
router.get('/:device', (req, res) => {
  try {
    const { device } = req.params;

    const stmt = db.prepare(`
      SELECT * FROM schedules
      WHERE device = ?
    `);

    const schedule = stmt.get(device);

    if (schedule) {
      schedule.config = JSON.parse(schedule.config);
    }

    res.json({
      success: true,
      schedule: schedule || null
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create or update schedule for a device
router.post('/:device', (req, res) => {
  try {
    const { device } = req.params;
    const { config } = req.body;

    const stmt = db.prepare(`
      INSERT INTO schedules (device, config, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(device) DO UPDATE SET
        config = excluded.config,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(device, JSON.stringify(config));

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
