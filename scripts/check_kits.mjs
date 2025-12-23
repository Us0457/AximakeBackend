import { supabase } from '../src/lib/supabaseClient.js';

async function checkKits() {
  try {
    const term = 'kits';
    // Try a few fallbacks depending on available columns
    let data = null;

    // 1) try tags/category/type in a single .or (may fail if tags missing)
    try {
      const res = await supabase
        .from('products')
        .select('id,name,category,tags,type,visible')
        .eq('visible', true)
        .or(`tags.ilike.%${term}%,category.ilike.%${term}%,type.ilike.%${term}%`)
        .limit(50);
      if (!res.error && res.data && res.data.length) data = res.data;
    } catch (e) {
      // ignore and try fallbacks
    }

    // 2) fallback: search category only
    if (!data) {
      const res = await supabase
        .from('products')
        .select('id,name,category,type,visible')
        .eq('visible', true)
        .ilike('category', `%${term}%`)
        .limit(50);
      if (!res.error && res.data && res.data.length) data = res.data;
    }

    // 3) fallback: search type only
    if (!data) {
      const res = await supabase
        .from('products')
        .select('id,name,category,type,visible')
        .eq('visible', true)
        .ilike('type', `%${term}%`)
        .limit(50);
      if (!res.error && res.data && res.data.length) data = res.data;
    }

    // 4) fallback: search name/description
    if (!data) {
      const res = await supabase
        .from('products')
        .select('id,name,category,type,visible')
        .eq('visible', true)
        .or(`name.ilike.%${term}%,description.ilike.%${term}%`)
        .limit(50);
      if (!res.error && res.data && res.data.length) data = res.data;
    }

    data = data || [];
    console.log(`Found ${data.length} visible product(s) matching 'kits':`);
    data.slice(0, 20).forEach(p => {
      console.log('-', p.id, '|', p.name, '| category=', p.category, '| type=', p.type);
    });
  } catch (e) {
    console.error('Unexpected error:', e);
    process.exitCode = 1;
  }
}

checkKits();
