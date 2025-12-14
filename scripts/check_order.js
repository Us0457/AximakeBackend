require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const orderCode = process.argv[2] || '13905312';

(async () => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_code', orderCode)
      .limit(1);
    if (error) {
      console.error('Supabase error:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) {
      console.log('No order found for order_code', orderCode);
      process.exit(0);
    }
    console.log(JSON.stringify(data[0], null, 2));
  } catch (err) {
    console.error('Query failed:', err.message || err);
    process.exit(1);
  }
})();
