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

(async () => {
  try {
    const payload = { order_id: 'a2b1217f-2f02-43f6-911c-3b4871da08fe', order_code: 'AXMK-26TNKBZ2', status: 'delivered' };
    const { data, error } = await supabase.from('order_status_emails').insert(payload).select('*');
    if (error) {
      console.error('Insert error:', error);
      process.exit(1);
    }
    console.log('Insert success:', data);
  } catch (err) {
    console.error('Unexpected error:', err.message || err);
    process.exit(1);
  }
})();
