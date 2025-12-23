#!/usr/bin/env node
require('dotenv').config();
const fetch = global.fetch || require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:5050/api/shiprocket-webhook';
const TOKEN = process.env.SHIPROCKET_WEBHOOK_TOKEN || 'doyouknowthis';

async function findOrder() {
  // Try shiprocket_awb first
  let res = await supabase.from('orders').select('*').not('shiprocket_awb', 'is', null).limit(1);
  if (res.error) throw res.error;
  if (res.data && res.data.length) return res.data[0];

  // Fallback: shiprocket_order_id
  res = await supabase.from('orders').select('*').not('shiprocket_order_id', 'is', null).limit(1);
  if (res.error) throw res.error;
  return res.data && res.data[0];
}

async function postPayload(payload) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': TOKEN },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  console.log('POST ->', res.status, text);
}

(async () => {
  try {
    console.log('Searching for an order with Shiprocket data...');
    const order = await findOrder();
    if (!order) {
      console.error('No order with shiprocket_awb or shiprocket_order_id found.');
      process.exit(0);
    }
    console.log('Found order:', order.order_code || order.id, 'awb:', order.shiprocket_awb, 'sr_order_id:', order.shiprocket_order_id);

    const payload = {
      awb: order.shiprocket_awb || '',
      courier_name: order.shiprocket_courier || 'Unknown',
      current_status: order.shiprocket_status || 'UNKNOWN',
      current_status_id: 0,
      shipment_status: order.shiprocket_status || 'UNKNOWN',
      shipment_status_id: 0,
      current_timestamp: new Date().toISOString(),
      order_id: order.order_code || order.id,
      sr_order_id: order.shiprocket_order_id || null,
      awb_assigned_date: new Date().toISOString(),
      pickup_scheduled_date: new Date().toISOString(),
      etd: new Date(Date.now()+3*24*3600*1000).toISOString(),
      scans: [
        {
          date: new Date().toISOString().replace(/T/, ' ').replace(/Z$/, ''),
          status: 'X-TEST',
          activity: 'Webhook test - status update',
          location: 'Test Runner',
          'sr-status': 'NA',
          'sr-status-label': 'TEST'
        }
      ],
      is_return: 0,
      channel_id: 0,
      pod_status: 'Not Available',
      pod: 'Not Available'
    };

    console.log('Posting webhook payload for order', payload.order_id);
    await postPayload(payload);

    // fetch and show the row after a short delay
    await new Promise(r => setTimeout(r, 300));
    const { data: after, error: errAfter } = await supabase.from('orders').select('*').eq('order_code', order.order_code).limit(1);
    if (errAfter) console.error('Error fetching order after post:', errAfter);
    else console.log('ORDER ROW AFTER POST:\n', JSON.stringify(after && after[0], null, 2));

  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
