import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../data/homecontrol.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

// Initialize database schema
function initDB() {
  // Jobs table for tracking all device runs
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device TEXT NOT NULL,
      session TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration INTEGER,
      conditions TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Schedules table for pool pump and sprinkler scheduling
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device TEXT NOT NULL UNIQUE,
      config TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // AI decisions table for tracking sprinkler AI calculations
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device TEXT NOT NULL,
      date TEXT NOT NULL,
      duration INTEGER NOT NULL,
      temperature REAL,
      humidity REAL,
      forecast TEXT,
      reasoning TEXT,
      should_water INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(device, date)
    )
  `);

  // Migration: Add should_water column if it doesn't exist
  const columns = db.prepare("PRAGMA table_info(ai_decisions)").all();
  const hasShouldWater = columns.some(col => col.name === 'should_water');
  if (!hasShouldWater) {
    db.exec(`ALTER TABLE ai_decisions ADD COLUMN should_water INTEGER DEFAULT 1`);
  }

  // User feedback table for temperature control learning
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feedback_type TEXT NOT NULL,
      office_temp REAL NOT NULL,
      thermostat_setpoint REAL NOT NULL,
      hvac_mode TEXT,
      temp_change_rate_15min REAL,
      temp_change_rate_30min REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_jobs_device ON jobs(device);
    CREATE INDEX IF NOT EXISTS idx_jobs_start_time ON jobs(start_time DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_decisions_device_date ON ai_decisions(device, date DESC);
    CREATE INDEX IF NOT EXISTS idx_user_feedback_created ON user_feedback(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON user_feedback(feedback_type);
  `);
}

// Initialize on import
initDB();

export default db;
