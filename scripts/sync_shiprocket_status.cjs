require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const API_BASE = process.env.SYNC_API_BASE || 'http://127.0.0.1:5050';

(async () => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id,order_code,shiprocket_shipment_id,shiprocket_awb,shiprocket_status')
      .not('shiprocket_shipment_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    console.log(`Found ${orders.length} orders with shiprocket_shipment_id. Running sync...`);
    let success = 0;
    for (const o of orders) {
      const body = { shipment_id: String(o.shiprocket_shipment_id), order_code: o.order_code };
      try {
        const res = await fetch(`${API_BASE}/api/shiprocket-status`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          // determine canonical status and awb from API response
          const newStatus = data.status || data.shipment_status || null;
          const newAwb = data.awb || data.tracking_number || o.shiprocket_awb || null;

          // only update DB if something changed
          const updates = {};
          if (newStatus !== null && newStatus !== o.shiprocket_status) updates.shiprocket_status = newStatus;
          if (newAwb !== null && newAwb !== o.shiprocket_awb) updates.shiprocket_awb = newAwb;

          if (Object.keys(updates).length > 0) {
            try {
              const { error: upErr } = await supabase
                .from('orders')
                .update(updates)
                .eq('id', o.id);
              if (upErr) {
                console.error(`DB update failed for ${o.order_code}:`, upErr.message || upErr);
              } else {
                console.log(`DB updated for ${o.order_code}:`, updates);
              }
            } catch (dbErr) {
              console.error(`DB update exception for ${o.order_code}:`, dbErr.message || dbErr);
            }
          } else {
            console.log(`OK (no change): ${o.order_code} -> ${newStatus || 'no-status'} (awb=${newAwb || o.shiprocket_awb})`);
          }

          success++;
        } else {
          console.warn(`ERR: ${o.order_code} -> ${res.status} ${JSON.stringify(data)}`);
        }
      } catch (e) {
        console.error('Fetch failed for', o.order_code, e.message || e);
      }
    }
    console.log(`Sync complete. ${success}/${orders.length} requests succeeded.`);
    process.exit(0);
  } catch (err) {
    console.error('Sync failed:', err.message || err);
    process.exit(1);
  }
})();
