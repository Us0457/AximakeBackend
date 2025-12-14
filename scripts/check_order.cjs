require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const field = process.argv[2] || 'order_code';
const value = process.argv[3] || '13905312';

(async () => {
  try {
    let data, error;
    if (field === '__not_null__') {
      ({ data, error } = await supabase
        .from('orders')
        .select('*')
        .not(value, 'is', null)
        .limit(20));
    } else {
      ({ data, error } = await supabase
        .from('orders')
        .select('*')
        .eq(field, value)
        .limit(1));
    }
    if (error) {
      console.error('Supabase error:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) {
      console.log('No order found for', field, value);
      process.exit(0);
    }
    console.log(JSON.stringify(data[0], null, 2));
  } catch (err) {
    console.error('Query failed:', err.message || err);
    process.exit(1);
  }
})();
