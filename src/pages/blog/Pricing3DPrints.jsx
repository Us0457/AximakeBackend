import React from 'react';
import BlogLayout from '@/components/BlogLayout';

const Pricing3DPrints = () => {
  return (
    <BlogLayout
      title="How is the cost of a 3D print calculated?"
      readingTime="6 min"
      description="Understand material, time, complexity, and finishing costs to make better quoting decisions for 3D prints."
      metaDescription="Breakdown of the factors that influence 3D printing cost and why instant quotes might differ from final pricing."
    >
      <section className="blog-article">
        <h2>How Is 3D Print Cost Calculated?</h2>
        <p className="lead">3D printing cost depends on material usage, print time, complexity, infill, and post-processing — not just part size.</p>

        <h3>Primary cost drivers</h3>
        <p>Below are the main cost drivers that determine the final price of a 3D print.</p>
      <ul>
        <li><strong>Material volume:</strong> more material = higher cost.</li>
        <li><strong>Print time:</strong> longer runs occupy machines and labor.</li>
        <li><strong>Complexity & supports:</strong> additional setup, supports and post-processing.</li>
        <li><strong>Finish & tolerance:</strong> higher fidelity requires slower prints or secondary processes.</li>
      </ul>

      <h3>Instant quotes vs final price</h3>
      <p>Instant quotes give a good estimate but may change after manual review for manufacturability, supports, or errors in the file. We notify you before charging extra.</p>

      <h3>Decision guidance</h3>
      <p>If you need a firm price for procurement or bidding, request a manual quote and attach your files — we will check tolerances, supports, and finishing requirements before confirming price.</p>
      </section>
    </BlogLayout>
  );
};

export default Pricing3DPrints;
