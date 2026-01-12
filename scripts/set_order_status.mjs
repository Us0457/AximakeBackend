#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(2);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const orderId = process.argv[2] || 'a2b1217f-2f02-43f6-911c-3b4871da08fe';
const status = process.argv[3] || 'Picked Up';

(async () => {
  try {
    const { data, error } = await supabase.from('orders').update({ shiprocket_status: status }).eq('id', orderId).select('*');
    if (error) {
      console.error('Update error:', error.message || error);
      process.exit(1);
    }
    console.log('Updated:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Unexpected error:', err.message || err);
    process.exit(1);
  }
})();
