// /api/shiprocket-invoice.js
// Usage: /api/shiprocket-invoice?shipment_id=... (GET or POST)
import { getInvoiceUrlByOrderId, getShipmentStatus } from '../src/lib/shiprocketService.js';
import { createClient } from '@supabase/supabase-js';
import { normalizeStatus, isProgressionAllowed, isFinalStatus } from '../src/lib/shiprocket-normalizer.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  // Accept both GET and POST for flexibility
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  let shipment_id = req.query?.shipment_id || req.body?.shipment_id || null;
  if (!shipment_id && req.url) {
    // Try to extract from /api/shiprocket-invoice/<shipment_id>
    const match = req.url.match(/shiprocket-invoice\/?([\w-]+)/);
    if (match && match[1]) shipment_id = match[1];
  }
  if (!shipment_id) {
    return res.status(400).json({ error: 'shipment_id required' });
  }
  try {
    // Look up order_id from DB using shipment_id
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_code, shiprocket_shipment_id, shiprocket_order_id')
      .eq('shiprocket_shipment_id', shipment_id)
      .limit(1);
    if (error || !orders || orders.length === 0) {
      return res.status(404).json({ error: 'Order not found for this shipment_id' });
    }
    const order = orders[0];
    const order_id = order.shiprocket_order_id;
    if (!order_id) {
      return res.status(400).json({ error: 'No shiprocket_order_id found for this shipment_id' });
    }
    // Call Shiprocket API to get invoice_url
    const invoice_url = await getInvoiceUrlByOrderId(order_id);
    // Fetch latest tracking info from Shiprocket
    let latestStatus = 'INVOICED';
    let latestStatusCode = null;
    try {
      const tracking = await getTracking({ order_id: String(order_id) });
      latestStatus = tracking?.tracking_data?.shipment_track?.[0]?.current_status ||
                     tracking?.tracking_data?.shipment_status?.current_status ||
                     latestStatus;
      latestStatusCode = tracking?.tracking_data?.shipment_track?.[0]?.status_code ||
                        tracking?.tracking_data?.status_code || null;
      latestStatus = normalizeStatus(latestStatus, latestStatusCode);
    } catch (e) {
      // fallback: use 'INVOICED' and do not throw — preserve existing DB state
      console.warn('shiprocket-invoice: tracking fetch failed', e?.message || e);
    }
    // Update order status in DB to latest status, but enforce forward-only transitions
    const { data: existingRows } = await supabase.from('orders').select('id,shiprocket_status,order_status').eq('shiprocket_shipment_id', shipment_id).limit(1);
    const existing = Array.isArray(existingRows) && existingRows.length ? existingRows[0] : null;
    const updates = {};
    if (existing) {
      if (!isFinalStatus(existing.shiprocket_status) && isProgressionAllowed(existing.shiprocket_status, latestStatus)) {
        updates.shiprocket_status = latestStatus;
        updates.order_status = latestStatus;
      }
    } else {
      updates.shiprocket_status = latestStatus;
      updates.order_status = latestStatus;
    }
    if (Object.keys(updates).length) {
      await supabase.from('orders').update(updates).eq('shiprocket_shipment_id', shipment_id);
    }
    // Return invoice_url to frontend
    return res.status(200).json({ invoice_url });
  } catch (err) {
    console.error('Shiprocket invoice error for shipment_id', shipment_id, ':', err);
    res.status(500).json({ error: 'Invoice download failed: ' + (err.message || err) });
  }
}
