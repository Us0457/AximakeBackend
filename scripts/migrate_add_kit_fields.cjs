#!/usr/bin/env node
require('dotenv').config();
const { Client } = require('pg');

// This script requires a full Postgres DATABASE_URL in env (e.g. postgres://user:pass@host:5432/dbname)
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in environment. Set DATABASE_URL to your Postgres connection string (postgres://...).');
  process.exit(1);
}

const statements = [
  "ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_description text;",
  "ALTER TABLE public.products ADD COLUMN IF NOT EXISTS difficulty text;",
  "ALTER TABLE public.products ADD COLUMN IF NOT EXISTS specifications text;",
  "ALTER TABLE public.products ADD COLUMN IF NOT EXISTS documentation text;",
  "ALTER TABLE public.products ADD COLUMN IF NOT EXISTS faq text;",
  "ALTER TABLE public.products ADD COLUMN IF NOT EXISTS includes jsonb;",
  "ALTER TABLE public.products ADD COLUMN IF NOT EXISTS outcomes jsonb;"
];

async function migrate() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    for (const sql of statements) {
      console.log('Executing:', sql);
      await client.query(sql);
    }
    console.log('Migration complete: optional kit columns added (or already existed).');
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

migrate();
