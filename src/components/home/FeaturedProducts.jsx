import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

const FeaturedProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const supabaseBaseUrl = 'https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/product-images/';

  useEffect(() => {
    async function fetchFeatured() {
      setLoading(true);
      const { data, error } = await supabase.from('products').select('*').eq('visible', true).eq('featured', true).limit(8);
      setProducts(data || []);
      setLoading(false);
    }
    if (location.pathname === '/') {
      fetchFeatured();
    }
  }, [location.key]);

  return (
    <section id="featured-products-section" className="py-16 md:py-24">
      {/* Remove container and px-0 for true full width */}
      <div className="w-full mx-0 px-3 sm:px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Featured Products</h2>
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        ) : products.length === 0 ? (
          <div className="col-span-full text-center text-muted-foreground py-12">No featured products yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-5 sm:gap-6 w-full">
            {products.map((product, idx) => {
              let images = [];
              if (Array.isArray(product?.images) && product.images.some(Boolean)) {
                images = product.images.filter(Boolean);
              } else if (typeof product?.images === 'string' && product.images.trim() !== '') {
                try {
                  const parsed = JSON.parse(product.images);
                  if (Array.isArray(parsed)) {
                    images = parsed.filter(Boolean);
                  } else if (typeof parsed === 'string') {
                    images = [parsed];
                  } else {
                    images = [product.images];
                  }
                } catch {
                  images = product.images.split(',').map(s => s.trim()).filter(Boolean);
                }
              }
              images = images
                .filter(img => typeof img === 'string' && img.trim())
                .map(img => {
                  if (img.startsWith('http') || img.startsWith('/')) return img;
                  return supabaseBaseUrl + img.replace(/^products\//, 'products/');
                });
              if (!images.length && product?.image_url) {
                images = [product.image_url];
              }
              if (!images.length) {
                images = ['https://images.unsplash.com/photo-1585592049294-8f466326930a'];
              }
              const fallbackImg = 'https://images.unsplash.com/photo-1585592049294-8f466326930a';
              return (
                <Card className="overflow-hidden group hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-card/80 backdrop-blur-sm border-primary/10" key={product.id}>
                  <div className="aspect-square bg-muted/50 overflow-hidden flex items-center justify-center">
                    <img
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      src={images[0]}
                      onError={e => { e.target.src = fallbackImg; }}
                    />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold text-foreground mb-1">{product.name}</h3>
                    <Button variant="link" asChild className="p-0 h-auto text-primary">
                      <Link to={`/product/${product.id}`}>View Details <ArrowRight className="ml-1 h-4 w-4" /></Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
export default FeaturedProducts;