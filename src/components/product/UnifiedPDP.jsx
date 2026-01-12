import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import ProductReviews from '@/components/product/ProductReviews';
import { motion, AnimatePresence } from 'framer-motion';
import { getImages, isKitProduct, buildBreadcrumbParts } from '@/lib/productUtils';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useRef } from 'react';

const fallbackImg = '/assets/fallback-product.png';

export default function UnifiedPDP({ productId }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [qtyInput, setQtyInput] = useState(String(1));

  useEffect(() => {
    async function fetchProduct() {
      const { data } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();
      if (data) {
        setProduct(data);
        setImages(getImages(data));
      }
    }
    if (productId) fetchProduct();
  }, [productId]);

  // SEO: set product page title when product loads
  useEffect(() => {
    if (!product) return;
    const title = product.sku ? `${product.name} — ${product.sku} — Aximake` : `${product.name} — Aximake`;
    document.title = title;
  }, [product]);

  // SEO: meta description for product page (name, primary benefit, SKU)
  useEffect(() => {
    if (!product) return;
    const primary = (product.short_description && String(product.short_description).trim()) ||
      (product.description && String(product.description).split(/[.\n]/).filter(Boolean)[0]) ||
      '';
    let desc = product.name + (primary ? ` — ${primary}` : '');
    if (product.sku) desc += ` SKU: ${product.sku}`;
    desc = desc.replace(/\s+/g, ' ').trim().slice(0, 160);
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
    m.content = desc;
  }, [product]);

  const handleAddToCart = async (qty = 1) => {
    if (!user) return toast({ title: 'Sign in required', description: 'Please sign in to add to cart.', variant: 'destructive' });
    if (!product) return;
    try {
      // If an entry for this user+product exists, increment its quantity instead of inserting a duplicate.
      const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from('cart_items').update({ quantity: (existing.quantity || 0) + qty }).eq('id', existing.id);
      } else {
        await supabase.from('cart_items').insert({ user_id: user.id, product_id: product.id, quantity: qty, name: product.name, price: product.price, images: product.images, sku: product.sku || null });
      }
      // Notify other tabs/components to recalculate cart count immediately
      window.dispatchEvent(new Event('cart-updated'));
      toast({ title: 'Added', description: 'Product added to cart', variant: 'default' });
    } catch (err) {
      toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' });
    }
  };

  const setQuantitySafe = (n) => {
    const num = Number(n) || 0;
    const clamped = Math.max(1, Math.floor(num));
    setQuantity(clamped);
    setQtyInput(String(clamped));
    return clamped;
  };

  if (!product) return <div className="py-6 text-center">Loading...</div>;

  const kit = isKitProduct(product);

  // Pricing helpers: prefer `original_price`, fall back to legacy `old_price`.
  const priceNum = Number(product.price) || 0;
  const mrpNum = Number(product.original_price ?? product.old_price) || 0;
  const showMRP = mrpNum > 0 && mrpNum > priceNum;
  const savePct = showMRP ? Math.round(((mrpNum - priceNum) / mrpNum) * 100) : 0;

  return (
    <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-3 max-w-6xl">
      {/* PDP breadcrumb: always data-driven from product canonical category
          Structure: Home > All Products > Category Name > Product Name
      */}
      <nav aria-label="Breadcrumb" className="text-sm text-zinc-600 mb-4">
        <Link to="/" className="hover:underline">Home</Link>
        <span className="mx-2 text-zinc-400">›</span>
        <Link to="/products" className="hover:underline">All Products</Link>
        <span className="mx-2 text-zinc-400">›</span>
        {(() => {
          const parts = buildBreadcrumbParts(product.category);
          const categoryLabel = parts.length ? parts[parts.length - 1] : (product.category || 'Category');
          // Link to products filtered by the canonical category string
          return (
            <>
              <Link to={`/products?category=${encodeURIComponent(product.category || '')}`} className="hover:underline">{categoryLabel}</Link>
              <span className="mx-2 text-zinc-400">›</span>
              <span className="text-zinc-500">{product.name}</span>
            </>
          );
        })()}
      </nav>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-3">
          {/* Main image carousel: swipe/drag to navigate */}
          <div
            className="relative w-full aspect-square bg-white rounded-lg overflow-hidden border border-zinc-100"
            role="region"
            aria-label="Product images carousel"
          >
            <CarouselInner images={images} selectedIndex={selectedImage} onChangeIndex={setSelectedImage} fallback={fallbackImg} />
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar py-1">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImage(idx)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedImage(idx); } }}
                aria-label={`View image ${idx + 1}`}
                tabIndex={0}
                className={`w-20 h-20 rounded-md flex-shrink-0 overflow-hidden border ${selectedImage===idx ? 'ring-2 ring-primary/60 border-primary' : 'border-zinc-200'} focus:outline-none`}
              >
                <img src={img} alt={`thumb-${idx}`} className="w-full h-full object-cover" onError={e => { e.target.onerror = null; e.target.src = fallbackImg; }} />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl sm:text-3xl font-extrabold text-slate-900 leading-tight">{product.name}</h1>
            <ProductReviews productId={product.id} showSummaryOnly clickable={false} />
            {product.difficulty && <div className={`px-3 py-1 rounded-full text-xs font-semibold ${product.featured ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-100 text-zinc-700'}`}>{product.difficulty}</div>}
          </div>
          {/* SKU display: subtle and consistent formatting (exact SKU from DB) */}
          {product.sku && (
            <div className="text-sm text-zinc-600 mb-2">SKU: <span className="font-mono text-sm text-zinc-800">{product.sku}</span></div>
          )}
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl font-extrabold text-primary">₹{priceNum.toLocaleString('en-IN')}</div>
            {showMRP && (
              <>
                <div className="text-sm line-through text-gray-500">₹{mrpNum.toLocaleString('en-IN')}</div>
                <div className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Save {savePct}%</div>
              </>
            )}
          </div>

          {/* Quantity and CTA moved up next to price/title for better visibility */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center">
            <div className="flex-none flex items-center bg-zinc-50 rounded-lg px-2 py-1 md:px-3 md:py-2 border border-zinc-200">
              <span className="font-medium text-zinc-700 mr-2 text-sm md:text-base">Qty</span>
              <div className="flex items-center gap-1 md:gap-2">
                <button aria-label="Decrease quantity" type="button" onClick={() => setQuantitySafe(quantity - 1)} className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full bg-white border text-sm p-0.5">−</button>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-12 md:w-16 text-center mx-1 p-1 text-sm md:text-base bg-transparent"
                  value={qtyInput}
                  onFocus={() => { if (qtyInput === String(quantity) && quantity === 1) setQtyInput(''); }}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9]/g, '');
                    // allow empty while typing
                    setQtyInput(v);
                    if (v === '') return;
                    const parsed = Number(v);
                    if (!Number.isNaN(parsed)) {
                      if (parsed < 1) {
                        setQuantity(1);
                        setQtyInput('1');
                      } else {
                        setQuantity(parsed);
                      }
                    }
                  }}
                  onBlur={() => { if (qtyInput === '' || Number(qtyInput) < 1) setQuantitySafe(1); else setQuantitySafe(Number(qtyInput)); }}
                />
                <button aria-label="Increase quantity" type="button" onClick={() => setQuantitySafe(quantity + 1)} className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full bg-white border text-sm p-0.5">+</button>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-start sm:justify-center">
              <Button className="w-[48%] sm:w-auto px-4 py-2 bg-gradient-to-r from-primary to-accent text-white" onClick={() => handleAddToCart(quantity)}>Add to Cart</Button>
              <Button className="w-[48%] sm:w-auto px-4 py-2 bg-zinc-900 text-white" onClick={() => handleAddToCart(quantity)}>Buy Now</Button>
            </div>
          </div>

          {!kit && (
            <div className="flex flex-col gap-2 mb-4 text-zinc-700">
              {product.material && <div className="flex items-center gap-2 text-base"><span className="font-medium">Material:</span><span>{product.material}</span></div>}
              {product.weight && <div className="flex items-center gap-2 text-base"><span className="font-medium">Weight:</span><span>{product.weight} g</span></div>}
              {product.dimensions && <div className="flex items-center gap-2 text-base"><span className="font-medium">Dimensions:</span><span>{product.dimensions}</span></div>}
            </div>
          )}

          {kit && (
            <>
              <div className="rounded-lg bg-white border p-4">
                <h3 className="font-semibold mb-2 text-primary">What's Included</h3>
                <ul className="list-disc pl-5 text-sm text-zinc-700">
                  {(Array.isArray(product.includes) ? product.includes : (typeof product.includes === 'string' ? (function(){try{return JSON.parse(product.includes)}catch{return []}})() : [])).length > 0 ? (
                    (Array.isArray(product.includes) ? product.includes : (typeof product.includes === 'string' ? (function(){try{return JSON.parse(product.includes)}catch{return []}})() : [])).map((it, i) => <li key={i}>{it}</li>)
                  ) : (
                    <li>Microcontroller board, sensors, jumper cables, breadboard, USB cable, instructions.</li>
                  )}
                </ul>
              </div>
              <div className="rounded-lg bg-white border p-4">
                <h3 className="font-semibold mb-2 text-primary">What You Will Learn</h3>
                <ul className="list-disc pl-5 text-sm text-zinc-700">
                  {(Array.isArray(product.outcomes) ? product.outcomes : (typeof product.outcomes === 'string' ? (function(){try{return JSON.parse(product.outcomes)}catch{return []}})() : [])).length > 0 ? (
                    (Array.isArray(product.outcomes) ? product.outcomes : (typeof product.outcomes === 'string' ? (function(){try{return JSON.parse(product.outcomes)}catch{return []}})() : [])).map((o, i) => <li key={i}>{o}</li>)
                  ) : (
                    <>
                      <li>Basics of microcontrollers and sensors</li>
                      <li>Reading sensor data and controlling actuators</li>
                      <li>Building small projects and prototypes</li>
                    </>
                  )}
                </ul>
              </div>
            </>
          )}

          

          <div className="mt-4 space-y-2">
            <details open className="bg-white border rounded-lg p-3">
              <summary className="font-semibold text-primary cursor-pointer border-b border-primary/10 pb-2 mb-2">Description</summary>
              <div className="mt-2 text-sm text-zinc-700">{product.description}</div>
            </details>
            <details open className="bg-white border rounded-lg p-3">
              <summary className="font-semibold text-primary cursor-pointer border-b border-primary/10 pb-2 mb-2">Specifications</summary>
              <div className="mt-2 text-sm text-zinc-700">{renderSpecifications(product.specifications) || 'See product page for detailed specs.'}</div>
            </details>
            <details open className="bg-white border rounded-lg p-3">
                <summary className="font-semibold text-primary cursor-pointer border-b border-primary/10 pb-2 mb-2">FAQs</summary>
                <div className="mt-2 text-sm text-zinc-700">
                  {(() => {
                    const v = product.faq;
                    if (!v) return 'No FAQs yet.';
                    let faqs = [];
                    if (Array.isArray(v)) faqs = v;
                    else if (typeof v === 'string') {
                      try { const parsed = JSON.parse(v); if (Array.isArray(parsed)) faqs = parsed; else if (typeof parsed === 'object') faqs = Object.entries(parsed).map(([q,a]) => ({ q, a })); } catch {
                        // split by blank lines
                        const blocks = v.trim().split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
                        faqs = blocks.map(b => {
                          const parts = b.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
                          if (parts.length >= 2) return { q: parts[0], a: parts.slice(1).join(' ') };
                          const dash = b.split(' - ');
                          if (dash.length === 2) return { q: dash[0].trim(), a: dash[1].trim() };
                          return { q: b, a: '' };
                        });
                      }
                    }
                    if (!faqs || faqs.length === 0) return 'No FAQs yet.';
                    return (
                      <div className="space-y-3">
                        {faqs.map((f, i) => (
                          <details key={i} className="bg-white border rounded-lg p-3">
                            <summary className="font-medium cursor-pointer">{f.q}</summary>
                            <div className="mt-2 text-sm text-zinc-700">{f.a}</div>
                          </details>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </details>
          </div>

        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-2xl font-bold mb-4">You may also like</h2>
        <RelatedBlock currentId={product.id} isKit={kit} category={product.category} />
      </div>

      <div id="customer-reviews-section" className="mt-10">
        <h2 className="text-2xl font-bold mb-4">Customer Reviews</h2>
        <ProductReviews productId={product.id} limit={4} />
      </div>
    </div>
  );
}

// Inline small carousel inner component to handle pointer dragging and sync
function CarouselInner({ images = [], selectedIndex = 0, onChangeIndex = () => {}, fallback }) {
  const containerRef = useRef(null);
  const startX = useRef(0);
  const deltaX = useRef(0);
  const pointerIdRef = useRef(null);
  const isDragging = useRef(false);
  const [localIndex, setLocalIndex] = useState(selectedIndex);

  useEffect(() => { setLocalIndex(selectedIndex); }, [selectedIndex]);

  const clampIndex = (i) => Math.max(0, Math.min(images.length - 1, i));

  const applyTransform = () => {
    const inner = containerRef.current?.querySelector('[data-carousel-inner]');
    if (!inner) return;
    const w = containerRef.current.clientWidth || 0;
    const base = -localIndex * w;
    const x = base + (isDragging.current ? deltaX.current : 0);
    inner.style.transform = `translateX(${x}px)`;
    inner.style.transition = isDragging.current ? 'none' : 'transform 260ms cubic-bezier(.2,.9,.2,1)';
  };

  useEffect(() => { applyTransform(); }, [localIndex]);

  const onPointerDown = (e) => {
    if (!containerRef.current) return;
    pointerIdRef.current = e.pointerId;
    isDragging.current = true;
    startX.current = e.clientX;
    deltaX.current = 0;
    containerRef.current.setPointerCapture?.(pointerIdRef.current);
    applyTransform();
  };

  const onPointerMove = (e) => {
    if (!isDragging.current || e.pointerId !== pointerIdRef.current) return;
    deltaX.current = e.clientX - startX.current;
    applyTransform();
  };

  const onPointerUp = (e) => {
    if (!isDragging.current || e.pointerId !== pointerIdRef.current) return;
    isDragging.current = false;
    containerRef.current.releasePointerCapture?.(pointerIdRef.current);
    const w = containerRef.current.clientWidth || 0;
    const threshold = Math.max(40, w * 0.12); // 12% or 40px
    if (deltaX.current > threshold) {
      // swipe right -> previous
      const ni = clampIndex(localIndex - 1);
      setLocalIndex(ni);
      onChangeIndex(ni);
    } else if (deltaX.current < -threshold) {
      const ni = clampIndex(localIndex + 1);
      setLocalIndex(ni);
      onChangeIndex(ni);
    } else {
      // snap back
      setLocalIndex((i) => i);
    }
    deltaX.current = 0;
    applyTransform();
  };

  // keyboard navigation
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { const ni = clampIndex(localIndex + 1); setLocalIndex(ni); onChangeIndex(ni); }
    if (e.key === 'ArrowLeft') { const ni = clampIndex(localIndex - 1); setLocalIndex(ni); onChangeIndex(ni); }
  };

  return (
    <div ref={containerRef} className="w-full h-full touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown} tabIndex={0} style={{ outline: 'none' }}>
      <div data-carousel-inner className="flex w-full h-full" style={{ transform: `translateX(${-localIndex * 100}%)`, transition: 'transform 260ms cubic-bezier(.2,.9,.2,1)' }}>
        {images.map((src, idx) => (
          <div key={idx} className="w-full h-full flex-shrink-0" style={{ minWidth: '100%', height: '100%' }}>
            <img src={src || fallback} alt={`Image ${idx+1}`} className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = fallback; }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function renderSpecifications(specs) {
  if (!specs || typeof specs !== 'string') return null;

  // 1. Try JSON first (new products)
  try {
    const parsed = JSON.parse(specs);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed);
      if (entries.length > 0) {
        return (
          <table className="w-full text-sm">
            <colgroup>
              <col style={{ width: '200px' }} />
              <col />
            </colgroup>
            <tbody>
              {entries.map(([key, value]) => (
                <tr key={key} className="align-top">
                  <th className="font-medium text-zinc-800 pr-4 text-left">{key}</th>
                  <td className="text-zinc-600">{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
    }
  } catch {
    // Not JSON, continue
  }

  // 2. Key: Value pairs (comma or newline separated)
  if (specs.includes(':')) {
    const pairs = specs
      .split(/\n|,/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(line => {
        const idx = line.indexOf(':');
        if (idx === -1) return null;
        return {
          key: line.slice(0, idx).trim(),
          value: line.slice(idx + 1).trim()
        };
      })
      .filter(Boolean);

    if (pairs.length > 0) {
      return (
        <table className="w-full text-sm">
          <colgroup>
            <col style={{ width: '200px' }} />
            <col />
          </colgroup>
          <tbody>
            {pairs.map(({ key, value }, idx) => (
              <tr key={idx} className="align-top">
                <th className="font-medium text-zinc-800 pr-4 text-left">{key}</th>
                <td className="text-zinc-600">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  }

  // 3. Fallback: plain text
  return <p className="text-sm text-zinc-700 whitespace-pre-line">{specs}</p>;
}
// This is a code that I have pasted from ChatGPT to show the specs on the PDP in Key, value pair

function RelatedBlock({ currentId, isKit, category }) {
  const [related, setRelated] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const containerRef = React.useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [centerItems, setCenterItems] = useState(false);
  const [cardWidth, setCardWidth] = useState(260);
  const [slidesPerView, setSlidesPerView] = useState(3);

  useEffect(() => {
    let mounted = true;
    setIsFetching(true);
    async function fetchRelated() {
      try {
        // Primary query: match category (or kit categories) and exclude current
        // Use a minimal select set to avoid errors if optional columns like `visible` don't exist.
        let res;
        const cols = 'id, name, price, images, category, original_price, short_description, created_at';
        if (isKit) {
          const kitCategories = ['Arduino Kits','IoT Kits','Beginner Kits','Sensors','Robotics','Learning Projects'];
          // Use an explicit OR expression instead of `.in()` to avoid REST parsing issues
          // with unquoted string values that can produce HTTP 400 from the REST endpoint.
          const orExpr = kitCategories.map(c => `category.eq.${c}`).join(',');
          res = await supabase.from('products').select(cols).neq('id', currentId).or(orExpr).limit(12);
        } else if (category) {
          res = await supabase.from('products').select(cols).neq('id', currentId).eq('category', category).limit(12);
        } else {
          res = await supabase.from('products').select(cols).neq('id', currentId).order('created_at', { ascending: false }).limit(12);
        }

        if (mounted) {
          if (res.error) console.warn('RelatedBlock primary query error:', res.error.message || res.error);
          let data = res.data || [];

          // If server returned rows that include a `visible` field (rare with our select), filter client-side.
          if (Array.isArray(data) && data.length > 0 && Object.prototype.hasOwnProperty.call(data[0], 'visible')) {
            data = data.filter(d => d.visible !== false);
          }

          // If primary returns empty, try a broader fallback: recent products excluding current (no server-side visible filter)
          if ((!data || data.length === 0) && mounted) {
            const fb = await supabase.from('products').select(cols).neq('id', currentId).order('created_at', { ascending: false }).limit(12);
            if (fb.error) console.warn('RelatedBlock fallback query error:', fb.error.message || fb.error);
            data = fb.data || [];
          }

          // Final minimal fallback: request only id/name/price/images to be extra-safe
          if ((!data || data.length === 0) && mounted) {
            const fb2 = await supabase.from('products').select('id, name, price, images').neq('id', currentId).limit(12);
            if (fb2.error) console.warn('RelatedBlock final fallback error:', fb2.error.message || fb2.error);
            data = fb2.data || [];
          }

          // Log for debugging
          console.debug('RelatedBlock fetched', (data || []).length, 'items for', { currentId, category, isKit });
          setRelated(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('RelatedBlock fetch error', err);
        if (mounted) setRelated([]);
      } finally {
        if (mounted) setIsFetching(false);
      }
    }
    fetchRelated();
    return () => { mounted = false; };
  }, [currentId, isKit, category]);

  // update arrow availability
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      setCanScrollLeft(el.scrollLeft > 8);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
      setCenterItems(el.scrollWidth <= el.clientWidth + 1);
    };
    // initial check (allow images to settle)
    const raf = requestAnimationFrame(onScroll);
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    // watch for size changes (images loading) to recompute
    let ro;
    try {
      ro = new ResizeObserver(() => onScroll());
      ro.observe(el);
    } catch {}

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (ro && ro.disconnect) ro.disconnect();
    };
  }, [related]);

  // Compute slidesPerView and cardWidth to evenly distribute cards across container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function compute() {
      const w = el.clientWidth || 800;
      const desiredMin = 220; // minimum comfortable card width
      const desiredMax = 380; // maximum card width
      const maxCards = 5;
      const gapPx = 16;
      const maxPossible = Math.min(maxCards, Math.max(1, related.length || maxCards));

      // Start by estimating how many cards of desiredMin can fit
      let spv = Math.max(1, Math.floor((w + gapPx) / (desiredMin + gapPx)));
      spv = Math.min(spv, maxPossible);

      // Compute card width for that spv
      let gapTotal = gapPx * (spv - 1);
      let cw = Math.floor((w - gapTotal) / spv);

      // Clamp to desired range
      cw = Math.max(desiredMin, Math.min(desiredMax, cw));

      // Try to increase slidesPerView if there's room while keeping cards >= desiredMin
      while (spv < maxPossible) {
        const nextSpv = spv + 1;
        const nextGap = gapPx * (nextSpv - 1);
        const nextCw = Math.floor((w - nextGap) / nextSpv);
        if (nextCw >= desiredMin) {
          spv = nextSpv;
          cw = Math.max(desiredMin, Math.min(desiredMax, nextCw));
        } else break;
      }

      setSlidesPerView(spv);
      setCardWidth(cw);
    }
    compute();
    const ro = ('ResizeObserver' in window) ? new ResizeObserver(compute) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', compute);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', compute); };
  }, [related]);

  const scrollBy = (dir) => {
    const el = containerRef.current;
    if (!el) return;
    const card = el.querySelector('[data-related-card]');
    const gap = 16; // fallback gap
    const cardWidth = card ? (card.offsetWidth + gap) : Math.round(el.clientWidth * 0.8);
    const delta = dir === 'left' ? -cardWidth * Math.max(1, Math.floor(el.clientWidth / cardWidth)) : cardWidth * Math.max(1, Math.floor(el.clientWidth / cardWidth));
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const fallbackImg = '/assets/fallback-product.png';

  // If fetch finished and no related products, render nothing (hide carousel and arrows)
  if (!isFetching && (!related || related.length === 0)) return null;

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-6xl relative">
        {/* Left arrow (desktop) */}
        <button
          aria-hidden={!canScrollLeft}
          onClick={() => scrollBy('left')}
          className={`hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white border shadow z-20 -ml-2 ${canScrollLeft ? '' : 'opacity-40 pointer-events-none'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-zinc-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.293 16.293a1 1 0 010-1.414L15.586 11H4a1 1 0 110-2h11.586l-3.293-3.879a1 1 0 111.486-1.318l5 5.875a1 1 0 010 1.318l-5 5.875a1 1 0 01-1.486 0z" clipRule="evenodd"/></svg>
        </button>

        <div ref={containerRef} className={`flex ${centerItems ? 'justify-center' : 'justify-start'} gap-4 px-2 md:px-4 overflow-x-auto scroll-smooth hide-scrollbar py-2`} style={{ scrollSnapType: 'x mandatory', width: '100%' }}>
          {related.map(r => (
            <a key={r.id} href={`/product/${r.id}`} data-related-card className="flex-shrink-0 bg-white rounded-xl border p-3 shadow-sm snap-start hover:shadow-md transition" style={{ scrollSnapAlign: 'start', minWidth: cardWidth, maxWidth: cardWidth }}>
            <div className="w-full aspect-[4/5] bg-zinc-100 overflow-hidden mb-3 rounded-md">
              <img src={(getImages(r)[0]) || fallbackImg} alt={r.name} className="w-full h-full object-cover" />
            </div>
            <p className="text-sm font-semibold text-zinc-900 line-clamp-2">{r.name}</p>
            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{r.short_description || ''}</p>
            <div className="mt-2">
              {(() => {
                const priceNum = Number(r.price) || 0;
                const mrpNum = Number(r.original_price ?? r.old_price) || 0;
                const showMRP = mrpNum > 0 && mrpNum > priceNum;
                const savePct = showMRP ? Math.round(((mrpNum - priceNum) / mrpNum) * 100) : 0;
                return (
                  <div>
                    <div className="text-primary font-bold">₹{priceNum.toLocaleString('en-IN')}</div>
                    {showMRP && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-xs line-through text-gray-500">₹{mrpNum.toLocaleString('en-IN')}</div>
                        <div className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">Save {savePct}%</div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            </a>
        ))}
          </div>
        {/* debug overlay removed */}

        {/* Right arrow (desktop) */}
        <button
          aria-hidden={!canScrollRight}
          onClick={() => scrollBy('right')}
          className={`hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white border shadow z-20 -mr-2 ${canScrollRight ? '' : 'opacity-40 pointer-events-none'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-zinc-700 rotate-180" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.293 16.293a1 1 0 010-1.414L15.586 11H4a1 1 0 110-2h11.586l-3.293-3.879a1 1 0 111.486-1.318l5 5.875a1 1 0 010 1.318l-5 5.875a1 1 0 01-1.486 0z" clipRule="evenodd"/></svg>
        </button>
      </div>
    </div>
  );
}
