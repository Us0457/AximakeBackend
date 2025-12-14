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
    const order = {
      order_code: '1373900_150876814',
      shiprocket_order_id: 348456385,
      shiprocket_awb: '19041424751540',
      shiprocket_shipment_id: null,
      shiprocket_status: null,
      items: [],
    };

    const { data, error } = await supabase.from('orders').insert(order).select('*').limit(1);
    if (error) {
      console.error('Insert failed:', error);
      process.exit(1);
    }
    console.log('Inserted order:', JSON.stringify(data && data[0] ? data[0] : data, null, 2));
  } catch (err) {
    console.error('Script error:', err.message || err);
    process.exit(1);
  }
})();
