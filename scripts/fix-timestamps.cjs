const Database = require('better-sqlite3');
const path = require('path');

// Open the database
const dbPath = path.join(__dirname, '..', 'data', 'homecontrol.db');
const db = new Database(dbPath);

try {
  console.log('Fixing timestamps in database...');

  // First, let's see what we're dealing with
  // Fix all records with times >= 13:00 (1 PM or later) on today's date
  // These are UTC times that need to be converted to EST (subtract 5 hours)
  const before = db.prepare(`
    SELECT COUNT(*) as count
    FROM jobs
    WHERE device = 'Office Temperature'
      AND start_time LIKE '2026-01-13%'
      AND start_time >= '2026-01-13 13:00:00'
  `).get();

  console.log(`Found ${before.count} records to fix (UTC times >= 13:00)`);

  if (before.count > 0) {
    // Update start_time and end_time by subtracting 5 hours
    const result = db.prepare(`
      UPDATE jobs
      SET start_time = datetime(start_time, '-5 hours'),
          end_time = datetime(end_time, '-5 hours')
      WHERE device = 'Office Temperature'
        AND start_time LIKE '2026-01-13%'
        AND start_time >= '2026-01-13 13:00:00'
    `).run();

    console.log(`Updated ${result.changes} records`);

    // Show a sample of the updated records
    const sample = db.prepare(`
      SELECT start_time, end_time, session
      FROM jobs
      WHERE device = 'Office Temperature'
      ORDER BY start_time DESC
      LIMIT 5
    `).all();

    console.log('\nSample of updated records:');
    sample.forEach(row => {
      console.log(`  ${row.session}: ${row.start_time}`);
    });
  } else {
    console.log('No records found to update');
  }

} catch (error) {
  console.error('Error fixing timestamps:', error);
  process.exit(1);
} finally {
  db.close();
}

console.log('\nDone!');
