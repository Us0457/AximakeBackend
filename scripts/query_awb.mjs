import dotenv from 'dotenv';
dotenv.config();

import { getTracking } from '../src/lib/shiprocketService.js';

const awb = process.argv[2] || '1319450546889';

(async () => {
  try {
    console.log('Querying Shiprocket for AWB:', awb);
    const res = await getTracking({ awb });
    console.log('Result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error fetching tracking:', err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack);
    process.exitCode = 1;
  }
})();
