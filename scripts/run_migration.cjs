#!/usr/bin/env node
require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, 'migrations', '001_add_shiprocket_events.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const PG_CONN = process.env.PG_CONNECTION_STRING || process.env.PG_CONN || process.env.DATABASE_URL;

if (!PG_CONN) {
  console.log('No Postgres connection string found in env (PG_CONNECTION_STRING / PG_CONN / DATABASE_URL).');
  console.log('Run the following SQL in your Supabase SQL editor or psql:');
  console.log('---- SQL START ----');
  console.log(sql);
  console.log('---- SQL END ----');
  process.exit(0);
}

try {
  console.log('Applying migration using psql...');
  // Use psql if available
  execSync(`psql "${PG_CONN}" -c "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { stdio: 'inherit' });
  console.log('Migration applied.');
} catch (err) {
  console.error('Failed to run migration via psql:', err.message || err);
  console.log('If psql is not available, please run the SQL from:', sqlPath);
  process.exit(1);
}
