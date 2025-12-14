import dotenv from 'dotenv';
dotenv.config();

import { getTracking } from '../src/lib/shiprocketService.js';

const order_id = process.argv[2] || '1319450546889';

(async () => {
  try {
    console.log('Querying Shiprocket for order_id:', order_id);
    const res = await getTracking({ order_id });
    console.log('Result (order_id):', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error fetching tracking by order_id:', err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack);
    process.exitCode = 1;
  }
})();
