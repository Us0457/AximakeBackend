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

async function remove() {
  try {
    const names = ['Arduino Starter IoT Kit', 'Robotics Learning Kit (Beginner)'];
    const { data: found } = await supabase.from('products').select('id,name').in('name', names);
    if (!found || found.length === 0) {
      console.log('No seeded kits found by name.');
      process.exit(0);
    }
    console.log('Found kits to delete:', found.map(f => ({ id: f.id, name: f.name })));
    const ids = found.map(f => f.id);
    const { error } = await supabase.from('products').delete().in('id', ids);
    if (error) {
      console.error('Delete error:', error);
      process.exit(1);
    }
    console.log('Deleted kits:', ids);
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

remove();
