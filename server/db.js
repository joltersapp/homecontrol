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

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_jobs_device ON jobs(device);
    CREATE INDEX IF NOT EXISTS idx_jobs_start_time ON jobs(start_time DESC);
  `);
}

// Initialize on import
initDB();

export default db;
