// /api/shiprocket-webhook.js
// Shiprocket Webhook endpoint for real-time status updates
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { normalizeStatus, isProgressionAllowed, isFinalStatus } from '../src/lib/shiprocket-normalizer.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Accept JSON or urlencoded bodies and parse robustly
  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (e) {
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
    // respond quickly so Shiprocket won't retry repeatedly
    return res.status(200).json({ success: false, message: 'No identifier found in payload' });
  }

  const mappedStatus = normalizeStatus(rawStatus, statusCode);

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
  // Only persist a tracking URL when an AWB is present (tracking becomes available after AWB assignment)
  if (payload.track_url && awb) updates.shiprocket_track_url = payload.track_url;

  // Helper to attempt an update and return whether it matched (non-blocking outer flow)
  async function tryUpdate(whereClause) {
    try {
      // Fetch current status to enforce forward-only transitions
      const { data: existingRows } = await supabase.from('orders').select('id,order_code,shiprocket_status,shiprocket_events').match(whereClause).limit(1);
      const existing = Array.isArray(existingRows) && existingRows.length ? existingRows[0] : null;
      if (existing) {
        const cur = existing.shiprocket_status;
        // Do not overwrite final statuses
        if (isFinalStatus(cur)) {
          console.log('Webhook: current status final, skipping update', { order_code: existing.order_code, cur });
          return null;
        }
        // Enforce forward-only transitions
        if (updates.shiprocket_status && !isProgressionAllowed(cur, updates.shiprocket_status)) {
          console.log('Webhook: progression disallowed (would downgrade), skipping', { order_code: existing.order_code, cur, incoming: updates.shiprocket_status });
          // still allow saving AWB/shipment id and appending scans even if status not allowed
          const nonStatusUpdates = { ...updates };
          delete nonStatusUpdates.shiprocket_status;
          // Handle scans append separately below
          const scansIncoming = payload.scans || payload.tracking_data?.shipment_track || payload.data?.shipment_track || null;
          if (scansIncoming && Array.isArray(scansIncoming) && scansIncoming.length) {
            try {
              const existingEvents = Array.isArray(existing.shiprocket_events) ? existing.shiprocket_events : [];
              const combined = existingEvents.slice();
              const seen = new Set(existingEvents.map(e => {
                const act = (e && (e.activity || e['sr-status-label'] || e.sr_status_label) || '').toString().trim().toLowerCase();
                const dt = (e && e.date) ? e.date.toString().trim() : '';
                const loc = (e && e.location || '').toString().trim().toLowerCase();
                return `${act}|${dt}|${loc}`;
              }));
              for (const s of scansIncoming) {
                const obj = (typeof s === 'string') ? { activity: s } : (s || {});
                const act = (obj.activity || obj['sr-status-label'] || obj.sr_status_label || '').toString().trim().toLowerCase();
                const dt = obj.date ? obj.date.toString().trim() : '';
                const loc = (obj.location || '').toString().trim().toLowerCase();
                const key = `${act}|${dt}|${loc}`;
                if (!seen.has(key)) {
                  combined.push(obj);
                  seen.add(key);
                }
              }
              nonStatusUpdates.shiprocket_events = combined;
            } catch (e) {
              console.warn('Webhook: failed to merge incoming scans', e?.message || e);
            }
          }
          if (Object.keys(nonStatusUpdates).length === 0) return null;
          const { data: d2, error: e2 } = await supabase.from('orders').update(nonStatusUpdates).match(whereClause).select('id,order_code');
          if (e2) console.error('Webhook non-status update failed', whereClause, e2);
          return Array.isArray(d2) && d2.length ? d2 : null;
        }
      }
      // If incoming payload contains scans, merge them with existing events before updating
      if (updates && (payload.scans || payload.tracking_data?.shipment_track || payload.data?.shipment_track)) {
        try {
          const scansIncoming = payload.scans || payload.tracking_data?.shipment_track || payload.data?.shipment_track || [];
          if (Array.isArray(scansIncoming) && scansIncoming.length) {
            const existingEvents = Array.isArray(existing?.shiprocket_events) ? existing.shiprocket_events : [];
            const combined = existingEvents.slice();
            const seen = new Set(existingEvents.map(e => {
              const act = (e && (e.activity || e['sr-status-label'] || e.sr_status_label) || '').toString().trim().toLowerCase();
              const dt = (e && e.date) ? e.date.toString().trim() : '';
              const loc = (e && e.location || '').toString().trim().toLowerCase();
              return `${act}|${dt}|${loc}`;
            }));
            for (const s of scansIncoming) {
              const obj = (typeof s === 'string') ? { activity: s } : (s || {});
              const act = (obj.activity || obj['sr-status-label'] || obj.sr_status_label || '').toString().trim().toLowerCase();
              const dt = obj.date ? obj.date.toString().trim() : '';
              const loc = (obj.location || '').toString().trim().toLowerCase();
              const key = `${act}|${dt}|${loc}`;
              if (!seen.has(key)) {
                combined.push(obj);
                seen.add(key);
              }
            }
            updates.shiprocket_events = combined;
          }
        } catch (e) {
          console.warn('Webhook: failed to merge incoming scans', e?.message || e);
        }
      }
      const { data, error } = await supabase.from('orders').update(updates).match(whereClause).select('id,order_code');
      if (error) {
        console.error('Webhook update failed', whereClause, error);
        return null;
      }
      // Supabase may return an empty `data` array depending on client behavior; don't rely
      // on that to decide whether an update happened. Use the pre-fetched `existing` row
      // as the source of truth for whether we matched a row for this `whereClause`.
      if (Array.isArray(data) && data.length > 0) return data;
      if (existing) return [existing];
      // No existing row and no returned rows -> nothing was updated
      return null;
    } catch (err) {
      console.error('Webhook tryUpdate exception', err?.message || err);
      return null;
    }
  }

  // Authentication check is lightweight; don't block responding to Shiprocket.
  const incomingToken = req.headers['x-api-key'] || req.headers['x_api_key'] || req.headers['authorization'] || null;
  const tokenValid = !process.env.SHIPROCKET_WEBHOOK_TOKEN || (incomingToken && String(incomingToken) === String(process.env.SHIPROCKET_WEBHOOK_TOKEN));

  // Respond quickly (within 5s) to acknowledge receipt, then perform DB work asynchronously.
  res.status(200).json({ success: true, accepted: true, tokenValid });

  if (!tokenValid) {
    console.warn('Webhook: invalid or missing token, skipping DB updates');
    return;
  }

  // Do updates asynchronously without blocking the HTTP response
  (async () => {
    try {
      // Try matching in a sensible order: explicit order_code -> shipment_id -> awb -> shiprocket_order_id
      if (order_code) {
        const result = await tryUpdate({ order_code: String(order_code) });
        if (result) {
          console.log('Webhook: updated by order_code', result.length);
          // Trigger status email flow (idempotent)
          (async () => { try { await triggerStatusEmailForUpdatedRow(result[0], mappedStatus); } catch (e) { console.error('Email trigger failed', e); } })();
          return;
        }
      }

      if (shipment_id) {
        const result = await tryUpdate({ shiprocket_shipment_id: String(shipment_id) });
        if (result) {
          console.log('Webhook: updated by shiprocket_shipment_id', result.length);
          (async () => { try { await triggerStatusEmailForUpdatedRow(result[0], mappedStatus); } catch (e) { console.error('Email trigger failed', e); } })();
          return;
        }
      }

      if (awb) {
        const result = await tryUpdate({ shiprocket_awb: String(awb) });
        if (result) {
          console.log('Webhook: updated by shiprocket_awb', result.length);
          (async () => { try { await triggerStatusEmailForUpdatedRow(result[0], mappedStatus); } catch (e) { console.error('Email trigger failed', e); } })();
          return;
        }
      }

      if (srOrderId != null) {
        const result = await tryUpdate({ shiprocket_order_id: srOrderId });
        if (result) {
          console.log('Webhook: updated by shiprocket_order_id', result.length);
          (async () => { try { await triggerStatusEmailForUpdatedRow(result[0], mappedStatus); } catch (e) { console.error('Email trigger failed', e); } })();
          return;
        }
      }

      // Helper: trigger the idempotent email flow for an updated order row
      async function triggerStatusEmailForUpdatedRow(updatedRow, mappedStatusArg) {
            // write lightweight debug info to public/webhook-debug.log for post-mortem
            const debugPath = path.resolve(process.cwd(), 'public', 'webhook-debug.log');
            const dbg = (tag, obj) => {
              try {
                const line = JSON.stringify({ t: new Date().toISOString(), tag, obj }) + '\n';
                fs.appendFileSync(debugPath, line);
              } catch (e) {
                // ignore
              }
            };
        try {
              dbg('trigger-start', { order: updatedRow.id, mappedStatusArg });
          const orderId = updatedRow.id;
          // Fetch full order row to get recipient and items
          const { data: fullRows, error: fetchErr } = await supabase.from('orders').select('*').eq('id', orderId).limit(1);
          const order = Array.isArray(fullRows) && fullRows.length ? fullRows[0] : null;
          if (!order) {
            console.warn('Email trigger: order row not found', orderId);
            return;
          }

          // Derive recipient email and name from common fields (flexible)
          let recipient = order.email || order.customer_email || order.billing_email || null;
          let recipientName = order.customer_name || order.name || null;
          // Try to extract from address JSON if present
          if (!recipient && order.address) {
            try {
              const addr = (typeof order.address === 'string') ? JSON.parse(order.address) : order.address;
              recipient = recipient || addr?.email || addr?.billing_email || null;
              recipientName = recipientName || addr?.name || null;
            } catch (e) {
              // ignore parse errors
            }
          }
          if (!recipient) {
            console.warn('Email trigger: no recipient email found for order', orderId);
            return;
          }

          // Normalize status into a safe key for DB and PHP handler
          const statusKey = String(mappedStatusArg || '').toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'update';

          // Attempt to insert a tracking row atomically. If unique constraint prevents insert, skip sending.
          const insertPayload = { order_id: orderId, order_code: order.order_code || null, status: statusKey };
          dbg('insert-attempt', insertPayload);
          const { data: insData, error: insErr } = await supabase.from('order_status_emails').insert(insertPayload).select('*');
          if (insErr) {
            dbg('insert-error', insErr);
            const msg = String(insErr.message || insErr).toLowerCase();
            if (msg.includes('duplicate') || msg.includes('unique')) {
              // Already sent or being processed — idempotent skip
              console.log('Email trigger: already recorded, skipping', { orderId, status: statusKey });
              dbg('insert-duplicate', { orderId, status: statusKey });
              return;
            }
            console.error('Email trigger: failed to insert order_status_emails', insErr);
            return;
          }
          const emailRow = Array.isArray(insData) && insData.length ? insData[0] : null;
          dbg('insert-success', emailRow);
          if (!emailRow) {
            console.error('Email trigger: insert did not return row', { orderId, statusKey });
            dbg('insert-no-row', { orderId, statusKey });
            return;
          }

          // Call the existing PHP mailer to send the transactional email (reusing SMTP setup and templates)
          const phpBase = process.env.VITE_PHP_BASE_URL || process.env.PHP_BASE_URL || 'http://127.0.0.1:8000';
          const phpUrl = phpBase.replace(/\/$/, '') + '/order-status-email.php';
          const body = new URLSearchParams();
          body.append('to', recipient);
          body.append('name', recipientName || 'Customer');
          // Always include the canonical order_id (UUID) and, when available, the human-friendly order_code
          body.append('order_id', orderId);
          if (order.order_code) body.append('order_code', order.order_code);
          body.append('status', statusKey);
          body.append('items', JSON.stringify(order.items || []));

          try {
            dbg('calling-php', { phpUrl, to: recipient });
            const headers = {};
            if (process.env.PHP_INVOKE_TOKEN) headers['x-php-invoke-token'] = process.env.PHP_INVOKE_TOKEN;
            const resp = await fetch(phpUrl, { method: 'POST', headers, body });
            const text = await resp.text();
            dbg('php-response', { ok: resp.ok, status: resp.status, text: (text || '').slice(0, 200) });
            if (resp.ok && (text === 'success' || text.includes('success') || text.includes('Thank you'))) {
              // mark sent
              await supabase.from('order_status_emails').update({ sent: true, sent_at: new Date().toISOString() }).eq('id', emailRow.id);
              console.log('Email trigger: sent', { orderId, status: statusKey, to: recipient });
              dbg('email-marked-sent', { emailRowId: emailRow.id });
            } else {
              const errText = text || `HTTP ${resp.status}`;
              await supabase.from('order_status_emails').update({ error: errText }).eq('id', emailRow.id);
              console.error('Email trigger: php mailer returned error', { orderId, status: statusKey, resp: errText });
              dbg('php-error', { orderId, status: statusKey, resp: errText });
            }
          } catch (e) {
            await supabase.from('order_status_emails').update({ error: String(e.message || e) }).eq('id', emailRow.id);
            console.error('Email trigger: failed calling php mailer', e);
            dbg('php-exception', { orderId, err: String(e.message || e) });
          }
        } catch (e) {
          dbg('trigger-exception', { err: String(e.message || e) });
          console.error('Email trigger unexpected error', e);
        }
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
    } catch (e) {
      console.error('Webhook processing failed (async)', e?.message || e);
    }
  })();
  return;
}
