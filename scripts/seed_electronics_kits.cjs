#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function seed() {
  const kits = [
    {
      name: 'Arduino Starter IoT Kit',
      category: 'IoT Kits',
      price: 2499,
      description: 'A complete starter kit to learn Arduino and build your first IoT projects. Includes sensors, actuators and step-by-step guides. Projects: Weather station, distance sensor alarm, LED notifications and a simple IoT dashboard.',
      images: JSON.stringify([
        '/assets/kits/arduino-starter-1.jpg',
        '/assets/kits/arduino-starter-2.jpg',
        '/assets/kits/arduino-starter-3.jpg'
      ]),
      featured: true,
      visible: true,
      material: 'Electronics components',
      weight: 450,
      dimensions: '25x18x6 cm',
      stock: 25
    },

    {
      name: 'Robotics Learning Kit (Beginner)',
      category: 'Robotics',
      price: 3999,
      description: 'An entry-level robotics kit to build line-following and obstacle-avoiding robots. Great for students and hobbyists. Projects include: line follower, obstacle avoider, and remote control basic bot.',
      images: JSON.stringify([
        '/assets/kits/robotics-kit-1.jpg',
        '/assets/kits/robotics-kit-2.jpg'
      ]),
      featured: false,
      visible: true,
      material: 'Plastic chassis, electronic modules',
      weight: 1200,
      dimensions: '30x20x12 cm',
      stock: 12
    }
  ];

  try {
    const { data, error } = await supabase.from('products').insert(kits).select();
    if (error) {
      console.error('Insert error:', error);
      process.exit(1);
    }
    console.log('Inserted kits:', data.map(d => ({ id: d.id, name: d.name })));
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

seed();
