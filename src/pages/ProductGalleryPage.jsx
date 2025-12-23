import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { getCategories, getPriceRange } from '@/lib/productUtils';
import ProductRatingSummary from '@/components/product/ProductRatingSummary';
import { Filter, Heart, ShoppingCart } from 'lucide-react';
import { useState as useReactState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const ProductGalleryPage = () => {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [sliderRange, setSliderRange] = useState([0, 10000]);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage] = useState(9);
  const [loading, setLoading] = useState(true);
  const [showMobileFilter, setShowMobileFilter] = useReactState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [wishlistIds, setWishlistIds] = useState([]);
  const [sortOrder, setSortOrder] = useState('none'); // 'none', 'asc', 'desc'
  const [allProductNames, setAllProductNames] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  // Accept search and category from query param
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get('search') || '';
    const categoryParam = params.get('category') || '';
    if (searchParam && searchParam !== search) setSearch(searchParam);
    // If a category query param exists, sync it into selectedCategories.
    // If no category param is present but we currently have selected categories, clear them —
    // this ensures clicking the "All Products" breadcrumb link navigates back to an unfiltered view.
    if (categoryParam && categoryParam !== '' && !selectedCategories.includes(categoryParam)) {
      setSelectedCategories([categoryParam]);
    } else if (!categoryParam && selectedCategories.length > 0) {
      setSelectedCategories([]);
    }
  }, [location.search]);

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      const { data } = await supabase.from('products').select('*').eq('visible', true);
      setProducts(data || []);
      setLoading(false);
    }
    fetchProducts();
  }, []);

  useEffect(() => {
    setCategories(getCategories(products));
    const [min, max] = getPriceRange(products);
    setSliderRange([min, max]);
    setPriceRange([min, max]);
  }, [products]);

  useEffect(() => {
    let result = products;
    if (selectedCategories.length)
      result = result.filter(p => selectedCategories.includes(p.category));
    result = result.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);
    if (featuredOnly) result = result.filter(p => p.featured);
    if (search) result = result.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    if (sortOrder === 'asc') result = [...result].sort((a, b) => a.price - b.price);
    if (sortOrder === 'desc') result = [...result].sort((a, b) => b.price - a.price);
    setFiltered(result);
    setPage(1);
  }, [products, selectedCategories, priceRange, featuredOnly, search, sortOrder]);

  // Pagination
  const paginated = filtered.slice((page-1)*perPage, page*perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  // Image util (from FeaturedProducts)
  const supabaseBaseUrl = 'https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/product-images/';
  function getImages(product) {
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
    images = images.filter(img => typeof img === 'string' && img.trim()).map(img => {
      if (img.startsWith('http') || img.startsWith('/')) return img;
      return supabaseBaseUrl + img.replace(/^products\//, 'products/');
    });
    if (!images.length && product?.image_url) images = [product.image_url];
    if (!images.length) images = ['https://images.unsplash.com/photo-1585592049294-8f466326930a'];
    return images;
  }

  const navigate = useNavigate();
  // Navigate to product detail while preserving the current breadcrumb context
  function handleViewProduct(id) {
    // Build breadcrumbSource according to selection state
    // Navigate without passing breadcrumb state — PDP must be data-driven.
    navigate(`/product/${id}`);
  }

  // Fetch wishlist product IDs for current user
  useEffect(() => {
    if (!user) return setWishlistIds([]);
    let ignore = false;
    async function fetchWishlistIds() {
      const { data, error } = await supabase
        .from('wishlist')
        .select('product_id')
        .eq('user_id', user.id);
      if (!ignore) setWishlistIds(data ? data.map(w => w.product_id) : []);
    }
    fetchWishlistIds();
    // Real-time sync
    const handler = () => fetchWishlistIds();
    window.addEventListener('wishlist-updated', handler);
    return () => { ignore = true; window.removeEventListener('wishlist-updated', handler); };
  }, [user]);

  const handleToggleWishlist = async (product) => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to use wishlist.', variant: 'destructive' });
      return;
    }
    const isWishlisted = wishlistIds.includes(product.id);
    if (isWishlisted) {
      // Remove from wishlist
      const { error } = await supabase.from('wishlist').delete().eq('user_id', user.id).eq('product_id', product.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      setWishlistIds(ids => ids.filter(id => id !== product.id));
      toast({ title: 'Removed from Wishlist', description: `${product.name} removed from your wishlist.`, variant: 'default' });
    } else {
      // Add to wishlist
      const { error } = await supabase.from('wishlist').insert({
        user_id: user.id,
        product_id: product.id,
        name: product.name,
        price: product.price,
        images: product.images,
        category: product.category,
        description: product.description,
        material: product.material,
        color: product.color,
        weight: product.weight,
        dimensions: product.dimensions,
        featured: product.featured,
        in_stock: product.in_stock,
      });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      setWishlistIds(ids => [...ids, product.id]);
      toast({ title: 'Added to Wishlist', description: `${product.name} added to your wishlist!`, variant: 'default' });
    }
    window.dispatchEvent(new Event('wishlist-updated'));
  };

  const handleAddToCart = async (e, product, qty = 1) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to use cart.', variant: 'default' });
      navigate('/auth');
      return;
    }
    try {
      const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from('cart_items').update({ quantity: (existing.quantity || 0) + qty }).eq('id', existing.id);
      } else {
        await supabase.from('cart_items').insert({ user_id: user.id, product_id: product.id, name: product.name, price: product.price, images: product.images, quantity: qty, sku: product.sku || null });
      }
      window.dispatchEvent(new Event('cart-updated'));
      toast({ title: 'Added to cart', description: `${product.name} added to cart.`, variant: 'default' });
    } catch (err) {
      toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' });
    }
  };

  // Fetch all product names for suggestions
  useEffect(() => {
    async function fetchNames() {
      const { data } = await supabase.from('products').select('name');
      if (data) setAllProductNames(data.map(p => p.name));
    }
    fetchNames();
  }, []);


  // breadcrumb helper: split a category string into hierarchy parts
  function buildBreadcrumbParts(cat) {
    if (!cat || String(cat).trim() === '') return [];
    // split on common separators used in CMS: >, /, |, ›, -
    const parts = String(cat).split(/\s*[>\/|›-]\s*/).map(p => p.trim()).filter(Boolean);
    return parts;
  }

  // Update suggestions as user types
  useEffect(() => {
    if (search.trim() === '') {
      setSuggestions([]);
      return;
    }
    setSuggestions(
      allProductNames.filter(name =>
        name.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 5)
    );
  }, [search, allProductNames]);

  // determine currentCategory from selectedCategories or URL param
  const params = new URLSearchParams(location.search);
  const categoryParam = params.get('category') || '';
  const currentCategory = (selectedCategories && selectedCategories[0]) || categoryParam || '';

  // Breadcrumb logic rules:
  // - No filter applied: Home > All Products
  // - Single category selected (or single category param): Home > Products > Category Name
  // - Multiple categories selected: Home > Products (and show "Filtered by: A, B")
  const selectedCount = (selectedCategories && selectedCategories.length) || 0;
  const multipleSelected = selectedCount > 1;
  const singleCategoryValue = selectedCount === 1 ? selectedCategories[0] : (selectedCount === 0 && categoryParam ? categoryParam : null);
  const crumbs = singleCategoryValue ? buildBreadcrumbParts(singleCategoryValue) : [];

  // SEO: dynamic title depending on category or all products
  useEffect(() => {
    const title = currentCategory ? `${currentCategory} Products — Aximake` : 'All Products — Aximake';
    document.title = title;
  }, [currentCategory, filtered.length]);

  // SEO: meta description for gallery / category
  useEffect(() => {
    const base = currentCategory ? `${currentCategory} products` : 'All products';
    const desc = `${base} at Aximake — curated 3D printing products and electronics kits.`;
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
    m.content = desc.slice(0, 160);
  }, [currentCategory]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="container mx-auto px-2 md:px-3 py-4 max-w-7xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-zinc-600 mb-3" aria-label="Breadcrumb">
        <Link to="/" className="hover:underline">Home</Link>
        <span className="mx-2 text-zinc-400">›</span>
        {multipleSelected ? (
          // Multiple categories selected: keep breadcrumb short
          <>
            <Link
              to="/products"
              className="hover:underline"
              onClick={(e) => {
                // ensure we clear in-component filters when navigating to All Products
                e.preventDefault();
                setSelectedCategories([]);
                setPriceRange(sliderRange);
                setFeaturedOnly(false);
                setSearch('');
                navigate('/products');
              }}
            >All Products</Link>
          </>
        ) : singleCategoryValue ? (
          // Single category: Home > All Products > Category Name (respect hierarchy)
          <>
            <Link
              to="/products"
              className="hover:underline"
              onClick={(e) => {
                e.preventDefault();
                setSelectedCategories([]);
                setPriceRange(sliderRange);
                setFeaturedOnly(false);
                setSearch('');
                navigate('/products');
              }}
            >All Products</Link>
            <span className="mx-2 text-zinc-400">›</span>
            {crumbs.length <= 1 ? (
              <span className="text-zinc-500">{crumbs[0] || singleCategoryValue}</span>
            ) : (
              <>
                <Link to={`/products?category=${encodeURIComponent(crumbs[0])}`} className="hover:underline">{crumbs[0]}</Link>
                <span className="mx-2 text-zinc-400">›</span>
                {crumbs.slice(1).map((c, idx) => {
                  const isLast = idx === crumbs.slice(1).length - 1;
                  return (
                    <span key={c}>
                      {isLast ? <span className="text-zinc-500">{c}</span> : <span className="text-zinc-700">{c}</span>}
                      {!isLast && <span className="mx-2 text-zinc-400">›</span>}
                    </span>
                  );
                })}
              </>
            )}
          </>
        ) : (
          // No filters: All Products
          <span className="text-zinc-500">All Products</span>
        )}
      </nav>

      {/* Header row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <h1 className="text-2xl md:text-3xl font-semibold">{singleCategoryValue ? (crumbs.length ? crumbs[crumbs.length - 1] : singleCategoryValue) : 'All Products'}</h1>
          <span className="text-sm text-zinc-500">{filtered.length} products</span>
        </div>
        {/* Show selected categories when multiple filters are applied */}
        {multipleSelected && (
          <div className="mt-2 text-sm text-zinc-600">Filtered by: {selectedCategories.join(', ')}</div>
        )}

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:flex-none">
            <Input
              placeholder="Search products..."
              value={search}
              onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
              className="w-full max-w-lg px-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-2 focus:ring-indigo-400"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute bg-white border border-zinc-200 rounded shadow z-30 mt-1 w-full max-w-lg">
                {suggestions.map(s => (
                  <li
                    key={s}
                    className="px-4 py-2 cursor-pointer hover:bg-primary/10"
                    onMouseDown={() => { setSearch(s); setShowSuggestions(false); }}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              className="border border-zinc-200 rounded px-2 py-1 text-sm bg-white"
              aria-label="Sort products"
            >
              <option value="none">Sort: Default</option>
              <option value="asc">Price: Low to High</option>
              <option value="desc">Price: High to Low</option>
            </select>

            {/* Mobile filters button */}
            <div className="md:hidden">
              <button
                className="ml-2 flex items-center justify-center p-2 rounded bg-white border border-zinc-200"
                aria-label="Show filters"
                onClick={() => setShowMobileFilter(true)}
                type="button"
              >
                <Filter className="w-5 h-5 text-zinc-700" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-4">
        {/* Sidebar: only on md+ screens */}
        <aside className="md:w-[260px] w-full md:sticky top-24 z-10 bg-white rounded border border-zinc-100 p-4 mb-4 md:mb-0 hidden md:block">
          <h2 className="text-lg font-semibold mb-4 text-zinc-800">Filters</h2>
          <div className="mb-4">
            <Accordion type="multiple" defaultValue={["categories", "price", "featured"]} className="mb-4 space-y-2">
              <AccordionItem value="categories">
                <AccordionTrigger className="py-3">Categories</AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-3">
                    {categories.map(cat => (
                      <label key={cat} className="flex items-center gap-2 cursor-pointer py-1">
                        <Checkbox checked={selectedCategories.includes(cat)} onCheckedChange={checked => setSelectedCategories(prev => checked ? [...prev, cat] : prev.filter(c => c !== cat))} />
                        <span className="text-sm text-zinc-700">{cat}</span>
                      </label>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
              {/* Sort by dropdown below Categories */}
              <div className="mb-2 px-2">
                <label htmlFor="sortOrderSidebar" className="block text-sm font-medium text-zinc-700 mb-1">Sort by:</label>
                <select
                  id="sortOrderSidebar"
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value)}
                  className="border border-indigo-200 rounded px-2 py-1 text-sm w-full focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="none">Default</option>
                  <option value="asc">Price: Low to High</option>
                  <option value="desc">Price: High to Low</option>
                </select>
              </div>
              <AccordionItem value="price">
                <AccordionTrigger className="py-3">Price Range</AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-2 pt-2">
                    <Slider min={sliderRange[0]} max={sliderRange[1]} step={10} value={priceRange} onValueChange={setPriceRange} className="mb-2" />
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>₹{sliderRange[0]}</span>
                      <span>₹{sliderRange[1]}</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-700">
                      <span>Selected: ₹{priceRange[0]}</span>
                      <span>to ₹{priceRange[1]}</span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="featured">
                <AccordionTrigger className="py-3">Featured Only</AccordionTrigger>
                <AccordionContent>
                  <label className="flex items-center gap-2 cursor-pointer py-1">
                    <Checkbox checked={featuredOnly} onCheckedChange={setFeaturedOnly} />
                    <span className="text-sm text-zinc-700">Show only featured products</span>
                  </label>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          <Button variant="outline" className="w-full mt-2" onClick={() => { setSelectedCategories([]); setPriceRange(sliderRange); setFeaturedOnly(false); setSearch(''); }}>Clear Filters</Button>
        </aside>
        {/* Product Grid */}
        <main className={`flex-1`}> 
          {loading ? (
            <div className="text-center text-muted-foreground py-12">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">No products found.</div>
          ) : (
            <div className={`w-full`}> 
                <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 w-full px-0 sm:px-2 mx-0` }>
              {paginated.map(product => {
                const images = getImages(product);
                const isWishlisted = wishlistIds.includes(product.id);
                return (
                  <div
                    key={product.id}
                    className="product-card bg-white rounded-lg border border-zinc-100 flex flex-col transition-colors duration-150 hover:shadow-sm cursor-pointer w-full relative overflow-hidden"
                    style={{ minWidth: 0 }}
                    onClick={() => handleViewProduct(product.id)}
                    tabIndex={0}
                    role="button"
                    aria-label={product.name}
                  >
                    {/* Heart Icon - top right, absolute */}
                    <button
                      className="absolute top-3 left-3 z-10 p-1 rounded-full border bg-white border-zinc-100 hover:bg-green-50 transition"
                      aria-label="Add to cart"
                      onClick={e => { e.stopPropagation(); handleAddToCart(e, product, 1); }}
                      tabIndex={0}
                    >
                      <ShoppingCart className="w-5 h-5 text-zinc-800" />
                      <span className="sr-only">Add to cart</span>
                    </button>
                    <button
                      className={`absolute top-3 right-3 z-10 p-1 rounded-full border bg-white border-zinc-100 hover:bg-red-50 transition group ${isWishlisted ? 'text-red-500' : 'text-zinc-400'}`}
                      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                      aria-pressed={isWishlisted}
                      onClick={e => { e.stopPropagation(); handleToggleWishlist(product); }}
                      tabIndex={0}
                    >
                      <Heart className={`w-5 h-5 transition-colors ${isWishlisted ? 'fill-red-200' : ''}`} />
                      <span className="sr-only">{isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}</span>
                    </button>
                    {/* Image section (square) */}
                    <div className="w-full relative overflow-hidden bg-zinc-100" style={{ paddingTop: '100%' }}>
                      <img
                        src={images[0] || '/placeholder.png'}
                        alt={product.name}
                        className="absolute inset-0 w-full h-full object-cover object-center"
                        style={{ display: 'block' }}
                      />
                    </div>

                    {/* Content section */}
                      <div className="card-details flex flex-col flex-1 w-full px-3 py-2 text-left justify-between">
                        <div className="mb-1">
                          <h2 className="font-medium text-sm text-zinc-900 line-clamp-2">{product.name}{product.featured && (
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-semibold ml-2">Featured</span>
                          )}</h2>
                          {product.sku && (
                            <div className="text-xs text-zinc-500 mt-1">SKU : <span className="font-mono text-xs text-zinc-700 ml-1">{product.sku}</span></div>
                          )}
                        </div>
                        <div className="mb-1">
                          <ProductRatingSummary productId={product.id} />
                        </div>
                        <div className="font-bold text-primary text-base mb-1">
                          {(() => {
                            const priceNum = Number(product.price) || 0;
                            const mrpNum = Number(product.original_price ?? product.old_price) || 0;
                            const showMRP = mrpNum > 0 && mrpNum > priceNum;
                            const savePct = showMRP ? Math.round(((mrpNum - priceNum) / mrpNum) * 100) : 0;
                            return (
                              <div>
                                <div>₹{priceNum.toLocaleString('en-IN')}</div>
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
                        {/* SKU shown inline after title; removed duplicate block */}
                      </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => { setPage(p => Math.max(1, p-1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Prev</Button>
              <span className="text-sm">Page {page} of {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => { setPage(p => Math.min(totalPages, p+1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Next</Button>
            </div>
          )}
        </main>
      </div>
      {/* Mobile Filter Drawer/Modal */}
      {showMobileFilter && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileFilter(false)} />
          <div className="relative w-full bg-white rounded-t-2xl shadow-lg p-6 max-h-[80vh] overflow-y-auto animate-slideUp">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-indigo-700">Filters</h2>
              <button className="text-2xl text-gray-400 hover:text-primary" onClick={() => setShowMobileFilter(false)}>&times;</button>
            </div>
            <div className="mb-4">
              <Accordion type="multiple" defaultValue={["categories", "price", "featured"]} className="mb-4 space-y-2">
                <AccordionItem value="categories">
                  <AccordionTrigger className="py-3">Categories</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-3">
                      {categories.map(cat => (
                        <label key={cat} className="flex items-center gap-2 cursor-pointer py-1">
                          <Checkbox checked={selectedCategories.includes(cat)} onCheckedChange={checked => setSelectedCategories(prev => checked ? [...prev, cat] : prev.filter(c => c !== cat))} />
                          <span className="text-sm text-zinc-700">{cat}</span>
                        </label>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                {/* Sort by dropdown below Categories */}
                <div className="mb-2 px-2">
                  <label htmlFor="sortOrderMobile" className="block text-sm font-medium text-zinc-700 mb-1">Sort by:</label>
                  <select
                    id="sortOrderMobile"
                    value={sortOrder}
                    onChange={e => setSortOrder(e.target.value)}
                    className="border border-indigo-200 rounded px-2 py-1 text-sm w-full focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="none">Default</option>
                    <option value="asc">Price: Low to High</option>
                    <option value="desc">Price: High to Low</option>
                  </select>
                </div>
                <AccordionItem value="price">
                  <AccordionTrigger className="py-3">Price Range</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-2 pt-2">
                      <Slider min={sliderRange[0]} max={sliderRange[1]} step={10} value={priceRange} onValueChange={setPriceRange} className="mb-2" />
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>₹{sliderRange[0]}</span>
                        <span>₹{sliderRange[1]}</span>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-700">
                        <span>Selected: ₹{priceRange[0]}</span>
                        <span>to ₹{priceRange[1]}</span>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="featured">
                  <AccordionTrigger className="py-3">Featured Only</AccordionTrigger>
                  <AccordionContent>
                    <label className="flex items-center gap-2 cursor-pointer py-1">
                      <Checkbox checked={featuredOnly} onCheckedChange={setFeaturedOnly} />
                      <span className="text-sm text-zinc-700">Show only featured products</span>
                    </label>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
            <Button variant="outline" className="w-full mt-2" onClick={() => { setSelectedCategories([]); setPriceRange(sliderRange); setFeaturedOnly(false); setSearch(''); setShowMobileFilter(false); }}>Clear Filters</Button>
          </div>
          <style>{`
            @keyframes slideUp {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
            .animate-slideUp {
              animation: slideUp 0.3s cubic-bezier(0.4,0,0.2,1);
            }
          `}</style>
        </div>
      )}
    </motion.div>
  );
};

export default ProductGalleryPage;