#!/usr/bin/env node
import 'dotenv/config';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(2);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findLastOrder() {
  // Prefer most recent order with shiprocket fields
  const q = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(1);
  if (q.error) throw q.error;
  if (!q.data || q.data.length === 0) return null;
  return q.data[0];
}

(async () => {
  try {
    const order = await findLastOrder();
    if (!order) {
      console.log('No orders found in the `orders` table.');
      process.exit(0);
    }
    // Print a concise set of fields useful for webhook testing
    const out = {
      id: order.id,
      order_code: order.order_code,
      shiprocket_shipment_id: order.shiprocket_shipment_id,
      shiprocket_order_id: order.shiprocket_order_id,
      shiprocket_awb: order.shiprocket_awb,
      shiprocket_courier: order.shiprocket_courier,
      shiprocket_status: order.shiprocket_status,
      created_at: order.created_at,
      customer_email: order.address?.email || null,
      customer_name: order.address?.name || null
    };
    console.log('LATEST ORDER:\n', JSON.stringify(out, null, 2));
  } catch (err) {
    console.error('Error fetching last order:', err.message || err);
    process.exit(1);
  }
})();
