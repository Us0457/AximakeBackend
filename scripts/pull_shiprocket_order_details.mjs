import dotenv from 'dotenv';
dotenv.config();

import {
  getTracking,
  getShipmentStatus,
  getLabel,
  getInvoiceUrlByOrderId
} from '../src/lib/shiprocketService.js';

const order_id = process.argv[2] || '1082829668';
const shipment_id = process.argv[3] || '1079202503';

(async () => {
  try {
    console.log('Fetching Shiprocket details for order_id=', order_id, 'shipment_id=', shipment_id);

    console.log('\n1) getTracking(order_id)');
    try {
      const tracking = await getTracking({ order_id });
      console.log('tracking:', JSON.stringify(tracking, null, 2));
    } catch (e) {
      console.error('getTracking(order_id) failed:', e && e.message ? e.message : e);
    }

    console.log('\n2) getShipmentStatus(shipment_id)');
    try {
      const status = await getShipmentStatus(shipment_id);
      console.log('shipmentStatus:', JSON.stringify(status, null, 2));
    } catch (e) {
      console.error('getShipmentStatus failed:', e && e.message ? e.message : e);
    }

    console.log('\n3) getLabel(shipment_id)');
    try {
      const label = await getLabel(shipment_id).catch(err => { throw err; });
      console.log('label result:', JSON.stringify(label, null, 2));
    } catch (e) {
      console.error('getLabel failed or not available:', e && e.message ? e.message : e);
    }

    console.log('\n4) getInvoiceUrlByOrderId(order_id)');
    try {
      const invoiceUrl = await getInvoiceUrlByOrderId(order_id);
      console.log('invoiceUrl:', invoiceUrl);
    } catch (e) {
      console.error('getInvoiceUrlByOrderId failed:', e && e.message ? e.message : e);
    }

    console.log('\nDone.');
  } catch (err) {
    console.error('Unexpected error:', err && err.message ? err.message : err);
    process.exitCode = 1;
  }
})();
