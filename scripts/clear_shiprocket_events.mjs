#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const code = process.argv[2];
if (!code) { console.error('Usage: node scripts/clear_shiprocket_events.mjs <order_code>'); process.exit(2); }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(3);
}

const sup = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

(async function(){
  try {
    console.log('Clearing shiprocket_events for', code);
    const { data, error } = await sup.from('orders').update({ shiprocket_events: [] }).eq('order_code', code).select().maybeSingle();
    if (error) {
      console.error('Update failed', error);
      process.exit(4);
    }
    console.log('Patched order:', data ? data.id : 'none');
    console.log('Result shiprocket_events:', JSON.stringify(data?.shiprocket_events || null));
  } catch (e) {
    console.error('Unexpected error', e?.message || e);
    process.exit(5);
  }
  process.exit(0);
})();
