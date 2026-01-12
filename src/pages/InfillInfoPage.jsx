import React from 'react';
import { Link } from 'react-router-dom';

const InfillInfoPage = () => {
  return (
    <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-10 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">About Infill</h1>
      <p className="text-sm text-gray-700 mb-3">Infill controls how much material is used inside your 3D print. It affects strength, weight, and print time. Below are simple guidelines to help you choose:</p>
      <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700 mb-4">
        <li><strong>20% — Lightweight & Decorative</strong>: Good for models where visual appearance matters more than strength, such as display pieces or prototypes.</li>
        <li><strong>40% — Balanced</strong>: A good all-purpose choice for most consumer prints where you want a balance between strength and material use.</li>
        <li><strong>50%+</strong> — Strong & Functional: Choose higher infill for parts that need to bear load, fastenings, or functional use.</li>
      </ul>
      <p className="text-sm text-gray-700">If you're unsure, start with the <strong>Balanced (40%)</strong> option. Our team can advise for manufacturing-sensitive parts if you request a quote.</p>
      <div className="mt-6">
        <Link to="/custom-print" className="text-primary hover:underline">← Back to Custom Print</Link>
      </div>
    </div>
  );
};

export default InfillInfoPage;
