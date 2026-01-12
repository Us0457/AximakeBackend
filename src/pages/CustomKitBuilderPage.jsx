import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Minus, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

const supabaseBaseUrl = 'https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/product-images/';

function getPrimaryImage(product) {
  try {
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
    if (!images.length && product?.image_url) images = [product.image_url];
    if (!images.length && product?.image) images = [product.image];
    images = images.filter(img => typeof img === 'string' && img.trim()).map(img => {
      if (img.startsWith('http') || img.startsWith('/')) return img;
      return supabaseBaseUrl + img.replace(/^products\//, 'products/');
    });
    if (!images.length) return '/assets/fallback-product.png';
    return images[0];
  } catch (e) {
    return '/assets/fallback-product.png';
  }
}

function parseStock(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Math.max(0, Math.floor(v));
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    if (!isNaN(n)) return Math.max(0, n);
    const s = v.trim().toLowerCase();
    if (['true', 'yes', 'available', 'y', '1', 'in stock', 'instock'].includes(s)) return 1;
    return 0;
  }
  return 0;
}

function getStockForProduct(product) {
  if (!product) return 0;
  const candidates = [product.stock, product.in_stock, product.quantity, product.available, product.qty, product.count];
  for (const c of candidates) {
    const n = parseStock(c);
    if (n > 0) return n;
  }
  // fallback to parsing any numeric-looking fields
  for (const k of Object.keys(product)) {
    const val = product[k];
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      // avoid returning price-like fields by skipping common price keys
      if (['price', 'original_price', 'old_price', 'weight'].includes(k)) continue;
      return Math.floor(val);
    }
    if (typeof val === 'string') {
      const n = parseInt(val, 10);
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return 0;
}

const CustomKitBuilderPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage] = useState(12);
  const [kitName, setKitName] = useState('');
  const [kitItems, setKitItems] = useState({}); // { productId: { product, quantity } }
  const [loading, setLoading] = useState(true);
  const [qtyMap, setQtyMap] = useState({});

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      const { data, error } = await supabase.from('products').select('*').eq('visible', true);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setProducts([]);
      } else {
        setProducts(data || []);
      }
      setLoading(false);
    }
    fetchProducts();
  }, []);

  useEffect(() => {
    // Show all products by default (gallery view). Searching/filtering will narrow results.
    let r = Array.isArray(products) ? products.slice() : [];
    if (search && search.trim() !== '') {
      const s = search.toLowerCase();
      r = r.filter(p => (p.name || '').toLowerCase().includes(s) || (String(p.sku || '')).toLowerCase().includes(s) || (p.category || '').toLowerCase().includes(s));
    }
    setFiltered(r);
    setPage(1);
  }, [products, search]);

  const paginated = filtered.slice((page-1)*perPage, page*perPage);

  const addToKit = (product, qty = 1) => {
    if (!product) return;
    const available = getStockForProduct(product);
    if (available <= 0) {
      toast({ title: 'Out of stock', description: `${product.name} is out of stock.`, variant: 'destructive' });
      return;
    }
    const pid = String(product.id);
    const q = Math.max(1, Math.min(Number(qty) || 1, available));
    setKitItems(prev => {
      const copy = { ...prev };
      if (copy[pid]) {
        copy[pid] = { product: copy[pid].product, quantity: Math.min((copy[pid].quantity || 0) + q, available) };
      } else {
        copy[pid] = { product, quantity: q };
      }
      return copy;
    });
    setQtyMap(prev => ({ ...prev, [product.id]: 1 }));
    toast({ title: 'Added', description: `${product.name} (${q}) added to kit.`, variant: 'default' });
  };

  const removeFromKit = (productId) => {
    const pid = String(productId);
    setKitItems(prev => { const c = { ...prev }; delete c[pid]; return c; });
    toast({ title: 'Removed', description: 'Component removed from kit.', variant: 'default' });
  };

  const clearKit = () => { setKitItems({}); setKitName(''); };

  const kitTotals = () => {
    const items = Object.values(kitItems || {});
    const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
    const totalPrice = items.reduce((s, i) => s + (Number(i.product.price || 0) * (i.quantity || 1)), 0);
    return { totalQty, totalPrice };
  };

  const handleAddKitToCart = async () => {
    if (!user) { navigate('/auth'); return; }
    if (!kitName || kitName.trim() === '') { toast({ title: 'Kit name required', description: 'Please provide a kit name.', variant: 'destructive' }); return; }
    const itemsArray = Object.values(kitItems).map(i => ({ product_id: i.product.id, name: i.product.name, quantity: i.quantity, price: Number(i.product.price || 0) }));
    if (itemsArray.length === 0) { toast({ title: 'Empty kit', description: 'Please add components to the kit before adding to cart.', variant: 'destructive' }); return; }
    const { totalPrice } = { totalPrice: kitTotals().totalPrice };
    try {
      const insertPayload = {
        user_id: user.id,
        item_type: 'custom_kit',
        name: kitName,
        price: Number(totalPrice),
        quantity: 1,
        // Some deployments/schema versions don't have an `items` column.
        // Store kit components in `description` as JSON under `custom_kit_items`.
        description: JSON.stringify({ custom_kit_items: itemsArray }),
        created_at: new Date().toISOString(),
      };
      const { data: inserted, error } = await supabase.from('cart_items').insert([insertPayload]).select();
      console.debug('CustomKit insert result', { inserted, error });
      if (error) {
        toast({ title: 'Cart Error', description: error.message, variant: 'destructive' });
        return;
      }
      // sanity-check: fetch user's cart immediately and log count to help debug visibility
      try {
        const { data: cartData, error: cartErr } = await supabase.from('cart_items').select('id, name, item_type, description, quantity').eq('user_id', user.id);
        console.debug('Post-insert cart fetch', { cartData, cartErr });
        if (!cartErr && Array.isArray(cartData)) {
          toast({ title: 'Kit added', description: `${kitName} added to cart (${cartData.length} items).`, variant: 'default' });
        } else {
          toast({ title: 'Kit added', description: `${kitName} added to cart.`, variant: 'default' });
        }
      } catch (e) {
        console.debug('Post-insert fetch failed', e);
        toast({ title: 'Kit added', description: `${kitName} added to cart.`, variant: 'default' });
      }
      // notify listeners and navigate to cart
      window.dispatchEvent(new Event('cart-updated'));
      navigate('/cart');
    } catch (err) {
      toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-4">Build a Custom Electronics Kit</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Components</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex items-center gap-2">
                <Input placeholder="Search by name, SKU or category" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {loading ? <div>Loading…</div> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {paginated.map(p => {
                    const available = getStockForProduct(p);
                    const inStock = available > 0;
                    const qty = qtyMap[p.id] ?? 1;
                    return (
                        <div key={p.id} className="border rounded overflow-hidden bg-white shadow-sm hover:shadow-md transition h-80 flex flex-col">
                          <div className="w-full h-[80%] sm:h-[62%] bg-gray-50 overflow-hidden">
                          <img src={getPrimaryImage(p)} alt={p.name} className="w-full h-full object-cover" onError={e => { e.target.onerror = null; e.target.src = '/assets/fallback-product.png'; }} />
                        </div>
                        <div className="flex-1 p-2 flex flex-col justify-between">
                          <div>
                            <div className="font-semibold text-sm truncate line-clamp-2">{p.name}</div>
                            <div className="text-xs text-muted-foreground">SKU: {p.sku || '—'}</div>
                            <div className="text-sm text-muted-foreground mt-1 font-medium">₹{Number(p.price || 0)}</div>
                            <div className="text-xs mt-1">{inStock ? (available > 1 ? `In stock (${available})` : 'In stock') : 'Out of stock'}</div>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button aria-label="decrease" onClick={() => setQtyMap(prev => ({ ...prev, [p.id]: Math.max(1, (prev[p.id] ?? 1) - 1) }))} disabled={!inStock || qty <= 1} className="p-1 border rounded-md bg-white hover:bg-gray-100 disabled:opacity-50">
                                <Minus className="w-3 h-3" />
                              </button>
                              <Input className="w-12 h-7 text-center text-sm" value={qty} onChange={e => {
                                let v = parseInt(e.target.value || '1', 10);
                                if (isNaN(v) || v < 1) v = 1;
                                v = Math.min(v, available || 1);
                                setQtyMap(prev => ({ ...prev, [p.id]: v }));
                              }} />
                              <button aria-label="increase" onClick={() => setQtyMap(prev => ({ ...prev, [p.id]: Math.min((prev[p.id] ?? 1) + 1, available || 1) }))} disabled={!inStock || qty >= available} className="p-1 border rounded-md bg-white hover:bg-gray-100 disabled:opacity-50">
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <div>
                              <Button onClick={() => addToKit(p, qty)} disabled={!inStock} className="hidden md:inline-flex px-3 py-1 text-sm">Add to Kit</Button>
                              <Button onClick={() => addToKit(p, qty)} disabled={!inStock} className="md:hidden p-1">
                                <ShoppingCart className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-4 flex justify-between items-center">
                <div>
                  <Button variant="ghost" onClick={() => setPage(Math.max(1, page-1))} disabled={page === 1}>Prev</Button>
                  <span className="px-2">{page}</span>
                  <Button variant="ghost" onClick={() => setPage(page + 1)} disabled={((page)*perPage) >= filtered.length}>Next</Button>
                </div>
                <div className="text-sm text-muted-foreground">Showing {filtered.length} components</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="sticky top-24">
          <Card className="p-4">
            <CardHeader>
              <CardTitle>Kit Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="block text-sm mb-1">Kit Name</label>
              <Input placeholder="My Arduino Starter Kit" value={kitName} onChange={e => setKitName(e.target.value)} />
              <div className="mt-3">
                <div className="font-medium">Components</div>
                <div className="max-h-48 overflow-auto mt-2">
                  {Object.values(kitItems).length === 0 && <div className="text-sm text-muted-foreground">No components added yet.</div>}
                  {Object.values(kitItems).map(i => (
                    <div key={i.product.id} className="flex items-center justify-between gap-2 py-2 border-b">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{i.product.name}</div>
                        <div className="text-xs text-muted-foreground">Qty: {i.quantity} • ₹{Number(i.product.price)}</div>
                      </div>
                      <div className="flex flex-col items-end">
                        <Button variant="ghost" onClick={() => removeFromKit(i.product.id)}>Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 border-t pt-3">
                <div className="flex justify-between"><span>Total items</span><span>{kitTotals().totalQty}</span></div>
                <div className="flex justify-between font-bold mt-1"><span>Total price</span><span>₹{Number(kitTotals().totalPrice).toLocaleString()}</span></div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Button onClick={handleAddKitToCart} className="w-full" disabled={Object.values(kitItems).length === 0}>Add Kit to Cart</Button>
                <Button variant="outline" onClick={clearKit} className="w-full">Clear Kit</Button>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">This kit will be packed as a single bundle. Individual item warranties apply.</div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default CustomKitBuilderPage;
