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

const orderCode = process.argv[2] || 'AXMK-26TNKBZ2';

(async () => {
  try {
    const { data, error } = await supabase
      .from('order_status_emails')
      .select('*')
      .eq('order_code', orderCode)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) {
      console.error('Error querying order_status_emails:', error.message || error);
      process.exit(1);
    }
    if (!data || data.length === 0) {
      console.log('No order_status_emails rows found for', orderCode);
      process.exit(0);
    }
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Unexpected error:', err.message || err);
    process.exit(1);
  }
})();
