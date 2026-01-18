import React from 'react';
import BlogLayout from '@/components/BlogLayout';

const ElectronicsKits = () => {
  return (
    <BlogLayout
      title="What are custom electronic kits?"
      readingTime="4 min"
      description="Custom kits bundle PCBs, components, and documentation. They can be tailored for training, prototyping, or product launches."
      metaDescription="Overview of custom electronic kits, differences from off-the-shelf kits, lead times, MOQs, and available support and documentation."
    >
      <section className="blog-article">
        <h2>What Are Custom Electronic Kits?</h2>
        <p className="lead">Custom kits bundle PCBs, components, and instructions — tailored for training, prototyping, or branded product launches.</p>

        <h3>Choosing a kit</h3>
        <p>Decide between ready-made learning kits (designed for education) or custom kits (tailored BOM, branding, and documentation). Consider support and documentation availability.</p>

      <h3>Support and documentation</h3>
      <p>We provide assembly guides and can offer onboarding support for bulk or custom orders. For complex kits, request a sample build or documentation review before production.</p>

      <h3>When to use custom kits</h3>
      <ul>
        <li>Training programs or workshops requiring bespoke content.</li>
        <li>Branded promotional kits or OEM bundled products.</li>
        <li>Prototyping runs where part selection and documentation matter.</li>
      </ul>
      </section>
    </BlogLayout>
  );
};

export default ElectronicsKits;
