import { supabase } from '../src/lib/supabaseClient.js';

async function listProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('Supabase error:', error);
      process.exitCode = 1;
      return;
    }
    console.log(`Found ${data.length} product(s). Showing keys and a sample of each row:`);
    data.forEach((p, idx) => {
      const keys = Object.keys(p).join(', ');
      console.log(`Row ${idx + 1}: keys=(${keys})`);
      console.log(p);
    });
  } catch (e) {
    console.error('Unexpected error:', e);
    process.exitCode = 1;
  }
}

listProducts();
