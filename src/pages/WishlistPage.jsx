import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { getImages } from '@/lib/productUtils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Heart } from 'lucide-react';
import emptyWishlistImg from '@/assets/emptyWishlist.png';

const fallbackImg = '/assets/fallback-product.png';

const WishlistPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);

  // SEO: page title
  useEffect(() => {
    document.title = 'Wishlist — Aximake';
  }, []);

  // SEO: meta description for wishlist
  useEffect(() => {
    const desc = 'Your Wishlist at Aximake — saved products and favorites to buy later.';
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
    m.content = desc.slice(0, 160);
  }, []);

  // Fetch wishlist items
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const fetchWishlist = async () => {
      const { data, error } = await supabase
        .from('wishlist')
        .select('id, product_id, products(*)')
        .eq('user_id', user.id)
        .order('id', { ascending: false });
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setWishlist(data || []);
      setLoading(false);
    };
    fetchWishlist();
    // Real-time sync
    const handler = () => fetchWishlist();
    window.addEventListener('wishlist-updated', handler);
    return () => window.removeEventListener('wishlist-updated', handler);
  }, [user]);

  const handleMoveToCart = async (item) => {
    if (!user) return;
    const product = item.products || {};
    // Check if product already in cart
    const { data: existingCart, error: cartFetchError } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('product_id', product.id)
      .maybeSingle();
    if (cartFetchError) {
      toast({ title: 'Error', description: cartFetchError.message, variant: 'destructive' });
      return;
    }
    if (existingCart && existingCart.id) {
      // If already in cart, just increase quantity by 1
      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity: (existingCart.quantity || 1) + 1 })
        .eq('id', existingCart.id);
      if (updateError) {
        toast({ title: 'Error', description: updateError.message, variant: 'destructive' });
        return;
      }
    } else {
      // Add to cart
      const { error: cartError } = await supabase
        .from('cart_items')
        .insert({
          user_id: user.id,
          product_id: product.id,
          name: product.name,
          price: product.price,
          images: product.images,
          image: getImages(product)[0] || fallbackImg,
          quantity: 1,
          category: product.category,
          description: product.description,
          material: product.material,
          color: product.color,
          weight: product.weight,
          dimensions: product.dimensions,
          featured: product.featured,
          item_type: 'product',
          in_stock: product.in_stock,
          sku: product.sku || null,
        });
      if (cartError) {
        toast({ title: 'Error', description: cartError.message, variant: 'destructive' });
        return;
      }
    }
    // Remove from wishlist
    await supabase.from('wishlist').delete().eq('id', item.id);
    window.dispatchEvent(new Event('cart-updated'));
    window.dispatchEvent(new Event('wishlist-updated'));
    toast({ title: 'Moved to Cart', description: `${product.name} added to cart.`, variant: 'default' });
  };

  // Add handleRemove function to remove item from wishlist
  const handleRemove = async (item) => {
    if (!user) return;
    await supabase.from('wishlist').delete().eq('id', item.id);
    window.dispatchEvent(new Event('wishlist-updated'));
    toast({ title: 'Removed', description: `${item.products?.name || item.name} removed from wishlist.`, variant: 'default' });
  };

  if (!user) return <div className="flex justify-center items-center min-h-[60vh]">Sign in to view your wishlist.</div>;
  if (loading) return <div className="flex justify-center items-center min-h-[60vh]">Loading...</div>;

  return (
    <div className="container mx-auto py-0 px-2 sm:px-4">
      <h1 className="text-3xl font-bold mb-8 gradient-text text-center">Your Wishlist</h1>  
          {loading ? (
            <div className="text-center text-muted-foreground py-12">Loading...</div>
          ) : wishlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 w-full">
              <img
                src={emptyWishlistImg}
                alt="Empty Wishlist"
                className="w-80 h-80 object-contain mb-4 lg:w-[30rem] lg:h-[30rem]"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
              <div className="text-center text-muted-foreground text-lg">Your wishlist is empty.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
              {wishlist.map(item => {
                // Support both flat and joined (item.products) data
                const product = item.products || item;
                return (
                  <div
                    key={item.id}
                    className="flex flex-row items-stretch bg-white rounded-xl shadow-md border border-zinc-100 overflow-hidden transition hover:shadow-lg max-w-full min-h-[112px] h-32 sm:h-32"
                  >
                    {/* Product Image - always left, fill card height */}
                    <div className="w-28 h-full flex-shrink-0 flex items-stretch justify-center bg-zinc-50 p-0 cursor-pointer group"
                      onClick={() => navigate(`/product/${product.id}`)}
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for ${product.name}`}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/product/${product.id}`); }}
                    >
                      <img
                        src={getMainImage(product)}
                        alt={product.name}
                        className="w-28 h-full object-cover rounded-none group-hover:opacity-90 transition"
                        style={{ maxHeight: '100%', minHeight: '100%', minWidth: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.onerror = null; e.target.src = fallbackImg; }}
                      />
                    </div>
                    {/* Product Details and Actions */}
                    <div className="flex flex-1 items-center justify-between p-4 gap-2 min-w-0">
                      <div className="flex flex-col min-w-0">
                        <div className="font-semibold text-lg text-zinc-900 line-clamp-2">{product.name}</div>
                        <div className="text-primary font-bold text-base mt-1">₹{product.price}</div>
                        {product.sku && <div className="text-xs text-zinc-500 mt-1">SKU: <span className="font-mono text-xs text-zinc-700">{product.sku}</span></div>}
                        {product.category && <div className="text-xs text-zinc-500 mt-1">{product.category}</div>}
                        {product.color && <div className="text-xs text-zinc-500 mt-1">Color: {product.color}</div>}
                      </div>
                      {/* Actions: icons on mobile, buttons on sm+ */}
                      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 ml-2 shrink-0">
                        <span className="flex sm:hidden gap-2">
                          <button
                            className="p-2 rounded-full bg-primary text-white hover:bg-accent transition focus:outline-none"
                            title="Move to Cart"
                            aria-label="Move to Cart"
                            onClick={() => handleMoveToCart(item)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.35 2.7A1 1 0 007.5 17h9a1 1 0 00.85-1.53L17 13M7 13V6a1 1 0 011-1h3m4 0h2a1 1 0 011 1v7" /></svg>
                          </button>
                          <button
                            className="p-2 rounded-full bg-zinc-200 text-zinc-700 hover:bg-zinc-300 transition focus:outline-none"
                            title="Remove"
                            aria-label="Remove"
                            onClick={() => handleRemove(item)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </span>
                        <span className="hidden sm:flex gap-3">
                          <Button
                            size="sm"
                            className="bg-primary text-white font-semibold rounded-lg px-4 py-2 hover:bg-accent transition"
                            onClick={() => handleMoveToCart(item)}
                          >
                            Move to Cart
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg px-4 py-2 border-zinc-300 text-zinc-700 hover:bg-zinc-100 transition"
                            onClick={() => handleRemove(item)}
                          >
                            Remove
                          </Button>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
    </div>
  );
};

export default WishlistPage;

// Helper to get main image
function getMainImage(product) {
  // If images is an array
  if (Array.isArray(product.images) && product.images.length > 0) {
    return cleanImageUrl(product.images[0]);
  }
  // If images is a JSON string
  if (typeof product.images === 'string') {
    try {
      const arr = JSON.parse(product.images);
      if (Array.isArray(arr) && arr.length > 0) return cleanImageUrl(arr[0]);
    } catch {
      // Not JSON, could be comma-separated or plain string
      if (product.images.includes(',')) {
        return cleanImageUrl(product.images.split(',')[0].trim());
      }
      if (product.images.trim() !== '') {
        return cleanImageUrl(product.images.trim());
      }
    }
  }
  return fallbackImg;
}

function cleanImageUrl(url) {
  if (!url) return fallbackImg;
  let img = url.replace(/[[\]"'{}]/g, '').trim();
  if (!img) return fallbackImg;
  // If already absolute URL
  if (/^https?:\/\//i.test(img)) return img;
  // If starts with products/ (Supabase Storage)
  if (img.startsWith('products/')) {
    return 'https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/product-images/' + img;
  }
  // If starts with /assets/ or /, use as-is
  if (img.startsWith('/assets/')) return img;
  if (img.startsWith('/')) return img;
  // Otherwise, assume it's a filename in /assets/
  return '/assets/' + img;
}
