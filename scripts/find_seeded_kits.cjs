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
async function find() {
  try {
    const names = ['Arduino Starter IoT Kit', 'Robotics Learning Kit (Beginner)'];
    const { data: byName } = await supabase.from('products').select('id,name,category,visible').in('name', names);
    console.log('By exact name:', byName || []);
    const { data: byLike } = await supabase.from('products').select('id,name,category,visible').or("name.ilike.%Arduino%", { count: 'exact' });
    console.log('By Arduino ilike:', byLike || []);
    const { data: byCategories } = await supabase.from('products').select('id,name,category,visible').in('category', ['Robotics','IoT Kits','Arduino Kits']);
    console.log('By categories:', byCategories || []);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
find();
