// /api/shiprocket-status.js
// POST: { shipment_id, order_code }
// Calls Shiprocket tracking API, updates Supabase, returns latest status
import { getTracking } from '../src/lib/shiprocketService.js';
import { createClient } from '@supabase/supabase-js';
import { normalizeStatus, isProgressionAllowed, isFinalStatus } from '../src/lib/shiprocket-normalizer.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { shipment_id, order_code } = req.body;
  if (!shipment_id || !order_code) {
    return res.status(400).json({ error: 'shipment_id and order_code required' });
  }
  try {
    // Fetch existing order to obtain shiprocket_order_id and last-known values
    const { data: existingRows, error: fetchErr } = await supabase.from('orders').select('id,shiprocket_status,shiprocket_awb,shiprocket_courier,shiprocket_order_id,shiprocket_track_url').eq('order_code', order_code).limit(1);
    if (fetchErr || !existingRows || existingRows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const existing = existingRows[0];

    let tracking = null;
    try {
      if (existing.shiprocket_order_id) {
        tracking = await getTracking({ order_id: String(existing.shiprocket_order_id) });
      } else {
        // No Shiprocket numeric order id available — skip calling tracking endpoints that require order_id
        console.warn('shiprocket-status: missing shiprocket_order_id for', order_code);
      }
    } catch (err) {
      // On tracking failure, do NOT throw 500 — return last known DB status
      console.warn('shiprocket-status: tracking fetch failed', err?.message || err);
      return res.status(200).json({ status: existing.shiprocket_status, awb: existing.shiprocket_awb, courier: existing.shiprocket_courier, order: existing, message: 'Tracking unavailable; returning last known status' });
    }
    // Log the full tracking response for debugging
    console.log('Shiprocket tracking response:', JSON.stringify(tracking, null, 2));
    // Robustly extract status, awb, courier from all possible locations
    // let current_status = tracking.current_status || tracking?.data?.current_status || null;
    // let awb_code = tracking.awb_code || tracking?.data?.awb_code || null;
    // let courier_company_name = tracking.courier_company_name || tracking?.data?.courier_company_name || null;

    let raw_status = tracking?.tracking_data?.shipment_status?.current_status ||
             tracking?.tracking_data?.shipment_track?.[0]?.current_status ||
             tracking?.current_status ||
             null;

    let awb_code = tracking?.tracking_data?.shipment_status?.awb_code ||
           tracking?.tracking_data?.shipment_track?.[0]?.awb_code ||
           tracking?.awb ||
           null;

    let courier_company_name = tracking?.tracking_data?.shipment_status?.courier_company_name ||
                 tracking?.tracking_data?.shipment_track?.[0]?.courier_name ||
                 tracking?.courier_company_name ||
                 null;

    const current_status = normalizeStatus(raw_status, null);

    // Try deeper nested fields (shipment_track array)
    const trackArr = tracking?.data?.shipment_track || tracking?.shipment_track;
    if (Array.isArray(trackArr) && trackArr.length > 0) {
      // prefer normalized values from the most recent scan
      const scanStatus = trackArr[0].current_status || null;
      if (scanStatus) {
        // normalize again
        // Note: current_status already normalized above from raw_status
      }
      awb_code = trackArr[0].awb_code || awb_code;
      courier_company_name = trackArr[0].courier_name || courier_company_name;
    }

    // existing row was already fetched above to obtain shiprocket_order_id and last-known values

    const updates = {};
    // AWB assignment is allowed whenever present (and may enable tracking)
    if (awb_code) updates.shiprocket_awb = String(awb_code);
    if (courier_company_name) updates.shiprocket_courier = courier_company_name;

    // Only set status when it is allowed by progression rules and not overwriting a final state
    if (current_status) {
      const cur = existing ? existing.shiprocket_status : null;
      if (!cur || (!isFinalStatus(cur) && isProgressionAllowed(cur, current_status))) {
        updates.shiprocket_status = current_status;
      } else {
        console.log('Status update skipped to avoid downgrade or overwrite of final status', { order_code, cur, incoming: current_status });
      }
    }

    // Only store tracking URL if AWB exists (do not assume tracking URL at order creation)
    if (awb_code && tracking?.tracking_data?.track_url) {
      updates.shiprocket_track_url = tracking.tracking_data.track_url;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(200).json({ status: current_status, awb: awb_code, courier: courier_company_name, order: existing || null, message: 'No updates needed' });
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('order_code', order_code)
      .select();
    if (error) {
      return res.status(500).json({ error: 'Failed to update order with Shiprocket status', details: error });
    }
    return res.status(200).json({ status: updates.shiprocket_status || current_status, awb: awb_code, courier: courier_company_name, order: data && data[0] ? data[0] : existing });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
