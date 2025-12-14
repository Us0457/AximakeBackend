// /api/create-shiprocket-order.js
// Receives order data, creates Shiprocket order, updates DB, returns shipment info
import { createShipment, getShipmentStatus } from '../src/lib/shiprocketService.js';
import { createClient } from '@supabase/supabase-js';
import { mapShiprocketStatus } from './shiprocket-status-util.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const order = req.body;
    // Call Shiprocket
    const shipment = await createShipment(order);

    // Fetch latest tracking info from Shiprocket
    let latestStatus = shipment.status;
    let latestStatusCode = null;
    try {
      const tracking = await getShipmentStatus(shipment.shipment_id);
      // Try to extract status and code from tracking response
      latestStatus = tracking?.tracking_data?.shipment_track?.[0]?.current_status ||
                     tracking?.tracking_data?.shipment_status?.current_status ||
                     latestStatus;
      latestStatusCode = tracking?.tracking_data?.shipment_track?.[0]?.status_code ||
                        tracking?.tracking_data?.status_code || null;
      latestStatus = mapShiprocketStatus(latestStatus, latestStatusCode);
    } catch (e) {
      // fallback: use shipment.status
    }
    // Update order in Supabase with Shiprocket details and latest status
    const { data, error } = await supabase
      .from('orders')
      .update({
        shiprocket_shipment_id: shipment.shipment_id,
        shiprocket_awb: shipment.awb,
        shiprocket_courier: shipment.courier,
        shiprocket_status: latestStatus,
        shiprocket_label_url: shipment.label_url
      })
      .eq('order_code', order.order_code)
      .select('id, user_id, created_at, price, order_status, items, address, order_code, discount_amount, total, sub_total, shiprocket_shipment_id, shiprocket_awb, shiprocket_status, shiprocket_label_url');
    if (error) {
      return res.status(500).json({ error: 'Failed to update order with Shiprocket details', details: error });
    }
    return res.status(200).json({ shipment, order: data[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
