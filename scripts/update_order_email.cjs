require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(2);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const orderCode = process.argv[2];
if (!orderCode) {
  console.error('Usage: node update_order_email.cjs <order_code>');
  process.exit(2);
}
(async () => {
  try {
    const { data: rows, error: fetchErr } = await supabase
      .from('orders')
      .select('*')
      .eq('order_code', orderCode);
    if (fetchErr) throw fetchErr;
    if (!rows || rows.length === 0) {
      console.error('Order not found for', orderCode);
      process.exit(0);
    }
    const order = rows[0];
    let address = order.address || {};
    if (typeof address === 'string') {
      try { address = JSON.parse(address); } catch (e) {}
    }
    const oldEmail = address.email || '';
    let newEmail = oldEmail;
    if (oldEmail && oldEmail.includes('gmailcom')) {
      newEmail = oldEmail.replace('gmailcom', 'gmail.com');
    } else if (oldEmail && /@[^.]+$/.test(oldEmail)) {
      // insert a dot before last three chars if missing (best-effort)
      newEmail = oldEmail.replace(/(\.[^.]{0,}$)/, function(m){ return m; });
    }
    if (newEmail === oldEmail) {
      console.log('No change needed for email:', oldEmail);
    } else {
      address.email = newEmail;
      const { data: updated, error: updErr } = await supabase
        .from('orders')
        .update({ address })
        .eq('order_code', orderCode)
        .select();
      if (updErr) throw updErr;
      console.log(JSON.stringify(updated && updated[0] ? updated[0] : { order_code: orderCode, address }, null, 2));
      process.exit(0);
    }
    console.log(JSON.stringify(order, null, 2));
  } catch (err) {
    console.error('Failed:', err.message || err);
    process.exit(1);
  }
})();
