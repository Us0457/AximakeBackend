#!/usr/bin/env node
import 'dotenv/config';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const API_BASE = process.env.VITE_API_BASE_URL || 'http://localhost:5050';

async function run() {
  const order_code = `TEST-WEBHOOK-${Date.now()}`;
  console.log('Creating test order with order_code=', order_code);
  const payload = {
    user_id: null,
    order_code,
    order_status: 'New',
    price: 0,
    items: [],
    created_at: new Date().toISOString()
  };

  const { data: created, error: insertErr } = await supabase.from('orders').insert(payload).select().maybeSingle();
  if (insertErr) {
    console.error('Failed to create test order:', insertErr);
    process.exit(2);
  }
  console.log('Inserted order id=', created.id);

  // Prepare a webhook payload (mock Shiprocket shape)
  const shipment_id = `SHIP-${Date.now()}`;
  const awb = `AWB-${Math.random().toString(36).slice(2,9).toUpperCase()}`;
  const webhook = {
    order_id: order_code, // some shapes use order_id as order_code string
    order_code,
    shipment_id,
    awb,
    current_status: 'Manifest Created',
    scans: [
      { activity: 'Manifest Created', date: new Date().toISOString(), location: 'Warehouse' }
    ]
  };

  console.log('POSTing webhook to', `${API_BASE}/api/shiprocket-webhook`);
  const res = await fetch(`${API_BASE}/api/shiprocket-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhook)
  });
  console.log('Webhook POST status:', res.status);
  const j = await res.text();
  console.log('Webhook response:', j.slice(0, 1000));

  // Wait a short time for async processing
  await new Promise(r => setTimeout(r, 1500));

  const { data: row } = await supabase.from('orders').select('id,order_code,shiprocket_shipment_id,shiprocket_awb,shiprocket_status,shiprocket_events').eq('order_code', order_code).maybeSingle();
  console.log('Order row after webhook:', {
    shiprocket_shipment_id: row?.shiprocket_shipment_id,
    shiprocket_awb: row?.shiprocket_awb,
    shiprocket_status: row?.shiprocket_status,
    events_count: Array.isArray(row?.shiprocket_events) ? row.shiprocket_events.length : 0
  });

  // Trigger AWB refresh endpoint (admin-style) to verify polling fallback returns safely
  console.log('Calling /api/shiprocket-status (will return last-known state if tracking unavailable)');
  try {
    const res2 = await fetch(`${API_BASE}/api/shiprocket-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipment_id, order_code })
    });
    console.log('/api/shiprocket-status status:', res2.status);
    const jb = await res2.text();
    console.log('/api/shiprocket-status body:', jb.slice(0, 1000));
  } catch (e) {
    console.warn('shiprocket-status call failed:', e.message || e);
  }

  // Cleanup: delete created order
  console.log('Cleaning up test order...');
  await supabase.from('orders').delete().eq('order_code', order_code);
  console.log('Done.');
}

run().catch(e => { console.error('Test failed:', e); process.exit(10); });
