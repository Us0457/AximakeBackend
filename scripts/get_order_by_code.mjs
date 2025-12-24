import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sup = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const code = process.argv[2];
if (!code) { console.error('Usage: node scripts/get_order_by_code.mjs <order_code>'); process.exit(2); }
(async function(){
  try {
    const { data, error } = await sup.from('orders').select('*').eq('order_code', code).maybeSingle();
    if (error) { console.error('SUPERR', error); process.exit(3); }
    console.log(JSON.stringify(data || null, null, 2));
  } catch (e) { console.error('ERR', e); process.exit(4); }
})();
