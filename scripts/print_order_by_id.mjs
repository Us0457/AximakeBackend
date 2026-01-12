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

(async () => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .limit(1);
    if (error) {
      console.error('Error querying orders:', error.message || error);
      process.exit(1);
    }
    if (!data || data.length === 0) {
      console.log('No order found for', orderId);
      process.exit(0);
    }
    console.log(JSON.stringify(data[0], null, 2));
  } catch (err) {
    console.error('Unexpected error:', err.message || err);
    process.exit(1);
  }
})();
