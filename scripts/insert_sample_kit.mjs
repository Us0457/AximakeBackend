import { supabase } from '../src/lib/supabaseClient.js';

async function insertKit() {
  try {
    const sample = {
      name: 'Starter Arduino Kit',
      description: 'All-in-one beginner Arduino kit with sensors, breadboard, and guides.',
      category: 'Kits',
      tags: ['kits', 'arduino', 'starter'],
      price: 2499,
      visible: true,
      featured: false,
      images: JSON.stringify(['/assets/categories/Kit.jpg']),
      image_url: '/assets/categories/Kit.jpg'
    };

    const { data, error } = await supabase.from('products').insert([sample]).select();
    if (error) {
      console.error('Insert error:', error);
      process.exitCode = 1;
      return;
    }
    console.log('Inserted product:', data && data[0] ? data[0].id : data);
  } catch (e) {
    console.error('Unexpected error:', e);
    process.exitCode = 1;
  }
}

insertKit();
