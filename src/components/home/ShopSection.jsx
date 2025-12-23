import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart } from 'lucide-react';

const rows = [
  { key: 'electronic-kits', title: 'Electronic Kits', filterCandidates: ['kits', 'kit', 'electronic kit'] },
  { key: 'hobby-makers', title: 'Hobby & Makers', filterCandidates: ['hobby', 'maker', 'makers'] },
  { key: 'home-decor', title: 'Home & Decor', filterCandidates: ['home', 'decor'] },
];

// Map row keys to cover image filenames (placed in public/assets/categories)
const LEFT_CATEGORY_IMAGES = {
  'electronic-kits': '/assets/categories/ElectronicsKitCover3.png',
  'hobby-makers': '/assets/categories/HobbyCover.png',
  'home-decor': '/assets/categories/HomeCover.png',
};

// Layout constants shared between carousel and left image
const CARD_WIDTH = 220; // fixed px width for each carousel item wrapper
const CARD_HEIGHT = 320; // fixed px total height for each card
const IMAGE_HEIGHT = 220; // fixed px height for product image area

// Left image fallback: use a per-category image if present, otherwise render the SVG anchor
const LeftFallback = ({ src = '/assets/categories/left-fallback.jpg', alt = 'Category image' } = {}) => {
  const [errored, setErrored] = useState(false);
  return (
    <div className="rounded-lg overflow-hidden shadow-sm bg-gradient-to-br from-slate-800 to-sky-600 flex items-center justify-center" style={{ height: CARD_HEIGHT, width: 260 }}>
      {!errored ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          style={{ height: CARD_HEIGHT, width: 260, objectFit: 'cover' }}
          onError={() => setErrored(true)}
        />
      ) : (
        <svg width="92" height="92" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="2" y="3" width="20" height="14" rx="2" fill="rgba(255,255,255,0.06)" />
          <path d="M3 19h18" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="8" cy="10" r="1.6" fill="rgba(255,255,255,0.9)" />
          <rect x="11" y="8" width="7" height="4" rx="0.6" fill="rgba(255,255,255,0.9)" />
        </svg>
      )}
    </div>
  );
};

const ProductCard = ({ product }) => {
  const supabaseBaseUrl = 'https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/product-images/';
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  let images = [];
  if (Array.isArray(product?.images) && product.images.some(Boolean)) {
    images = product.images.filter(Boolean);
  } else if (typeof product?.images === 'string' && product.images.trim() !== '') {
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed)) images = parsed.filter(Boolean);
      else if (typeof parsed === 'string') images = [parsed];
      else images = [product.images];
    } catch {
      images = product.images.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  images = images
    .filter(img => typeof img === 'string' && img.trim())
    .map(img => (img.startsWith('http') || img.startsWith('/') ? img : supabaseBaseUrl + img.replace(/^products\//, 'products/')));
  if (!images.length && product?.image_url) images = [product.image_url];
  if (!images.length) images = ['https://images.unsplash.com/photo-1585592049294-8f466326930a'];

  const [inWishlist, setInWishlist] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (!user) {
        if (mounted) setInWishlist(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('wishlist')
          .select('id')
          .eq('user_id', user.id)
          .eq('product_id', product.id)
          .maybeSingle();
        if (error) return;
        if (mounted) setInWishlist(!!data?.id);
      } catch (e) {
        // ignore
      }
    };
    check();
    return () => { mounted = false; };
  }, [user, product.id]);

  const handleRequireAuth = () => {
    toast({ title: 'Sign in required', description: 'Please sign in to manage wishlist or cart.', variant: 'default' });
    navigate('/auth');
  };

  const toggleWishlist = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) return handleRequireAuth();
    // Optimistic UI: flip immediately
    const prev = inWishlist;
    setInWishlist(!prev);
    setLoadingWishlist(true);
    try {
      if (prev) {
        // remove
        const { error } = await supabase
          .from('wishlist')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id);
        if (error) throw error;
        window.dispatchEvent(new Event('wishlist-updated'));
        toast({ title: 'Removed', description: `${product.name} removed from wishlist.`, variant: 'default' });
      } else {
        const { error } = await supabase
          .from('wishlist')
          .insert({ user_id: user.id, product_id: product.id, name: product.name, price: product.price, images: product.images, sku: product.sku || null });
        if (error) throw error;
        window.dispatchEvent(new Event('wishlist-updated'));
        toast({ title: 'Added', description: `${product.name} added to wishlist.`, variant: 'default' });
      }
    } catch (err) {
      // revert optimistic state on error
      setInWishlist(prev);
      toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' });
    } finally {
      setLoadingWishlist(false);
    }
  };

  const addToCart = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) return handleRequireAuth();
    try {
      // check existing
      const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from('cart_items').update({ quantity: (existing.quantity || 1) + 1 }).eq('id', existing.id);
      } else {
        await supabase.from('cart_items').insert({ user_id: user.id, product_id: product.id, name: product.name, price: product.price, images: product.images, quantity: 1, sku: product.sku || null });
      }
      setCartAdded(true);
      window.dispatchEvent(new Event('cart-updated'));
      setTimeout(() => setCartAdded(false), 1400);
      toast({ title: 'Added to cart', description: `${product.name} added to cart.`, variant: 'default' });
    } catch (err) {
      toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' });
    }
  };

  const priceNum = Number(product.price) || 0;
  const mrpNum = Number(product.original_price ?? product.old_price) || 0;
  const showMRP = mrpNum > 0 && mrpNum > priceNum;
  const savePct = showMRP ? Math.round(((mrpNum - priceNum) / mrpNum) * 100) : 0;

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-200 border border-zinc-100" style={{ backgroundColor: 'rgba(250,250,250,0.9)' }}>
      <Link to={`/product/${product.id}`} className="block w-full flex-shrink-0">
        <div className="overflow-hidden bg-zinc-50 flex items-center justify-center" style={{ height: IMAGE_HEIGHT, width: '100%' }}>
          <img alt={product.name} className="w-full h-full object-cover object-center block" src={images[0]} style={{ objectFit: 'cover', margin: 0, display: 'block' }} />
        </div>
        <div className="px-3 py-1">
          <h4 className="text-sm font-medium text-foreground truncate">{product.name}</h4>
          {product.sku && <div className="text-xs text-zinc-500">SKU: <span className="font-mono text-xs text-zinc-700">{product.sku}</span></div>}
          <div className="mt-1">
            <div className="flex items-baseline gap-2">
              <div className="text-primary font-semibold">₹{priceNum.toLocaleString('en-IN')}</div>
              {showMRP && (
                <div className="flex items-center gap-2">
                  <div className="text-xs line-through text-gray-500">₹{mrpNum.toLocaleString('en-IN')}</div>
                  <div className="text-xs text-emerald-700">Save {savePct}%</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
      <div className="mt-auto px-3 pb-3 pt-0">
        <div className="border-t border-zinc-100 pt-4 pb-2 flex items-center justify-between">
          <button
            onClick={toggleWishlist}
            onMouseDown={e => e.stopPropagation()}
            className="hover:opacity-90 active:scale-95 transition-colors duration-150 ease-in-out"
            aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            disabled={loadingWishlist}
          >
            {inWishlist ? (
              <svg className="h-5 w-5 text-red-600 transition-colors duration-150 ease-in-out" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4 18 4 20 6 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              <Heart className="h-5 w-5 text-zinc-900 transition-colors duration-150 ease-in-out" />
            )}
          </button>
          <button
            onClick={addToCart}
            onMouseDown={e => e.stopPropagation()}
            className={`text-zinc-900 hover:opacity-80 active:scale-95 transition ${cartAdded ? 'text-emerald-600' : ''}`}
            aria-label="Add to cart"
          >
            <ShoppingCart className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const Carousel = ({ products = [] }) => {
  const ref = useRef(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      // keep container height/overflow stable — no-op placeholder for future telemetry
    };
    el.addEventListener('scroll', onScroll);
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [products]);

  const onPointerDown = (e) => {
    const el = ref.current;
    if (!el) return;
    // Allow native touch scrolling with momentum on touch devices
    if (e.pointerType === 'touch') return;
    isDownRef.current = true;
    el.classList.add('cursor-grabbing');
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
    e.target.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const el = ref.current;
    if (!el || !isDownRef.current) return;
    const x = e.pageX - el.offsetLeft;
    const walk = x - startXRef.current;
    el.scrollLeft = scrollLeftRef.current - walk;
  };

  const onPointerUp = (e) => {
    const el = ref.current;
    if (!el) return;
    isDownRef.current = false;
    el.classList.remove('cursor-grabbing');
    e.target.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div className="w-full">
      <div className="overflow-hidden" style={{ minHeight: CARD_HEIGHT }}>
        <div
          ref={ref}
          data-shop-carousel
          className="flex items-stretch flex-nowrap overflow-x-auto no-scrollbar gap-3 py-2 px-0"
          style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <style>{`[data-shop-carousel]{-webkit-overflow-scrolling:touch;touch-action:pan-x;scrollbar-width:none;-ms-overflow-style:none;} [data-shop-carousel]::-webkit-scrollbar{display:none;width:0;height:0;}`}</style>
          {products.map(p => (
            <div
              data-card
              key={p.id}
              className="flex-none"
              style={{ width: CARD_WIDTH, height: CARD_HEIGHT, flex: '0 0 auto' }}
            >
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ShopSection = () => {
  const [productsBy, setProductsBy] = useState({});
  const [loading, setLoading] = useState(true);
  const [hasAny, setHasAny] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const res = {};
      for (const row of rows) {
        // try multiple candidate fields to find real products
        let data = [];
        for (const term of row.filterCandidates) {
          try {
            // Prefer querying the `category` column first (exists in schema)
            const { data: dcat, error: ecat } = await supabase
              .from('products')
              .select('*')
              .eq('visible', true)
              .ilike('category', `%${term}%`)
              .limit(24);
            if (!ecat && dcat && dcat.length) {
              data = dcat;
              break;
            }

            // Fallback: search in name or description if category didn't match
            const { data: dfallback } = await supabase
              .from('products')
              .select('*')
              .eq('visible', true)
              .or(`name.ilike.%${term}%,description.ilike.%${term}%`)
              .limit(24);
            if (dfallback && dfallback.length) {
              data = dfallback;
              break;
            }
          } catch (e) {
            // ignore and continue
            console.error('ShopSection fetch error', e);
          }
        }
        res[row.key] = data || [];
      }
      setProductsBy(res);
      const any = Object.values(res).some(a => Array.isArray(a) && a.length > 0);
      setHasAny(any);
      setLoading(false);
    }
    fetchAll();
  }, []);

  return (
    <section id="shop-section" className="bg-white py-4 md:py-12">
      <div className="w-full max-w-none px-0 space-y-4 md:space-y-6">
        {loading ? (
          <div className="text-center py-12">Loading products...</div>
        ) : !hasAny ? (
          <div className="text-center py-12 text-neutral-500">No products available for the shop right now.</div>
        ) : (
          rows.map(row => {
            const products = productsBy[row.key] || [];
            if (!products || products.length === 0) return null;
            return (
              <div key={row.key} className="w-full">
                <div className="w-full">
                    <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] lg:grid-cols-[250px_1fr] gap-4 md:gap-6 items-start">
                    {/* Heading (left column) */}
                    <div className="flex items-center">
                      <h3 className="text-xl font-semibold">{row.title}</h3>
                    </div>

                    {/* View all (right column) */}
                    <div className="flex justify-end items-center">
                      <a href={`/products?category=${encodeURIComponent(row.filterCandidates[0] || row.title)}`} className="text-sm text-primary">View all</a>
                    </div>

                    {/* Category image: hidden on mobile, above carousel on tablet (md), left on desktop (lg) */}
                    <div className="hidden md:flex justify-start items-start pt-2 md:mb-0">
                      <div className="h-full flex items-center">
                        <Link to={`/products?category=${encodeURIComponent(row.filterCandidates[0] || row.title)}`} className="inline-block">
                          <LeftFallback src={LEFT_CATEGORY_IMAGES[row.key] || '/assets/categories/left-fallback.jpg'} alt={row.title} />
                        </Link>
                      </div>
                    </div>

          <style>{`[data-shop-carousel]{-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;scrollbar-width:none;-ms-overflow-style:none;} [data-shop-carousel]::-webkit-scrollbar{display:none;width:0;height:0;}`}</style>
                    <div className="w-full overflow-hidden">
                      <Carousel products={products} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export default ShopSection;
