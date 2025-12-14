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
  const name = process.argv[2] || 'Raspberry Pi 4 Model B – Starter Kit (4GB)';
  const { data } = await supabase.from('products').select('*').ilike('name', `%${name}%`).limit(10);
  if (!data || data.length === 0) {
    console.log('No product found'); process.exit(0);
  }
  const p = data[0];
  console.log('Product category:', p.category);
  function isKitProduct(p) {
    if (!p) return false;
    const ELECTRONICS_CATEGORIES = ['Arduino Kits', 'IoT Kits', 'Beginner Kits', 'Sensors', 'Robotics', 'Learning Projects', 'Advanced Kits'];
    if (p.category && ELECTRONICS_CATEGORIES.includes(p.category)) return true;
    if (p.category && typeof p.category === 'string') {
      const cat = p.category.toLowerCase();
      const keywords = ['kit', 'kits', 'arduino', 'raspberry', 'raspberrypi', 'raspberry pi', 'iot', 'robot', 'robotics'];
      for (const kw of keywords) if (cat.includes(kw)) return true;
    }
    if (p.short_description) return true;
    if (p.difficulty) return true;
    if (p.includes && (Array.isArray(p.includes) ? p.includes.length > 0 : String(p.includes).trim() !== '' && String(p.includes) !== '[]')) return true;
    if (p.outcomes && (Array.isArray(p.outcomes) ? p.outcomes.length > 0 : String(p.outcomes).trim() !== '' && String(p.outcomes) !== '[]')) return true;
    return false;
  }
  console.log('isKitProduct =>', isKitProduct(p));
  console.log('fields: short_description,difficulty,includes,outcomes:');
  console.log(p.short_description, p.difficulty, p.includes ? (Array.isArray(p.includes) ? p.includes.length+' items' : p.includes) : null, p.outcomes ? (Array.isArray(p.outcomes) ? p.outcomes.length+' items' : p.outcomes) : null);
})();
