import React from 'react';
import { Link } from 'react-router-dom';
import BlogLayout from '@/components/BlogLayout';

const InfillBlog = () => {
  return (
    <BlogLayout
      title="What is infill in 3D printing and why does it matter?"
      readingTime="5 min"
      description="Infill is the internal pattern inside a printed part — it controls strength, weight, material use, and cost."
      metaDescription="Learn infill types, percentages, strength vs weight, cost impact, and real-world use cases for 3D printing."
    >
      <section className="blog-article">
        <h2>What Is Infill in 3D Printing?</h2>
        <p className="lead">Infill is the internal pattern inside a printed part — it controls strength, weight, material use, and cost without changing the external shape.</p>

        <h3>Types of infill</h3>
        <p>Common patterns include <strong>grid</strong>, <strong>honeycomb</strong>, <strong>gyroid</strong>, and <strong>triangle</strong>. Each offers different stiffness-to-weight characteristics: gyroid gives isotropic strength, honeycomb is material-efficient, and triangle/grid are simple and reliable.</p>

      <h3>Percentage and strength</h3>
      <p>Higher infill percentage increases strength and weight. Typical guidance:</p>
      <ul>
        <li>10–20%: lightweight prototypes and models</li>
        <li>20–40%: functional prototypes and most consumer parts</li>
        <li>50%+: load-bearing or mechanical parts</li>
      </ul>

      <h3>Cost impact</h3>
      <p>More infill consumes more material and print time. When quoting, consider infill as a direct cost driver — reduce infill where possible and use stronger outer walls for rigidity.</p>

      <h3>Visual examples</h3>
      <p>See the detailed diagrams on our <Link to="/infill-info" className="text-primary">Infill Information</Link> page for pattern visuals and practical comparisons.</p>

      <h3>When to use / When not to use</h3>
      <ul>
        <li><strong>When to use:</strong> parts needing moderate strength, prototypes, and parts where weight is secondary.</li>
        <li><strong>When not to use:</strong> decorative parts where solid fill is unnecessary, or where mass savings are critical and a different design approach is preferable.</li>
      </ul>

      <h3>Pro Tips</h3>
      <ol>
        <li>Combine moderate infill with thicker walls to achieve stiffness while saving material.</li>
        <li>Use gyroid for isotropic strength in complex shapes.</li>
        <li>Test with small coupons to validate strength before committing to large runs.</li>
      </ol>
      </section>
    </BlogLayout>
  );
};

export default InfillBlog;
