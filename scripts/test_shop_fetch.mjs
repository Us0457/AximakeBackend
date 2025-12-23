import { supabase } from '../src/lib/supabaseClient.js';

const rows = [
  { key: 'electronic-kits', title: 'Electronic Kits', filterCandidates: ['kits', 'kit', 'electronic kit'] },
  { key: 'hobby-makers', title: 'Hobby & Makers', filterCandidates: ['hobby', 'maker', 'makers'] },
  { key: 'home-decor', title: 'Home & Decor', filterCandidates: ['home', 'decor'] },
];

async function run() {
  for (const row of rows) {
    let data = [];
    for (const term of row.filterCandidates) {
      try {
        const { data: d, error } = await supabase
          .from('products')
          .select('*')
          .eq('visible', true)
          .or(`category.ilike.%${term}%`) // narrow to category first
          .limit(24);
        if (!error && d && d.length) {
          data = d;
          break;
        }
      } catch (e) {
        // ignore
      }
    }
    console.log(row.title, '=>', data.length, 'products');
  }
}

run();
