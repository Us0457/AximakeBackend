import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { getCategories, getPriceRange } from '@/lib/productUtils';
import ElectronicsKitCard from '@/components/product/ElectronicsKitCard';
import { Heart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

// Electronics-specific categories to show (will be intersected with DB categories)
const ELECTRONICS_CATEGORIES = [
  'Arduino Kits', 'IoT Kits', 'Beginner Kits', 'Sensors', 'Robotics', 'Learning Projects', 'Advanced Kits'
];

const ElectronicsGalleryPage = () => {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [sliderRange, setSliderRange] = useState([0, 10000]);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage] = useState(12);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const [wishlistIds, setWishlistIds] = useState([]);
  const [sortOrder, setSortOrder] = useState('none');

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      const { data } = await supabase.from('products').select('*').eq('visible', true);
      setProducts(data || []);
      setLoading(false);
    }
    fetchProducts();
  }, []);

  // Detect if a product should be considered an electronics kit
  function isKitProduct(p) {
    if (!p) return false;
    if (p.category && ELECTRONICS_CATEGORIES.includes(p.category)) return true;
    if (p.short_description) return true;
    if (p.difficulty) return true;
    // includes/outcomes may be stored as JSON string or jsonb or array
    if (p.includes && (Array.isArray(p.includes) ? p.includes.length > 0 : String(p.includes).trim() !== '' && String(p.includes) !== '[]')) return true;
    if (p.outcomes && (Array.isArray(p.outcomes) ? p.outcomes.length > 0 : String(p.outcomes).trim() !== '' && String(p.outcomes) !== '[]')) return true;
    return false;
  }

  useEffect(() => {
    const dbCats = getCategories(products);
    // Keep only the categories relevant to electronics and that exist in DB
    const inter = ELECTRONICS_CATEGORIES.filter(c => dbCats.includes(c));
    setCategories(inter.length ? inter : ELECTRONICS_CATEGORIES.filter(Boolean));
    const kits = products.filter(p => isKitProduct(p));
    const [min, max] = getPriceRange(kits);
    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) ? max : 10000;
    setSliderRange([safeMin, safeMax]);
    setPriceRange([safeMin, safeMax]);
  }, [products]);

  useEffect(() => {
    let result = products.filter(p => isKitProduct(p));
    if (selectedCategories.length) result = result.filter(p => selectedCategories.includes(p.category));
    result = result.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);
    if (featuredOnly) result = result.filter(p => p.featured);
    if (search) result = result.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    if (sortOrder === 'asc') result = [...result].sort((a, b) => a.price - b.price);
    if (sortOrder === 'desc') result = [...result].sort((a, b) => b.price - a.price);
    setFiltered(result);
    setPage(1);
  }, [products, selectedCategories, priceRange, featuredOnly, search, sortOrder]);

  // Pagination
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  // Wishlist sync
  useEffect(() => {
    if (!user) return setWishlistIds([]);
    let ignore = false;
    async function fetchWishlistIds() {
      const { data } = await supabase.from('wishlist').select('product_id').eq('user_id', user.id);
      if (!ignore) setWishlistIds(data ? data.map(w => w.product_id) : []);
    }
    fetchWishlistIds();
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
      const { error } = await supabase.from('wishlist').delete().eq('user_id', user.id).eq('product_id', product.id);
      if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setWishlistIds(ids => ids.filter(id => id !== product.id));
      toast({ title: 'Removed', description: 'Removed from wishlist', variant: 'default' });
    } else {
      const { error } = await supabase.from('wishlist').insert({ user_id: user.id, product_id: product.id, name: product.name, price: product.price, images: product.images });
      if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setWishlistIds(ids => [...ids, product.id]);
      toast({ title: 'Added', description: 'Added to wishlist', variant: 'default' });
    }
    window.dispatchEvent(new Event('wishlist-updated'));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="container mx-auto px-2 sm:px-4 lg:px-6 py-8 max-w-7xl">
      <h1 className="text-3xl md:text-4xl font-bold mb-6">Electronics Kits</h1>

      <div className="flex flex-col md:flex-row gap-6">
        <aside className="md:w-64 w-full bg-white rounded-xl shadow border p-5 hidden md:block">
          <h3 className="font-semibold mb-3">Filters</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Sort</label>
            <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="w-full rounded border px-2 py-1 text-sm">
              <option value="none">Default</option>
              <option value="asc">Price: Low to High</option>
              <option value="desc">Price: High to Low</option>
            </select>
          </div>
          <div className="mb-4">
            <h4 className="font-medium mb-2">Categories</h4>
            <div className="flex flex-col gap-2">
              {categories.map(cat => (
                <label key={cat} className="flex items-center gap-2">
                  <Checkbox checked={selectedCategories.includes(cat)} onCheckedChange={checked => setSelectedCategories(prev => checked ? [...prev, cat] : prev.filter(c => c !== cat))} />
                  <span className="text-sm">{cat}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <h4 className="font-medium mb-2">Price Range</h4>
            <Slider min={sliderRange[0]} max={sliderRange[1]} step={10} value={priceRange} onValueChange={setPriceRange} />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>₹{sliderRange[0]}</span>
              <span>₹{sliderRange[1]}</span>
            </div>
          </div>
          <div className="mb-4">
            <label className="flex items-center gap-2">
              <Checkbox checked={featuredOnly} onCheckedChange={setFeaturedOnly} />
              <span className="text-sm">Featured only</span>
            </label>
          </div>
          <Button variant="outline" onClick={() => { setSelectedCategories([]); setPriceRange(sliderRange); setFeaturedOnly(false); setSearch(''); }}>Clear</Button>
        </aside>

        <main className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <Input placeholder="Search kits..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 max-w-lg" />
            <Link to="/products" className="text-sm text-zinc-500">View all products</Link>
          </div>

          {loading ? (
            <div className="py-12 text-center">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {paginated.map(p => (
                <ElectronicsKitCard key={p.id} product={p} onWishlistToggle={handleToggleWishlist} isWishlisted={wishlistIds.includes(p.id)} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-6">
              <Button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p-1))}>Prev</Button>
              <span>Page {page} of {totalPages}</span>
              <Button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p+1))}>Next</Button>
            </div>
          )}
        </main>
      </div>
    </motion.div>
  );
};

export default ElectronicsGalleryPage;
