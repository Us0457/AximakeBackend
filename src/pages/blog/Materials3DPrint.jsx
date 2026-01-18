import React from 'react';
import BlogLayout from '@/components/BlogLayout';

const Materials3DPrint = () => {
  return (
    <BlogLayout
      title="Which 3D printing material should I choose for my application?"
      readingTime="5 min"
      description="Match material to strength, temperature resistance, finish, and cost. This guide helps you choose between PLA, PETG, ABS, resins and more."
      metaDescription="Material selection guide for 3D printing: PLA, PETG, ABS, resins — when to use each and pros/cons."
    >
      <section className="blog-article">
        <h2>Which 3D Printing Material Should I Choose?</h2>
        <p className="lead">Material selection depends on strength, heat resistance, durability, and the intended use — choose the right filament or resin for best results.</p>

        <h3>Material highlights</h3>
        <p>A quick comparison of commonly used 3D printing materials and their trade-offs.</p>
      <table className="w-full mb-4 text-sm">
        <thead>
          <tr className="text-left">
            <th className="pr-4">Material</th>
            <th className="pr-4">Strength</th>
            <th className="pr-4">Ease of printing</th>
            <th>Typical use</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>PLA</td>
            <td>Low–medium</td>
            <td>Easy</td>
            <td>Prototypes, models</td>
          </tr>
          <tr>
            <td>PETG</td>
            <td>Medium</td>
            <td>Medium</td>
            <td>Functional parts, outdoor use</td>
          </tr>
          <tr>
            <td>ABS/ASA</td>
            <td>Medium–high</td>
            <td>Challenging</td>
            <td>Enclosures, heat-resistant parts</td>
          </tr>
          <tr>
            <td>Resin (SLA)</td>
            <td>Varies (high for engineering resins)</td>
            <td>Medium</td>
            <td>High-detail models, dental, jewelry</td>
          </tr>
        </tbody>
      </table>

      <h3>Choosing the right material</h3>
      <p>Match the material to the functional requirements: mechanical load, heat, chemical exposure, surface finish, and post-processing needs.</p>

      <h3>When to use / When not to use</h3>
      <ul>
        <li><strong>Use PLA</strong> for quick prototypes and visual models.</li>
        <li><strong>Use PETG</strong> when you need a balance of strength and printability.</li>
        <li><strong>Avoid ABS</strong> for beginners due to warping unless you have an enclosure.</li>
      </ul>
      </section>
    </BlogLayout>
  );
};

export default Materials3DPrint;
