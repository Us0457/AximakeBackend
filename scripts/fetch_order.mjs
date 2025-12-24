import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

(async function(){
  try {
    const sup = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await sup.from('orders')
      .select('id,order_code,shiprocket_shipment_id,shiprocket_awb,shiprocket_order_id,shiprocket_status,shiprocket_events')
      .or('shiprocket_shipment_id.not.is.null,shiprocket_awb.not.is.null,shiprocket_order_id.not.is.null')
      .order('created_at',{ascending:false})
      .limit(1);
    if (error) { console.error('SUPERR', error); process.exit(2); }
    if (!data || data.length === 0) { console.log('NO_ORDER'); process.exit(0); }
    console.log(JSON.stringify(data[0]));
  } catch (e) {
    console.error('ERR', e);
    process.exit(3);
  }
})();
