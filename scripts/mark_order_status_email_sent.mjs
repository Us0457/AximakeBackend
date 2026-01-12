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

const rowId = process.argv[2] || '2';

(async () => {
  try {
    const { data, error } = await supabase.from('order_status_emails').update({ sent: true, sent_at: new Date().toISOString() }).eq('id', Number(rowId)).select('*');
    if (error) {
      console.error('Update error:', error.message || error);
      process.exit(1);
    }
    if (!data || data.length === 0) {
      console.log('No row updated');
      process.exit(0);
    }
    console.log('Updated row:', JSON.stringify(data[0], null, 2));
  } catch (err) {
    console.error('Unexpected error:', err.message || err);
    process.exit(1);
  }
})();
