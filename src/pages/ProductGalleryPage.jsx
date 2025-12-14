import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { getCategories, getPriceRange } from '@/lib/productUtils';
import ProductRatingSummary from '@/components/product/ProductRatingSummary';
import { Filter } from 'lucide-react';
import { useState as useReactState } from 'react';
import { Heart } from 'lucide-react';
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
    if (categoryParam && categoryParam !== '' && !selectedCategories.includes(categoryParam)) setSelectedCategories([categoryParam]);
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

  // Add this helper at the top-level of the component if not present
  function handleViewProduct(id) {
    window.location.href = `/product/${id}`;
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

  // Fetch all product names for suggestions
  useEffect(() => {
    async function fetchNames() {
      const { data } = await supabase.from('products').select('name');
      if (data) setAllProductNames(data.map(p => p.name));
    }
    fetchNames();
  }, []);

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

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="container mx-auto px-2 md:px-4 py-8 max-w-7xl">
      <h1 className="text-4xl font-bold mb-8 gradient-text">Product Gallery</h1>
      {/* Search bar and filter icon row */}
      <div className="flex items-center justify-center mb-8 gap-2 w-full">
        <Input
          placeholder="Search products..."
          value={search}
          onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
          className="w-full max-w-lg px-4 py-3 text-lg border border-indigo-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-400"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute bg-white border border-indigo-200 rounded shadow z-30 mt-1 w-full max-w-lg">
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
        <button
          className="ml-2 flex items-center justify-center p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 md:hidden"
          aria-label="Show filters"
          onClick={() => setShowMobileFilter(true)}
          type="button"
        >
          <Filter className="w-6 h-6 text-indigo-700" />
        </button>
      </div>
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar: only on md+ screens */}
        <aside className="md:w-64 w-full md:sticky top-24 z-10 bg-white/80 rounded-xl shadow border border-indigo-100 p-6 mb-6 md:mb-0 space-y-6 hidden md:block">
          <h2 className="text-xl font-bold mb-4 text-indigo-700">Filters</h2>
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
        <main className="flex-1">
          {loading ? (
            <div className="text-center text-muted-foreground py-12">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">No products found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 w-full px-0 sm:px-4 mx-0">
              {paginated.map(product => {
                const images = getImages(product);
                const isWishlisted = wishlistIds.includes(product.id);
                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl shadow-lg border border-border/20 flex flex-col transition-transform duration-200 hover:scale-[1.025] hover:shadow-2xl cursor-pointer h-[420px] w-full relative"
                    style={{ minWidth: 0 }}
                    onClick={() => handleViewProduct(product.id)}
                    tabIndex={0}
                    role="button"
                    aria-label={product.name}
                  >
                    {/* Heart Icon - top right, absolute */}
                    <button
                      className={`absolute top-3 right-3 z-10 p-2 rounded-full border bg-white/90 border-zinc-200 shadow-sm hover:bg-red-100 transition group ${isWishlisted ? 'text-red-500' : 'text-zinc-400'}`}
                      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                      aria-pressed={isWishlisted}
                      onClick={e => { e.stopPropagation(); handleToggleWishlist(product); }}
                      tabIndex={0}
                    >
                      <Heart className={`w-6 h-6 transition-colors ${isWishlisted ? 'fill-red-200' : ''}`} />
                      <span className="sr-only">{isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}</span>
                    </button>
                    {/* Image section: 65% of card height */}
                    <div className="w-full flex-shrink-0" style={{ height: '65%' }}>
                      <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-t-2xl bg-zinc-100" style={{ height: '100%' }}>
                        <img
                          src={images[0] || '/placeholder.png'}
                          alt={product.name}
                          className="w-full h-full object-cover object-center"
                          style={{ display: 'block' }}
                        />
                      </div>
                    </div>
                    {/* Content section: 35% of card height */}
                    <div className="flex flex-col flex-1 w-full px-5 pb-5 pt-3 text-left justify-between" style={{ height: '35%' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="font-bold text-lg md:text-xl text-zinc-900 truncate">{product.name}</h2>
                        {product.featured && (
                          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-semibold ml-1">Featured</span>
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
                      <p className="text-sm text-zinc-600 mb-2 line-clamp-2 min-h-[38px]">{product.description}</p>
                    </div>
                  </div>
                );
              })}
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