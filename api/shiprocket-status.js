// /api/shiprocket-status.js
// POST: { shipment_id, order_code }
// Calls Shiprocket tracking API, updates Supabase, returns latest status
import { getShipmentStatus } from '../src/lib/shiprocketService.js';
import { createClient } from '@supabase/supabase-js';

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
    let tracking;
    try {
      tracking = await getShipmentStatus(shipment_id);
    } catch (err) {
      // If Shiprocket returns 404, do NOT update the status, just return the last known status
      if (err.message && err.message.includes('404')) {
        // Fetch the current order from DB and return its status
        const { data: orders, error } = await supabase
          .from('orders')
          .select('shiprocket_status, shiprocket_awb, shiprocket_courier')
          .eq('order_code', order_code)
          .limit(1);
        if (error || !orders || orders.length === 0) {
          return res.status(404).json({ error: 'Order not found' });
        }
        return res.status(200).json({
          status: orders[0].shiprocket_status,
          awb: orders[0].shiprocket_awb,
          courier: orders[0].shiprocket_courier,
          order: orders[0]
        });
      }
      // For other errors, return 500
      return res.status(500).json({ error: err.message });
    }
    // Log the full tracking response for debugging
    console.log('Shiprocket tracking response:', JSON.stringify(tracking, null, 2));
    // Robustly extract status, awb, courier from all possible locations
    // let current_status = tracking.current_status || tracking?.data?.current_status || null;
    // let awb_code = tracking.awb_code || tracking?.data?.awb_code || null;
    // let courier_company_name = tracking.courier_company_name || tracking?.data?.courier_company_name || null;

    let current_status = tracking?.tracking_data?.shipment_status?.current_status ||
                     tracking?.tracking_data?.shipment_track?.[0]?.current_status ||
                     "Pending";

    let awb_code = tracking?.tracking_data?.shipment_status?.awb_code ||
               tracking?.tracking_data?.shipment_track?.[0]?.awb_code ||
               null;

    let courier_company_name = tracking?.tracking_data?.shipment_status?.courier_company_name ||
                           tracking?.tracking_data?.shipment_track?.[0]?.courier_name ||
                           null;

    // Try deeper nested fields (shipment_track array)
    const trackArr = tracking?.data?.shipment_track || tracking?.shipment_track;
    if (Array.isArray(trackArr) && trackArr.length > 0) {
      current_status = trackArr[0].current_status || current_status;
      awb_code = trackArr[0].awb_code || awb_code;
      courier_company_name = trackArr[0].courier_name || courier_company_name;
    }
    // Update order in Supabase
    const { data, error } = await supabase
      .from('orders')
      .update({
        shiprocket_status: current_status,
        shiprocket_awb: awb_code,
        shiprocket_courier: courier_company_name
      })
      .eq('order_code', order_code)
      .select();
    if (error) {
      return res.status(500).json({ error: 'Failed to update order with Shiprocket status', details: error });
    }
    return res.status(200).json({ status: current_status, awb: awb_code, courier: courier_company_name, order: data[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
