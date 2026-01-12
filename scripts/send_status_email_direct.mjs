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

const orderId = process.argv[2] || 'a2b1217f-2f02-43f6-911c-3b4871da08fe';
const status = process.argv[3] || 'in_transit';

(async () => {
  try {
    // fetch order
    const { data: ordData } = await supabase.from('orders').select('*').eq('id', orderId).limit(1);
    const order = ordData && ordData[0];
    if (!order) { console.error('order not found'); process.exit(1); }
    // insert tracking row
    const payload = { order_id: orderId, order_code: order.order_code, status };
    const { data: ins, error: insErr } = await supabase.from('order_status_emails').insert(payload).select('*');
    if (insErr) { console.error('insert error', insErr); process.exit(1); }
    const row = ins[0];
    console.log('Inserted tracking row', row);
    // call php mailer directly
    const phpBase = process.env.VITE_PHP_BASE_URL || 'http://127.0.0.1:8000';
    const phpUrl = phpBase.replace(/\/$/, '') + '/order-status-email.php';
    const body = new URLSearchParams();
    const recipient = order.address?.email || order.customer_email || order.email;
    body.append('to', recipient);
    body.append('name', order.address?.name || order.customer_name || 'Customer');
    body.append('order_id', order.order_code || orderId);
    body.append('status', status);
    body.append('items', JSON.stringify(order.items || []));
    console.log('Calling php mailer at', phpUrl);
    const resp = await fetch(phpUrl, { method: 'POST', body });
    const text = await resp.text();
    console.log('PHP response status', resp.status);
    console.log(text.slice(0, 500));
    // update tracking row with response
    await supabase.from('order_status_emails').update({ error: (resp.ok ? null : `HTTP ${resp.status}`) }).eq('id', row.id);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exit(1);
  }
})();
