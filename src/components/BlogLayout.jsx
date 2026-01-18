import React, { useEffect } from 'react';

const BlogLayout = ({ title, description, readingTime, heroImage, children, metaDescription }) => {
  useEffect(() => {
    if (title) document.title = `${title} — Aximake`;
    if (metaDescription) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = metaDescription;
    }
  }, [title, metaDescription]);

  return (
    <article className="container mx-auto px-4 sm:px-4 lg:px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <style>{`
          /* Scoped blog improvements: clearer heading + lead paragraph spacing */
          .blog-article h2 { font-weight: 700; margin-top: 1.25rem; margin-bottom: 0.5rem; }
          .blog-article h2 + p { font-weight: 600; color: #475569; margin-top: 0; margin-bottom: 1rem; }
          .blog-article h3 { font-weight: 700; margin-top: 1rem; margin-bottom: 0.4rem; font-size: 1.0625rem; }
          .blog-article h3 + p { font-weight: 600; color: #475569; margin-top: 0; margin-bottom: 0.9rem; }
          .blog-article p { margin-bottom: 0.9rem; line-height: 1.8; }
          .blog-article ul, .blog-article ol { margin-bottom: 1rem; padding-left: 1.25rem; }
          .blog-article hr { margin: 2rem 0; }
        `}</style>
        {heroImage && (
          <div className="mb-6">
            <img src={heroImage} alt={title} className="w-full h-auto rounded-md object-cover" loading="lazy" />
          </div>
        )}

        <header className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-2">{title}</h1>
          {readingTime && <div className="text-sm text-muted-foreground mb-3">Estimated reading time: {readingTime}</div>}
          {description && <div className="bg-sky-50 border-l-4 border-primary p-4 mb-4 text-sm">{description}</div>}
        </header>

        <section className="blog-article prose prose-slate lg:prose-lg max-w-none leading-relaxed text-slate-800">
          {children}
        </section>

        <hr className="my-12 border-t border-border" />
      </div>
    </article>
  );
};

export default BlogLayout;
