#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const code = process.argv[2];
if (!code) { console.error('Usage: node scripts/watch_order_changes.mjs <order_code>'); process.exit(2); }
const sup = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

let last = null;

async function fetchOrder() {
  try {
    const { data, error } = await sup.from('orders').select('id,order_code,shiprocket_status,shiprocket_courier,shiprocket_awb,shiprocket_events').eq('order_code', code).maybeSingle();
    if (error) { console.error('Supabase error', error); return; }
    return data || null;
  } catch (e) { console.error('Fetch error', e); return null; }
}

(async function(){
  console.log('Watching order', code, '— polling every 2s. Ctrl-C to stop.');
  while (true) {
    const cur = await fetchOrder();
    if (!cur) { await new Promise(r=>setTimeout(r,2000)); continue; }
    const summary = {
      status: cur.shiprocket_status,
      courier: cur.shiprocket_courier,
      awb: cur.shiprocket_awb,
      eventsCount: Array.isArray(cur.shiprocket_events) ? cur.shiprocket_events.length : 0
    };
    if (!last) {
      console.log('Initial:', JSON.stringify(summary));
      last = JSON.stringify(cur);
    } else {
      const prev = JSON.parse(last);
      if (JSON.stringify(prev.shiprocket_status) !== JSON.stringify(cur.shiprocket_status) ||
          JSON.stringify(prev.shiprocket_events) !== JSON.stringify(cur.shiprocket_events) ||
          JSON.stringify(prev.shiprocket_awb) !== JSON.stringify(cur.shiprocket_awb)) {
        console.log('Change detected at', new Date().toISOString());
        console.log('Status:', cur.shiprocket_status);
        console.log('Courier:', cur.shiprocket_courier);
        console.log('AWB:', cur.shiprocket_awb);
        console.log('Events count:', summary.eventsCount);
        console.log('Latest events (last 3):', (Array.isArray(cur.shiprocket_events) ? cur.shiprocket_events.slice(-3) : []));
        last = JSON.stringify(cur);
      }
    }
    await new Promise(r=>setTimeout(r,2000));
  }
})();
