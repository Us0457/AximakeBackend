import React from 'react';
import { Link } from 'react-router-dom';
import BlogLayout from '@/components/BlogLayout';

const WhatIs3DPrinting = () => {
  return (
    <BlogLayout
      title="What Is 3D Printing? — Infill, Cost, Materials & Basics"
      readingTime="20 min"
      description="A practical guide covering infill, cost calculations, material choices, and the basic 3D printing process."
      metaDescription="Learn what infill is, how 3D print costs are calculated, which materials to choose, and how 3D printing works — practical tips for makers and engineers."
    >
      <section className="blog-article">
        <h2>What Is Infill in 3D Printing?</h2>
        <p className="lead">Infill is the internal structure of a 3D printed object. It controls the balance between strength, weight, print time, and cost without affecting the external appearance.</p>

        <h3>What exactly is infill?</h3>
        <p>Infill refers to the pattern and density of material inside a 3D print. Instead of being completely solid, most prints contain a structured internal lattice that provides strength while saving material. The outer shell defines the shape, while infill determines how strong and heavy the part will be.</p>

        <h3>Why infill is important</h3>
        <p>Infill directly affects mechanical strength, print duration, material usage and cost, and the weight of the part. Choosing the wrong infill can make a part too weak, unnecessarily expensive, or overly heavy.</p>

        <h3>Common infill patterns</h3>
        <ul>
          <li><strong>Grid</strong> — balanced strength and speed.</li>
          <li><strong>Gyroid</strong> — excellent strength-to-weight ratio.</li>
          <li><strong>Honeycomb</strong> — strong and flexible.</li>
          <li><strong>Lines</strong> — fast and economical.</li>
        </ul>

        <h3>Infill percentage explained</h3>
        <p>10–20% → decorative or light-use parts. 20–40% → functional components. 50%+ → high-strength applications. Higher infill means more material and longer print time.</p>

        <h3>When to use higher infill</h3>
        <p>Use higher infill for load-bearing parts, mechanical components, and enclosures requiring rigidity. Lower infill is suitable for prototypes and visual models.</p>

        <p><strong>Key takeaway:</strong> Infill is a design decision, not just a print setting. The right choice reduces cost while maintaining strength.</p>

        <hr />

        <h2>How Is 3D Print Cost Calculated?</h2>
        <p className="lead">3D printing cost depends on material usage, print time, complexity, infill, and post-processing, not just part size.</p>

        <h3>Main factors that affect cost</h3>
        <ol>
          <li><strong>Material used</strong> — more material = higher cost; material type (PLA, PETG, ABS, Resin) affects price.</li>
          <li><strong>Print time</strong> — longer prints cost more due to machine usage, power, and labour/supervision.</li>
          <li><strong>Infill &amp; shell thickness</strong> — higher infill and thicker walls increase material usage and print duration.</li>
          <li><strong>Part geometry</strong> — complex shapes need supports and slower speeds, increasing cost.</li>
        </ol>

        <h3>Why two similar parts can cost different amounts</h3>
        <p>Differences in orientation, infill, supports, and tolerances can cause large price differences even for visually similar models.</p>

        <h3>Post-processing costs</h3>
        <p>Support removal, sanding, painting, and other finishing steps add to the final price.</p>

        <p><strong>Key takeaway:</strong> 3D printing is priced on engineering effort and machine time, not just physical size.</p>

        <hr />

        <h2>Which 3D Printing Material Should I Choose?</h2>
        <p className="lead">Material selection depends on strength, heat resistance, durability, and use case.</p>

        <h3>Most common 3D printing materials</h3>
        <ul>
          <li><strong>PLA</strong> — easy to print, affordable, good surface finish; best for prototypes and decorative parts.</li>
          <li><strong>PETG</strong> — stronger than PLA, moisture and heat resistant; ideal for outdoor or functional parts.</li>
          <li><strong>ABS</strong> — high strength and heat resistance; requires a controlled printing environment.</li>
          <li><strong>Resin</strong> — extremely high detail and smooth surface; ideal for precision and visual models.</li>
        </ul>

        <h3>How to choose the right material</h3>
        <p>Ask: Will the part see heat? Does it need flexibility or rigidity? Is surface appearance important? Will it be used outdoors?</p>

        <h3>Common mistakes to avoid</h3>
        <p>Using PLA for high-heat applications, overengineering material choice, and ignoring environmental conditions.</p>

        <p><strong>Key takeaway:</strong> The right material saves money and improves performance; choosing incorrectly can cause early failure.</p>

        <hr />

        <h2>What Is 3D Printing?</h2>
        <p className="lead">3D printing is a manufacturing process where objects are created layer-by-layer from digital designs, enabling customization and rapid production.</p>

        <h3>Understanding 3D printing</h3>
        <p>Unlike traditional manufacturing, 3D printing adds material instead of removing it. This allows complex geometries, faster prototyping, and minimal material waste.</p>

        <h3>How the process works</h3>
        <ol>
          <li>Create a digital 3D model (CAD or scan).</li>
          <li>Slice the model into layers.</li>
          <li>Printer builds the object layer-by-layer.</li>
          <li>Apply post-processing if needed (support removal, finishing).</li>
        </ol>

        <h3>Where 3D printing is used</h3>
        <p>Product prototyping, custom enclosures, medical and dental models, education, research, and small-scale manufacturing.</p>

        <p><strong>Key takeaway:</strong> 3D printing bridges idea and physical product, making manufacturing more accessible.</p>

        <p>Want to dive deeper into infill strategies? See our <Link to="/blog/infill" className="text-primary">detailed infill guide</Link>.</p>
      </section>
    </BlogLayout>
  );
};

export default WhatIs3DPrinting;
