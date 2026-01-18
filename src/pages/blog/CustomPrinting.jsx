import React from 'react';
import BlogLayout from '@/components/BlogLayout';
import { Link } from 'react-router-dom';

const CustomPrinting = () => {
  return (
    <BlogLayout
      title="When should you choose custom 3D printing?"
      readingTime="4 min"
      description="Custom printing is ideal for bespoke parts, tight tolerances, and short production runs where tooling is expensive."
      metaDescription="Guidance on when to choose custom 3D printing, file prep, tolerances, and approval flows for production prints."
    >
      <section className="blog-article">
        <h2>When Should You Choose Custom 3D Printing?</h2>
        <p className="lead">Custom printing is ideal for bespoke parts, tight tolerances, and short production runs where tooling is expensive or impossible.</p>

        <h3>Use-cases</h3>
        <p>Common scenarios where custom printing delivers the most value.</p>
      <ul>
        <li>Unique enclosures or parts with complex geometry.</li>
        <li>Small production runs where tooling is expensive.</li>
        <li>Functional prototypes that require specific materials or finishes.</li>
      </ul>

      <h3>File formats and preparation</h3>
      <p>We accept STL and OBJ for most jobs. Ensure models are watertight, correctly scaled, and checked for non-manifold geometry. Our <Link to="/blog/infill" className="text-primary">Infill guide</Link> and pre-print checks help reduce surprises.</p>

      <h3>Pro Tips</h3>
      <ul>
        <li>Include measurement references in your file to validate scale.</li>
        <li>Provide notes on required tolerances and mating surfaces.</li>
      </ul>
      </section>
    </BlogLayout>
  );
};

export default CustomPrinting;
