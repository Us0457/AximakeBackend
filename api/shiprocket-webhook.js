// /api/shiprocket-webhook.js
// Shiprocket Webhook endpoint for real-time status updates
import { createClient } from '@supabase/supabase-js';
import { mapShiprocketStatus } from './shiprocket-status-util.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // If a webhook token is configured, require Shiprocket to send it as `x-api-key`.
  const incomingToken = req.headers['x-api-key'] || req.headers['x_api_key'] || req.headers['authorization'] || null;
  if (process.env.SHIPROCKET_WEBHOOK_TOKEN) {
    if (!incomingToken || String(incomingToken) !== String(process.env.SHIPROCKET_WEBHOOK_TOKEN)) {
      console.warn('Webhook: invalid or missing x-api-key header');
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  // Accept JSON or urlencoded bodies
  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (e) {
      // try urlencoded parsing
      try {
        payload = Object.fromEntries(new URLSearchParams(payload).entries());
      } catch (e2) {
        payload = { raw: req.body };
      }
    }
  }

  // normalize common fields from different Shiprocket webhook shapes
  const shipment_id = payload.shipment_id || payload.shipmentId || payload.data?.shipment_id || payload.data?.shipmentId || payload.shipment?.id || null;
  const order_code = payload.order_id || payload.orderCode || payload.order_code || payload.data?.order_id || payload.data?.order_code || payload.order || null;
  const awb = payload.awb || payload.awb_code || payload.airway_bill || payload.data?.awb || null;
  const rawStatus = payload.current_status || payload.status || payload.data?.current_status || payload.data?.status || null;
  const statusCode = payload.status_code || payload.data?.status_code || null;

  if (!shipment_id && !order_code && !awb) {
    console.warn('Webhook: missing all identifiers in payload', { sample: Object.keys(payload).slice(0, 8) });
    return res.status(200).json({ success: false, message: 'No identifier found in payload' });
  }

  const mappedStatus = mapShiprocketStatus(rawStatus, statusCode);

  // Prepare updates we can store on the order row
  const updates = {};
  if (mappedStatus) updates.shiprocket_status = mappedStatus;
  if (shipment_id) updates.shiprocket_shipment_id = String(shipment_id);
  if (awb) updates.shiprocket_awb = String(awb);
  // Shiprocket sends different kinds of order identifiers. Only store/use
  // `shiprocket_order_id` when it's a numeric ID (bigint). Otherwise treat
  // the incoming value as an `order_code` string and match on `order_code`.
  let srOrderId = null;
  if (payload.sr_order_id || payload.srOrderId || payload.sr_orderId) {
    srOrderId = payload.sr_order_id || payload.srOrderId || payload.sr_orderId;
  } else if (payload.order_id && /^[0-9]+$/.test(String(payload.order_id))) {
    // sometimes Shiprocket posts numeric order ids in `order_id`
    srOrderId = Number(payload.order_id);
  }
  if (srOrderId != null) updates.shiprocket_order_id = srOrderId;
  if (payload.track_url) updates.shiprocket_track_url = payload.track_url;

  // Helper to attempt an update and return whether it matched
  async function tryUpdate(whereClause) {
    const { data, error } = await supabase.from('orders').update(updates).match(whereClause).select('id,order_code');
    if (error) console.error('Webhook update failed', whereClause, error);
    return Array.isArray(data) && data.length > 0 ? data : null;
  }

  // Try matching in a sensible order: explicit order_code -> shipment_id -> awb -> shiprocket_order_id
  if (order_code) {
    const result = await tryUpdate({ order_code: String(order_code) });
    if (result) return res.status(200).json({ success: true, updatedBy: 'order_code', rows: result.length });
  }

  if (shipment_id) {
    const result = await tryUpdate({ shiprocket_shipment_id: String(shipment_id) });
    if (result) return res.status(200).json({ success: true, updatedBy: 'shiprocket_shipment_id', rows: result.length });
  }

  if (awb) {
    const result = await tryUpdate({ shiprocket_awb: String(awb) });
    if (result) return res.status(200).json({ success: true, updatedBy: 'shiprocket_awb', rows: result.length });
  }

  if (srOrderId != null) {
    const result = await tryUpdate({ shiprocket_order_id: srOrderId });
    if (result) return res.status(200).json({ success: true, updatedBy: 'shiprocket_order_id', rows: result.length });
  }

  // No direct match — fetch candidate rows for debugging (non-blocking)
  try {
    const conds = [];
    if (order_code) conds.push(`order_code.eq.${order_code}`);
    if (shipment_id) conds.push(`shiprocket_shipment_id.eq.${String(shipment_id)}`);
    if (awb) conds.push(`shiprocket_awb.eq.${String(awb)}`);
    if (srOrderId != null) conds.push(`shiprocket_order_id.eq.${srOrderId}`);
    let candidates = [];
    if (conds.length) {
      const { data } = await supabase.from('orders').select('id,order_code,shiprocket_shipment_id,shiprocket_awb,shiprocket_order_id').or(conds.join(','));
      candidates = data || [];
    }
    console.warn('Webhook: no matching order found', { order_code, shipment_id, awb, candidatesCount: candidates.length });
  } catch (e) {
    console.warn('Webhook: candidate lookup failed', e?.message || e);
  }

  // Return 200 so Shiprocket doesn't repeatedly retry; include helpful debug info
  return res.status(200).json({ success: false, message: 'No matching order found', order_code, shipment_id, awb });
}
