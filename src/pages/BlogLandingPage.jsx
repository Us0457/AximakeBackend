import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const posts = [
  { title: 'What is 3D printing and how does it work?', slug: '/blog/what-is-3d-printing', excerpt: 'A friendly introduction to additive manufacturing and how printers turn designs into parts.' },
  { title: 'What is infill in 3D printing?', slug: '/blog/infill', excerpt: 'Why infill matters: strength, weight, cost and when to choose which pattern.' },
  { title: 'How is the cost of a 3D print calculated?', slug: '/blog/pricing', excerpt: 'Breakdown of factors that influence pricing and how to estimate costs.' },
  { title: 'Which 3D printing material should I choose?', slug: '/blog/materials', excerpt: 'Guide to common materials and how to pick one for your application.' },
  { title: 'When should you choose custom 3D printing?', slug: '/blog/custom-printing', excerpt: 'Use-cases for custom printing, approval flows and file readiness.' },
  { title: 'What are custom electronic kits?', slug: '/blog/electronics-kits', excerpt: 'Overview of kit contents, support, and differences between off-the-shelf and custom kits.' },
  { title: 'How businesses use 3D printing for prototyping and production', slug: '/blog/business-use', excerpt: 'How startups and SMEs leverage printing for rapid iteration and small-volume production.' },
];

const BlogLandingPage = () => {
  useEffect(() => { document.title = 'Blog — Aximake'; }, []);

  return (
    <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-12">
      <h1 className="text-3xl font-bold mb-4">Aximake Blog</h1>
      <p className="text-muted-foreground mb-6">Educational articles, how-tos, and practical guides on 3D printing, electronics kits, and custom manufacturing.</p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map(p => (
          <article key={p.slug} className="bg-card/70 border border-border rounded-lg p-4 hover:shadow-lg transition">
            <h3 className="text-lg font-semibold mb-1"><Link to={p.slug} className="hover:text-primary">{p.title}</Link></h3>
            <p className="text-sm text-muted-foreground mb-3">{p.excerpt}</p>
            <Link to={p.slug} className="text-primary font-medium">Read more →</Link>
          </article>
        ))}
      </div>
    </div>
  );
};

export default BlogLandingPage;
