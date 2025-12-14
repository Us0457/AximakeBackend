#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
(async () => {
  try {
    const name = process.argv[2] || 'Raspberry Pi 4 Model B – Starter Kit (4GB)';
    console.log('Searching for product name like:', name);
    const { data, error } = await supabase.from('products').select('*').ilike('name', `%${name}%`).limit(10);
    if (error) {
      console.error('Error querying:', error);
      process.exit(1);
    }
    console.log('Found:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
