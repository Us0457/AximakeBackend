#!/usr/bin/env node
require('dotenv').config();
(function guard() {
  try {
    if (process.env.NODE_ENV && String(process.env.NODE_ENV).toLowerCase() === 'production') {
      console.error('remake_shiprocket_payload.cjs is a dev-only script and will not run in production (NODE_ENV=production)');
      process.exit(0);
    }
  } catch (e) {}
})();
(async () => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
      process.exit(2);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Find latest order with any Shiprocket identifier
    const { data: rows, error } = await supabase
      .from('orders')
      .select('*')
      .or('shiprocket_shipment_id.not.is.null,shiprocket_awb.not.is.null,shiprocket_order_id.not.is.null')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    if (!rows || rows.length === 0) {
      console.log('No orders with Shiprocket identifiers found in DB.');
      process.exit(0);
    }
    const order = rows[0];
    console.log('Found order:', { id: order.id, order_code: order.order_code, shiprocket_shipment_id: order.shiprocket_shipment_id, shiprocket_awb: order.shiprocket_awb, shiprocket_order_id: order.shiprocket_order_id });

    // Import shiprocket service dynamically (it is an ESM module)
    const svc = await import('../src/lib/shiprocketService.js');

    // Try multiple identifiers to fetch tracking from Shiprocket
    let tracking = null;
    try {
      if (order.shiprocket_order_id) {
        tracking = await svc.getTracking({ order_id: order.shiprocket_order_id });
        console.log('Fetched tracking by shiprocket_order_id');
      }
    } catch (e) {
      console.warn('Tracking by shiprocket_order_id failed:', e.message || e);
    }
    if (!tracking && order.shiprocket_awb) {
      try {
        tracking = await svc.getTracking({ awb: String(order.shiprocket_awb) });
        console.log('Fetched tracking by AWB');
      } catch (e) {
        console.warn('Tracking by AWB failed:', e.message || e);
      }
    }
    if (!tracking && order.shiprocket_shipment_id) {
      try {
        tracking = await svc.getShipmentStatus(order.shiprocket_shipment_id);
        console.log('Fetched tracking by shipment_id');
      } catch (e) {
        console.warn('Tracking by shipment_id failed:', e.message || e);
      }
    }

    if (!tracking) {
      console.error('Unable to fetch tracking from Shiprocket for this order.');
      process.exit(1);
    }

    // Normalize common fields
    const normalizer = await import('../src/lib/shiprocket-normalizer.js');
    const normalizeStatus = normalizer.normalizeStatus || normalizer.default?.normalizeStatus;
    const isProgressionAllowed = normalizer.isProgressionAllowed || normalizer.default?.isProgressionAllowed;
    const isFinalStatus = normalizer.isFinalStatus || normalizer.default?.isFinalStatus;

    const normalized = {
      local_order_id: order.id,
      order_code: order.order_code || null,
      shiprocket_shipment_id: order.shiprocket_shipment_id || null,
      shiprocket_order_id: order.shiprocket_order_id || null,
      awb: order.shiprocket_awb || (tracking?.tracking_data?.shipment_status?.awb_code) || (tracking?.awb) || null,
      shiprocket_status: normalizeStatus(tracking?.tracking_data?.shipment_status?.current_status || tracking?.tracking_data?.shipment_status || tracking?.current_status || null),
      courier: tracking?.tracking_data?.shipment_status?.courier_company_name || tracking?.tracking_data?.shipment_track?.[0]?.courier_name || null,
      track_url: tracking?.tracking_data?.track_url || null,
      scans: tracking?.tracking_data?.shipment_track || tracking?.shipment_track || tracking?.scans || [] ,
      raw: tracking
    };

    console.log('Normalized payload:\n', JSON.stringify(normalized, null, 2));

    // Optionally: update DB with normalized values
    const doUpdate = process.argv.includes('--update');
    if (doUpdate) {
      const updates = {};
      if (normalized.awb) updates.shiprocket_awb = String(normalized.awb);
      // Only update status if progression allows
      try {
        const { data: existingRows } = await supabase.from('orders').select('id,shiprocket_status,shiprocket_awb').eq('id', order.id).limit(1);
        const existing = Array.isArray(existingRows) && existingRows.length ? existingRows[0] : null;
        if (normalized.shiprocket_status) {
          if (!existing || (!isFinalStatus(existing.shiprocket_status) && isProgressionAllowed(existing.shiprocket_status, normalized.shiprocket_status))) {
            updates.shiprocket_status = normalized.shiprocket_status;
          } else {
            console.log('Remake payload: skipping status update to avoid downgrade or final overwrite', { id: order.id, cur: existing && existing.shiprocket_status, incoming: normalized.shiprocket_status });
          }
        }
      } catch (e) {
        console.warn('Remake payload: failed to check existing status', e?.message || e);
        if (normalized.shiprocket_status) updates.shiprocket_status = normalized.shiprocket_status;
      }
      if (normalized.courier) updates.shiprocket_courier = normalized.courier;
      // Only save tracking link if awb exists
      if (normalized.awb && normalized.track_url) updates.shiprocket_track_url = normalized.track_url;
      if (Object.keys(updates).length > 0) {
        const { data: ud, error: updErr } = await supabase.from('orders').update(updates).eq('id', order.id).select();
        if (updErr) console.error('DB update failed:', updErr);
        else console.log('DB updated:', ud && ud[0]);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Failed:', err.message || err);
    process.exit(1);
  }
})();
