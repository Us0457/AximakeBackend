#!/usr/bin/env node
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// One-off dedupe script for shiprocket_events
// Usage: NODE_ENV=development node scripts/dedupe_shiprocket_events.mjs <order_code>

const [,, orderCode] = process.argv;
if (!orderCode) {
  console.error('Usage: node scripts/dedupe_shiprocket_events.mjs <order_code>');
  process.exit(2);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(2);
}

async function rpc(path, method='POST', body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch(e){ return text; }
}

function eventKey(e){
  const act = (e && (e.activity || e['sr-status-label'] || e.sr_status_label) || '').toString().trim().toLowerCase();
  const dt = (e && e.date) ? e.date.toString().trim() : '';
  const loc = (e && e.location || '').toString().trim().toLowerCase();
  return `${act}|${dt}|${loc}`;
}

(async ()=>{
  try {
    console.log('Fetching order', orderCode);
    const q = `?order_code=eq.${encodeURIComponent(orderCode)}&select=*`;
    const orders = await rpc(`orders${q}`, 'GET');
    if (!orders || !orders.length) {
      console.error('Order not found');
      process.exit(1);
    }
    const order = orders[0];
    const events = Array.isArray(order.shiprocket_events) ? order.shiprocket_events : [];
    if (!events.length) {
      console.log('No shiprocket_events to dedupe');
      process.exit(0);
    }
    const seen = new Set();
    const deduped = [];
    for (const e of events) {
      const k = eventKey(e);
      if (!seen.has(k)) {
        seen.add(k);
        deduped.push(e);
      }
    }
    if (deduped.length === events.length) {
      console.log('No duplicates found');
      process.exit(0);
    }
    console.log(`Found ${events.length - deduped.length} duplicate(s). Writing back ${deduped.length} events.`);

    const patchBody = { shiprocket_events: deduped };
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(patchBody)
    });
    const patched = await patchRes.json();
    console.log('Patched order:', patched[0]?.id || patched);
    console.log('Done.');
  } catch (e) {
    console.error('Error', e?.message || e);
    process.exit(1);
  }
})();
