import React, { useEffect, useState, useRef } from 'react';
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

  // Carousel item sizing (keep consistent with other carousels)
  const CARD_WIDTH = 220;
  const CARD_HEIGHT = 320;
  const carouselRef = useRef(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const targetScrollRef = useRef(null);
  const rafRef = useRef(null);
  const onPointerDown = (e) => {
    const el = carouselRef.current;
    if (!el) return;
    // Record start positions for both mouse and touch.
    const rect = el.getBoundingClientRect();
    startXRef.current = e.clientX - rect.left;
    startYRef.current = e.clientY - rect.top;
    scrollLeftRef.current = el.scrollLeft;
    // For mouse (non-touch) begin dragging immediately. For touch, wait until we detect horizontal intent.
    if (e.pointerType !== 'touch') {
      isDownRef.current = true;
      el.classList.add('cursor-grabbing');
      e.target.setPointerCapture?.(e.pointerId);
    } else {
      isDownRef.current = false;
    }
  };

  const onPointerMove = (e) => {
    const el = carouselRef.current;
    if (!el) return;
    // If we haven't engaged dragging for touch yet, try to detect horizontal intent.
    if (e.pointerType === 'touch' && !isDownRef.current) {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = x - startXRef.current;
      const dy = y - startYRef.current;
      // If gesture is primarily horizontal and passes a small threshold, engage dragging.
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        isDownRef.current = true;
        el.classList.add('cursor-grabbing');
        // reset start positions so scrolling begins from current pointer
        startXRef.current = e.pageX - el.offsetLeft;
        scrollLeftRef.current = el.scrollLeft;
        e.target.setPointerCapture?.(e.pointerId);
        e.preventDefault?.();
      } else {
        // allow vertical scrolling to continue
        return;
      }
    }

    if (!isDownRef.current) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const walk = x - startXRef.current;
    // Set target scroll position; animate towards it in RAF for smoothness
    targetScrollRef.current = Math.max(0, scrollLeftRef.current - walk);
    if (!rafRef.current) {
      const animate = () => {
        const el2 = carouselRef.current;
        if (!el2) return;
        const current = el2.scrollLeft;
        const target = targetScrollRef.current ?? current;
        const next = current + (target - current) * 0.22;
        el2.scrollLeft = next;
        if (Math.abs(next - target) > 0.5) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          el2.scrollLeft = target;
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(animate);
    }
  };

  const onPointerUp = (e) => {
    const el = carouselRef.current;
    if (!el) return;
    isDownRef.current = false;
    el.classList.remove('cursor-grabbing');
    try { e.target.releasePointerCapture?.(e.pointerId); } catch (err) { /* ignore */ }
    // let RAF finish to settle
    targetScrollRef.current = null;
  };

  React.useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

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

  const getImages = (product) => {
    const fallbackImg = 'https://images.unsplash.com/photo-1585592049294-8f466326930a';
    if (!product) return [fallbackImg];
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
    if (!images.length && product?.image_url) images = [product.image_url];
    if (!images.length) images = [fallbackImg];
    return images;
  };

  return (
    <section id="featured-products-section" className="py-6 md:py-8">
      {/* Remove container and px-0 for true full width */}
      <div className="w-full mx-0 px-3 sm:px-4">
        {/* <h2 className="text-3xl md:text-4xl font-bold text-center mb-2">Featured Products</h2> */}
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        ) : products.length === 0 ? (
          <div className="col-span-full text-center text-muted-foreground py-12">No featured products yet.</div>
        ) : (
          <div className="w-full">
            {/* Top banner */}
            <div className="w-full rounded-lg overflow-hidden mb-2 shadow-sm">
                <img
                  src="/assets/FeaturedBanner.png"
                  alt="Featured banner"
                  className="w-full h-35 sm:h-44 md:h-35 lg:h-30 xl:h-28 object-cover"
                />
            </div>

            {/* Horizontal carousel below banner */}
            <style>{`#featured-products-section .no-scrollbar{ -webkit-overflow-scrolling:touch; touch-action:pan-x; scrollbar-width:none; -ms-overflow-style:none; } #featured-products-section .no-scrollbar::-webkit-scrollbar{ display:none; width:0; height:0; }`}</style>
            <div
              ref={carouselRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              className="flex gap-4 overflow-x-auto no-scrollbar py-1 px-0"
              style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch', touchAction: 'auto' }}
            >
              {products.map((product) => {
                const images = getImages(product);
                const fallbackImg = 'https://images.unsplash.com/photo-1585592049294-8f466326930a';
                return (
                  <div key={product.id} className="flex-none" style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
                    <Card className="overflow-hidden group hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-card/80 backdrop-blur-sm border-primary/10 h-full flex flex-col">
                      <div className="bg-muted/50 overflow-hidden flex items-center justify-center" style={{ height: CARD_WIDTH }}>
                        <img
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          src={images[0]}
                          onError={e => { e.target.src = fallbackImg; }}
                        />
                      </div>
                      <CardContent className="p-4 flex-none">
                        <h3 className="text-lg font-semibold text-foreground mb-1 truncate">{product.name}</h3>
                          {product.sku && <div className="text-xs text-zinc-500 mb-2">SKU: <span className="font-mono text-xs text-zinc-700">{product.sku}</span></div>}
                        <Button variant="link" asChild className="p-0 h-auto text-primary">
                          <Link to={`/product/${product.id}`}>View Details <ArrowRight className="ml-1 h-4 w-4" /></Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
export default FeaturedProducts;