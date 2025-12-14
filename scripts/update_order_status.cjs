require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

(async () => {
  try {
    const order_code = process.argv[2] || '1373900_150876814';
    const update = { shiprocket_status: 'IN TRANSIT', shiprocket_events: JSON.stringify([{ test: 'manual update' }]) };
    const { data, error } = await supabase.from('orders').update(update).eq('order_code', order_code).select('*');
    if (error) {
      console.error('Update failed:', error);
      process.exit(1);
    }
    console.log('Update result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Script error:', err.message || err);
    process.exit(1);
  }
})();
