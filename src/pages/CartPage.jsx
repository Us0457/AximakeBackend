import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Trash2, MapPin, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog } from '@/components/ui/dialog';
import { Card as UICard, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import uploadImg from '@/assets/upload.jpg';
import ModelViewer from '@/components/custom-print/ModelViewer';
import emptyCartImg from '@/assets/emptyCart.png';
import { useToast } from '@/components/ui/use-toast';
import { getApiUrl, getPhpUrl } from '@/lib/utils';

function ModelViewerWrapper({ url, color }) {
  const [modelData, setModelData] = useState(null);
  useEffect(() => {
    if (!url) return;
    fetch(url)
      .then(res => res.arrayBuffer())
      .then(setModelData)
      .catch(() => setModelData(null));
  }, [url]);
  if (!modelData) return <div className="w-20 h-20 flex items-center justify-center text-xs text-muted-foreground">Loading…</div>;
  // Pass a prop to ModelViewer to render the model smaller within the full viewer
  return <ModelViewer modelData={modelData} modelColor={color} scaleFactor={0.6} small />;
}

function getSupabasePublicUrl(file_url) {
  // If already a full URL, return as is
  if (/^https?:\/\//i.test(file_url)) return file_url;
  // Otherwise, build the public URL for Supabase storage
  return `https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/stl-files/${file_url.replace(/^stl-files\//, '')}`;
}

const CartPage = () => {
  const { user } = useAuth();
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null); // null | 'success' | 'error'
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState({ name: '', flat_no: '', area: '', city: '', state: '', pincode: '', phone: '', email: '' });
  const [addressLoading, setAddressLoading] = useState(true);
  const [addingAddress, setAddingAddress] = useState(false);
  const [profileRole, setProfileRole] = useState(null);
  const addressFormRef = useRef(null);
  const navigate = useNavigate();
  const { toast } = useToast ? useToast() : { toast: () => {} };
  const [couponCode, setCouponCode] = useState('');
  const [couponStatus, setCouponStatus] = useState(null); // null | 'success' | 'invalid' | 'expired' | 'inactive' | 'limit'
  const [coupon, setCoupon] = useState(null);
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchCart = async () => {
      setLoading(true);
      // Fetch all product details for cart items, including item_type and all needed fields
      const { data, error } = await supabase
        .from('cart_items')
        .select('id, quantity, name, price, image, category, description, product_id, item_type, material, images, color, infill, file_url, featured') // removed stock
        .eq('user_id', user.id);
      if (!error) setCart(data || []);
      setLoading(false);
    };
    fetchCart();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchAddresses = async () => {
      setAddressLoading(true);
      const { data, error } = await supabase.from('addresses').select('*').eq('user_id', user.id);
      if (!error) {
        setAddresses(data || []);
        // Restore selected address from localStorage if available and valid
        const savedId = localStorage.getItem('selectedAddressId');
        if (savedId && data && data.length > 0) {
          const found = data.find(addr => String(addr.id) === String(savedId));
          setSelectedAddress(found || data[0]);
        } else {
          setSelectedAddress(data && data.length > 0 ? data[0] : null);
        }
      }
      setAddressLoading(false);
    };
    fetchAddresses();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // Fetch user role from profiles table
    const fetchRole = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (!error && data) setProfileRole(data.role);
    };
    fetchRole();
  }, [user]);

  // Separate cart items into products and quotes based on properties
  const products = cart.filter((item) => item.product_id);
  const quotes = cart.filter((item) => !item.product_id && (item.file_name || item.file_url));

  // Helper to trigger cart counter update in header
  const triggerCartUpdate = () => {
    window.dispatchEvent(new Event('cart-updated'));
  };

  // Call triggerCartUpdate after cart changes
  useEffect(() => {
    if (!loading) {
      triggerCartUpdate();
    }
    // Only trigger when cart changes (not on mount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.length]);

  const handleRemove = async (id) => {
    await supabase.from('cart_items').delete().eq('id', id);
    setCart((prev) => prev.filter((item) => item.id !== id));
    triggerCartUpdate();
  };

  const handleQuantityChange = async (id, delta) => {
    const item = cart.find((i) => i.id === id);
    if (!item) return;
    const newQty = Math.max(1, (item.quantity || 1) + delta);
    await supabase.from('cart_items').update({ quantity: newQty }).eq('id', id);
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, quantity: newQty } : i));
    triggerCartUpdate();
  };

  const getTotal = () => cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (item.quantity || 1)), 0);

  // Helper to build order summary for email
  const buildOrderSummary = () => {
    if (!cart.length) return 'No items.';
    return cart.map((item, idx) =>
      `${idx + 1}. File: ${item.quotes?.file_name || ''}, Material: ${item.quotes?.material || ''}, Color: ${item.quotes?.color || ''}, Price: ₹${item.quotes?.price || 0}, Qty: ${item.quantity || 1}`
    ).join('\n');
  };

  // Generate a unique order code
  function generateOrderCode() {
    // Example: AXMK-YYXXXXXX (YY=year, XXXXXX=random alphanum)
    const year = new Date().getFullYear().toString().slice(-2);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `AXMK-${year}${random}`;
  }

  // Coupon validation
  const validateCoupon = async (code) => {
    setCouponStatus(null);
    setDiscount(0);
    setCoupon(null);
    if (!code) return;
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.trim())
      .maybeSingle();
    if (error || !data) {
      setCouponStatus('invalid');
      return;
    }
    const today = new Date();
    if (!data.active) {
      setCouponStatus('inactive');
      return;
    }
    if (data.valid_from && new Date(data.valid_from) > today) {
      setCouponStatus('expired');
      return;
    }
    if (data.valid_to && new Date(data.valid_to) < today) {
      setCouponStatus('expired');
      return;
    }
    if (data.usage_limit && data.usage_count >= data.usage_limit) {
      setCouponStatus('limit');
      return;
    }
    setCoupon(data);
    setCouponStatus('success');
    // Calculate discount
    let total = getTotal();
    let disc = 0;
    if (data.discount_type === 'percentage') {
      disc = Math.round((total * Number(data.value)) / 100);
    } else {
      disc = Math.min(Number(data.value), total);
    }
    setDiscount(disc);
  };

  // Re-validate coupon when code changes
  useEffect(() => {
    if (!couponCode) {
      setCouponStatus(null);
      setDiscount(0);
      setCoupon(null);
      return;
    }
    const timeout = setTimeout(() => {
      validateCoupon(couponCode);
    }, 500);
    return () => clearTimeout(timeout);
  }, [couponCode, cart]);

  // Handler for Proceed to Payment
  const handleProceedToPayment = async () => {
    if (!selectedAddress) {
      setShowAddressForm(true);
      if (toast) toast({ title: 'Please add a delivery address before proceeding.' });
      return;
    }
    if (!user) return;

    // --- Validation for address fields ---
    const requiredAddressFields = ['name', 'flat_no', 'area', 'city', 'state', 'pincode', 'phone', 'email'];
    for (const field of requiredAddressFields) {
      if (!selectedAddress[field] || String(selectedAddress[field]).trim() === '') {
        toast({ title: 'Invalid Address', description: `Please fill in the ${field} field.`, variant: 'destructive' });
        return;
      }
    }

    // --- Validation for cart items ---
    // Allow both products (with product_id) and quotes (with file_name or file_url)
    const validItems = cart.filter(item =>
      // Must have a name (for products) or file_name (for quotes)
      (item.name || item.file_name || item.file_url) &&
      // Must have a valid price and quantity
      Number(item.price) > 0 &&
      Number(item.quantity) > 0
    );
    if (validItems.length === 0) {
      toast({ title: 'Invalid Cart', description: 'Your cart contains invalid items. Please review your cart.', variant: 'destructive' });
      return;
    }

    setSending(true);
    setEmailStatus(null);
    // Build order payload
    const orderPayload = {
      user_id: user.id,
      items: validItems.map(item => {
        // For quote items (no product_id), use the same display name logic as in renderQuoteCard
        let fileName = item.file_name;
        if (!fileName && item.file_url) {
          const match = item.file_url.match(/([^/]+)$/);
          fileName = match ? match[1] : undefined;
        }
        let displayName = '';
        if (fileName && typeof fileName === 'string') {
          const fileNameOnly = fileName.split('/').pop();
          const cleaned = fileNameOnly.replace(/^\d+[_\-.]*/, '').split('.')[0];
          displayName = cleaned.replace(/[_\-.]+/g, ' ').split(' ').filter(Boolean).slice(0, 2).join(' ');
        } else if (item.file_url && typeof item.file_url === 'string') {
          const fileNameOnly = item.file_url.split('/').pop();
          const cleaned = fileNameOnly.replace(/^\d+[_\-.]*/, '').split('.')[0];
          displayName = cleaned.replace(/[_\-.]+/g, ' ').split(' ').filter(Boolean).slice(0, 2).join(' ');
        } else if (item.name) {
          displayName = item.name.replace(/[_\-.]+/g, ' ').split(' ').filter(Boolean).slice(0, 2).join(' ');
        }
        if (!displayName) displayName = 'Quote';
        return {
          id: item.id,
          name: item.product_id ? item.name : displayName,
          quantity: item.quantity || 1,
          price: item.price,
          product_id: item.product_id || null,
          file_name: fileName || null,
          file_url: item.file_url || null,
          material: item.material || null,
          color: item.color || null,
          infill: item.infill || null,
          images: item.images || null,
          category: item.category || null,
          description: item.description || null,
          item_type: item.item_type || null,
        };
      }),
      address: selectedAddress ? {
        name: selectedAddress.name,
        flat_no: selectedAddress.flat_no,
        area: selectedAddress.area,
        city: selectedAddress.city,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        phone: selectedAddress.phone,
        email: selectedAddress.email || user.email || '',
      } : null,
      discount_code: coupon ? coupon.code : null,
      discount_amount: discount,
      sub_total: getTotal(), // Store subtotal before discount
      total: getTotal() - discount,
      order_status: 'pending',
      created_at: new Date().toISOString(),
      order_code: generateOrderCode(),
    };
    // Insert order into Supabase
    const { data: insertData, error: insertError } = await supabase.from('orders').insert([orderPayload]).select();
    // If coupon applied, increment usage_count
    if (coupon) {
      await supabase.rpc('increment_coupon_usage', { coupon_code: coupon.code });
    }
    let orderId = orderPayload.order_code;
    if (insertData && insertData[0] && insertData[0].id) {
      orderId = insertData[0].order_code || insertData[0].id;
    }
    // Create Shiprocket order after order is inserted
    try {
      const shiprocketRes = await fetch(getApiUrl('/api/create-shiprocket-order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderPayload, address: { ...orderPayload.address, email: orderPayload.address.email || user.email || '' } })
      });
      const shiprocketData = await shiprocketRes.json();
      if (!shiprocketRes.ok) {
        toast({ title: 'Shiprocket Error', description: shiprocketData.error || 'Failed to create shipment', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Shiprocket Error', description: err.message, variant: 'destructive' });
    }
    // Send order confirmation email (existing logic)
    try {
      await fetch(getPhpUrl('/order-status-email.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          to: user.email,
          name: user.user_metadata?.full_name || user.name || (selectedAddress?.name) || 'Customer',
          order_id: orderId,
          status: 'confirmation',
          items: JSON.stringify(orderPayload.items),
          address: JSON.stringify({
            name: user.user_metadata?.full_name || user.name || selectedAddress?.name || '',
            flat_no: selectedAddress?.flat_no || '',
            area: selectedAddress?.area || '',
            city: selectedAddress?.city || '',
            state: selectedAddress?.state || '',
            pincode: selectedAddress?.pincode || '',
            phone: selectedAddress?.phone || user.phone || ''
          })
        }),
      });
      setEmailStatus('success');
    } catch (err) {
      setEmailStatus('error');
    }
    // Clear the cart after successful order
    await supabase.from('cart_items').delete().eq('user_id', user.id);
    setCart([]);
    setSending(false);
    navigate('/thank-you');
  };

  const handleSelectAddress = (addr) => {
    setSelectedAddress(addr);
    localStorage.setItem('selectedAddressId', addr.id);
    setAddressModalOpen(false);
  };

  const handleAddressFormChange = (e) => {
    const { name, value } = e.target;
    setAddressForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    if (!addressForm.name || !addressForm.flat_no || !addressForm.area || !addressForm.city || !addressForm.state || !addressForm.pincode || !addressForm.phone || !addressForm.email) return;
    setAddingAddress(true);
    const { data, error } = await supabase.from('addresses').insert([{ ...addressForm, user_id: user.id }]).select();
    if (!error && data && data.length > 0) {
      setAddresses((prev) => [...prev, data[0]]);
      setSelectedAddress(data[0]);
      setAddressForm({ name: '', flat_no: '', area: '', city: '', state: '', pincode: '', phone: '', email: '' });
      setShowAddressForm(false);
    }
    setAddingAddress(false);
  };

  // Helper to render product details
  const renderProductCard = (item) => {
    // Only render if item is a product (has product_id)
    if (!item.product_id) return null;
    // Always use only the main image for display
    let productImage = item.image;
    if (!productImage && item.images) {
      if (Array.isArray(item.images)) {
        productImage = item.images[0];
      } else if (typeof item.images === 'string' && item.images.includes(',')) {
        productImage = item.images.split(',')[0].trim();
      } else if (typeof item.images === 'string' && item.images.trim() !== '') {
        productImage = item.images.trim();
      }
    }
    if (productImage) {
      productImage = productImage.replace(/["'{}]/g, '').trim();
    }
    if (!productImage) {
      productImage = 'https://images.unsplash.com/photo-1585592049294-8f466326930a';
    }
    // If the image path is not an absolute URL, prepend the Supabase storage URL if needed
    if (productImage && !/^https?:\/\//i.test(productImage)) {
      const supabaseBaseUrl = 'https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/product-images/';
      if (productImage.startsWith('products/')) {
        productImage = supabaseBaseUrl + productImage.replace(/^products\//, 'products/');
      } else if (!productImage.startsWith('/')) {
        productImage = '/' + productImage;
      }
    }
    return (
      <Card key={item.id} className="relative flex flex-row items-stretch gap-0 p-0 mb-4 shadow-lg border border-blue-100 bg-white/90 hover:shadow-2xl transition-all min-h-[112px] h-32 sm:h-32 overflow-hidden w-full">
        {/* Product Image - left, fills height and width */}
        <div className="w-28 h-full flex-shrink-0 flex items-stretch justify-center bg-zinc-50 p-0">
          <img
            src={productImage}
            alt={item.name}
            className="w-full h-full object-cover rounded-none"
            style={{ minHeight: '100%', minWidth: '100%', objectFit: 'cover' }}
          />
        </div>
        {/* Product Details and Actions */}
        <div className="flex flex-1 flex-col justify-between p-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <span className="text-base font-bold text-indigo-800 truncate line-clamp-1">{item.name}</span>
            {item.description && (
              <span className="text-xs text-zinc-700 line-clamp-1 mb-1">
                {item.description.split(' ').slice(0, 10).join(' ')}{item.description.split(' ').length > 10 ? '…' : ''}
              </span>
            )}
          </div>
          <div className="flex items-end justify-between gap-2 mt-2">
            <span className="text-base font-bold text-primary">₹{Number(item.price).toLocaleString()}</span>
            {/* Desktop: Quantity selector and delete icon on right */}
            <div className="hidden md:flex items-center gap-2 ml-auto">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleQuantityChange(item.id, -1)} disabled={(item.quantity || 1) <= 1}>-</Button>
                <span className="px-2 min-w-[2ch] text-center">{item.quantity || 1}</span>
                <Button size="sm" variant="outline" onClick={() => handleQuantityChange(item.id, 1)}>+</Button>
              </div>
              <Button size="icon" variant="destructive" onClick={() => handleRemove(item.id)} className="ml-2"><Trash2 className="w-4 h-4" /></Button>
            </div>
            {/* Mobile: Quantity selector in the middle, delete icon on right */}
            <div className="flex md:hidden items-center gap-2">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleQuantityChange(item.id, -1)} disabled={(item.quantity || 1) <= 1}>-</Button>
                <span className="px-2 min-w-[2ch] text-center">{item.quantity || 1}</span>
                <Button size="sm" variant="outline" onClick={() => handleQuantityChange(item.id, 1)}>+</Button>
              </div>
              <Button size="icon" variant="destructive" onClick={() => handleRemove(item.id)} className="ml-2"><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  // Helper to render quote details
  const renderQuoteCard = (item) => {
    // Only render if item is a quote (no product_id, but has file_name or file_url)
    if (item.product_id || !(item.file_name || item.file_url)) return null;
    // Extract a display name from file_name or file_url
    let displayName = '';
    if (item.file_name && typeof item.file_name === 'string') {
      // Get only the actual file name (after last /), remove extension, then take first 1-2 words
      const fileNameOnly = item.file_name.split('/').pop();
      // Remove any leading numbers/underscores/hyphens (e.g. "12345_filename.stl" -> "filename")
      const cleaned = fileNameOnly.replace(/^\d+[_\-.]*/, '').split('.')[0];
      displayName = cleaned.replace(/[_\-.]+/g, ' ').split(' ').filter(Boolean).slice(0, 2).join(' ');
    } else if (item.file_url && typeof item.file_url === 'string') {
      const fileNameOnly = item.file_url.split('/').pop();
      const cleaned = fileNameOnly.replace(/^\d+[_\-.]*/, '').split('.')[0];
      displayName = cleaned.replace(/[_\-.]+/g, ' ').split(' ').filter(Boolean).slice(0, 2).join(' ');
    } else if (item.name) {
      displayName = item.name.replace(/[_\-.]+/g, ' ').split(' ').filter(Boolean).slice(0, 2).join(' ');
    }
    if (!displayName) displayName = 'Quote';
    return (
      <Card key={item.id} className="relative flex flex-row items-stretch gap-0 p-0 mb-4 shadow-lg border border-yellow-100 bg-white/90 hover:shadow-2xl transition-all min-h-[112px] h-32 sm:h-32 overflow-hidden w-full">
        {/* Quote Image/Box - left, fills height and width */}
        <div className="w-28 h-full flex-shrink-0 flex items-stretch justify-center bg-yellow-50 p-0 border-r border-yellow-100">
          <div className="w-full h-full flex items-center justify-center">
            {/* Show a static 3D model preview if available, else fallback image */}
            {item.file_url && item.file_url.toLowerCase().endsWith('.stl') ? (
              <ModelViewerWrapper url={getSupabasePublicUrl(item.file_url)} color={item.color || '#FFD700'} />
            ) : (
              <img
                src={uploadImg}
                alt="3D Model Preview"
                className="w-20 h-20 object-contain rounded-md bg-white border border-yellow-200"
                style={{ maxWidth: '80px', maxHeight: '80px' }}
              />
            )}
          </div>
        </div>
        {/* Quote Details and Actions - right */}
        <div className="flex flex-1 flex-col justify-between p-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <span className="text-base font-bold text-yellow-800 truncate line-clamp-1">
              {displayName}
            </span>
            <div className="flex flex-wrap gap-2 text-xs text-zinc-600 mb-1">
              {item.material && <span>Material: <span className="font-medium text-yellow-700">{item.material}</span></span>}
              {item.color && (
                <span className="flex items-center gap-1">Color:
                  <span className="inline-block w-3 h-3 rounded-full border border-gray-300 align-middle" style={{ background: (typeof item.color === 'string' && item.color.startsWith('#')) ? item.color : '#ccc' }}></span>
                  <span className="font-medium text-yellow-700">{item.color_name || (typeof item.color === 'string' && item.color.startsWith('#') ? 'Custom' : item.color)}</span>
                </span>
              )}
              {(item.infill !== undefined && item.infill !== null) && <span>Infill: <span className="font-medium text-yellow-700">{item.infill}%</span></span>}
            </div>
            {item.description && <div className="text-xs text-zinc-700 mb-1 line-clamp-2">{item.description}</div>}
          </div>
          <div className="flex items-end justify-between gap-2 mt-2">
            <span className="text-base font-bold text-yellow-700">₹{Math.round(Number(item.price)).toLocaleString()}</span>
            {/* Desktop: Quantity selector and delete icon on right */}
            <div className="hidden md:flex items-center gap-2 ml-auto">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleQuantityChange(item.id, -1)} disabled={(item.quantity || 1) <= 1}>-</Button>
                <span className="px-2 min-w-[2ch] text-center">{item.quantity || 1}</span>
                <Button size="sm" variant="outline" onClick={() => handleQuantityChange(item.id, 1)}>+</Button>
              </div>
              <Button size="icon" variant="destructive" onClick={() => handleRemove(item.id)} className="ml-2"><Trash2 className="w-4 h-4" /></Button>
            </div>
            {/* Mobile: Quantity selector in the middle, delete icon on right */}
            <div className="flex md:hidden items-center gap-2">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleQuantityChange(item.id, -1)} disabled={(item.quantity || 1) <= 1}>-</Button>
                <span className="px-2 min-w-[2ch] text-center">{item.quantity || 1}</span>
                <Button size="sm" variant="outline" onClick={() => handleQuantityChange(item.id, 1)}>+</Button>
              </div>
              <Button size="icon" variant="destructive" onClick={() => handleRemove(item.id)} className="ml-2"><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="w-full md:mx-auto md:px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6 gradient-text">Your Cart</h1>
      <UICard className="mb-6 py-2 px-0 md:px-4 rounded-xl shadow border border-primary/10 bg-white flex flex-col justify-center min-h-0 h-auto w-full overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between py-2 px-2 md:px-0 gap-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="text-primary w-5 h-5 flex-shrink-0" />
            <CardTitle className="text-base font-semibold truncate">Delivery Address</CardTitle>
          </div>
          {addresses.length > 0 && !showAddressForm && (
            <Button size="sm" variant="outline" onClick={() => setAddressModalOpen(true)} className="flex-shrink-0">Change</Button>
          )}
        </CardHeader>
        <CardContent className="py-1 px-2 md:px-0">
          {addressLoading ? (
            <span className="text-muted-foreground">Loading...</span>
          ) : (
            <>
              {selectedAddress && !showAddressForm ? (
                <div className="flex flex-col gap-0.5 text-sm break-words">
                  <div className="font-semibold leading-tight truncate">{selectedAddress.name ? `${selectedAddress.name}, ` : ''}{selectedAddress.flat_no}, {selectedAddress.area}</div>
                  <div className="text-xs text-muted-foreground leading-tight truncate">{selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode}</div>
                  <div className="text-xs text-muted-foreground leading-tight truncate">Phone: {selectedAddress.phone}</div>
                </div>
              ) : null}
              <AnimatePresence>
                {showAddressForm && (
                  <motion.form
                    ref={addressFormRef}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleAddAddress}
                    className="overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4 mt-2"
                  >
                    <div>
                      <Label htmlFor="name">Recipient Name</Label>
                      <Input id="name" name="name" value={addressForm.name} onChange={handleAddressFormChange} required />
                    </div>
                    <div>
                      <Label htmlFor="flat_no">Flat / House No.</Label>
                      <Input id="flat_no" name="flat_no" value={addressForm.flat_no} onChange={handleAddressFormChange} required />
                    </div>
                    <div>
                      <Label htmlFor="area">Area / Locality</Label>
                      <Input id="area" name="area" value={addressForm.area} onChange={handleAddressFormChange} required />
                    </div>
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input id="city" name="city" value={addressForm.city} onChange={handleAddressFormChange} required />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input id="state" name="state" value={addressForm.state} onChange={handleAddressFormChange} required />
                    </div>
                    <div>
                      <Label htmlFor="pincode">Pincode</Label>
                      <Input id="pincode" name="pincode" value={addressForm.pincode} onChange={handleAddressFormChange} required />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" name="phone" value={addressForm.phone} onChange={handleAddressFormChange} required />
                    </div>
                    <div className="col-span-full flex gap-2 justify-end mt-2">
                      <Button type="submit" disabled={addingAddress}>{addingAddress ? 'Saving...' : 'Add Address'}</Button>
                      {addresses.length > 0 && (
                        <Button type="button" variant="ghost" onClick={() => setShowAddressForm(false)}>Cancel</Button>
                      )}
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
              {!selectedAddress && !showAddressForm && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setShowAddressForm(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Add Address
                </Button>
              )}
            </>
          )}
        </CardContent>
      </UICard>
      {/* Only render the address selection Dialog/modal when addressModalOpen is true and user has clicked 'Change'. */}
      {addressModalOpen && (
        <Dialog open={addressModalOpen} onOpenChange={setAddressModalOpen}>
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-lg sm:max-w-md mx-4 max-h-[350px] overflow-y-auto bg-background rounded-xl shadow-2xl border border-primary/20 p-0"
              style={{ minWidth: 'min(95vw, 320px)' }}
            >
              <UICard className="rounded-xl border-0 shadow-none">
                <CardHeader>
                  <CardTitle>Select Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 mb-6">
                    {addresses.length > 0 ? addresses.map(addr => (
                      <div key={addr.id} className={`border rounded-lg p-4 flex flex-col gap-1 cursor-pointer ${selectedAddress && selectedAddress.id === addr.id ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`} onClick={() => { handleSelectAddress(addr); setAddressModalOpen(false); }}>
                        <div className="font-semibold">{addr.name ? `${addr.name}, ` : ''}{addr.flat_no}, {addr.area}</div>
                        <div className="text-sm text-muted-foreground">{addr.city}, {addr.state} - {addr.pincode}</div>
                        <div className="text-xs text-muted-foreground">Phone: {addr.phone}</div>
                      </div>
                    )) : <div className="text-center text-muted-foreground py-8">No addresses saved yet.</div>}
                  </div>
                </CardContent>
              </UICard>
            </motion.div>
          </div>
        </Dialog>
      )}
      <div className="flex flex-col md:flex-row md:items-start gap-8">
        {/* Left: Cart Items Table */}
        <div className="w-full md:w-2/3 md:pr-4">
          {loading ? (
            <Card className="p-8 text-center text-muted-foreground">Loading...</Card>
          ) : (products.length === 0 && quotes.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 w-full">
              <img
                src={emptyCartImg}
                alt="Empty Cart"
                className="w-80 h-80 object-contain mb-4 lg:w-[30rem] lg:h-[30rem]"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
              <div className="text-center text-muted-foreground text-lg">Your cart is empty.</div>
            </div>
          ) : (
            <>
              {products.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-4 text-indigo-700 flex items-center gap-2">Products <span className="bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 text-xs">{products.length}</span></h2>
                  <div className="grid gap-4">
                    {products.map(renderProductCard)}
                  </div>
                </div>
              )}
              {quotes.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-4 text-yellow-700 flex items-center gap-2">Quotes <span className="bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5 text-xs">{quotes.length}</span></h2>
                  <div className="grid gap-4">
                    {quotes.map(renderQuoteCard)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {/* Right: Order Summary */}
        <div className="w-full md:w-1/3 md:pl-4 flex flex-col items-stretch md:items-end">
          <Card className="w-full md:w-80 p-3 md:p-6 shadow-xl border border-accent/30 bg-gradient-to-br from-primary/10 to-accent/10 mb-6">
            <h2 className="text-xl font-bold mb-4 text-primary">Order Summary</h2>
            {/* Coupon Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Coupon Code</label>
              <div className="flex gap-2">
                <Input
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className="flex-1"
                  maxLength={32}
                />
                <Button type="button" variant="outline" onClick={() => validateCoupon(couponCode)} disabled={!couponCode}>Apply</Button>
              </div>
              {couponStatus === 'success' && (
                <div className="text-green-600 text-xs mt-1">Coupon applied successfully!</div>
              )}
              {couponStatus === 'invalid' && (
                <div className="text-red-500 text-xs mt-1">Invalid coupon code.</div>
              )}
              {couponStatus === 'expired' && (
                <div className="text-red-500 text-xs mt-1">Coupon expired or not yet valid.</div>
              )}
              {couponStatus === 'inactive' && (
                <div className="text-red-500 text-xs mt-1">Coupon is not active.</div>
              )}
              {couponStatus === 'limit' && (
                <div className="text-red-500 text-xs mt-1">Coupon usage limit reached.</div>
              )}
            </div>
            <div className="flex justify-between mb-2 text-base">
              <span>Subtotal</span>
              <span>₹{Math.round(getTotal()).toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between mb-2 text-base text-green-700">
                <span>Discount ({coupon?.code})</span>
                <span>-₹{discount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-accent/20 my-2"></div>
            <div className="flex justify-between items-center text-lg font-bold mb-4">
              <span>Total</span>
              <span>₹{Math.round(getTotal() - discount).toLocaleString()}</span>
            </div>
            <Button className="w-full bg-gradient-to-r from-primary to-accent text-white text-lg py-2 mt-2" onClick={handleProceedToPayment} disabled={sending || cart.length === 0 || !selectedAddress}>
              {sending ? 'Sending...' : 'Proceed to Payment'}
            </Button>
          </Card>
          <Card className="p-3 md:p-6 w-full md:w-80">
            <h2 className="text-xl font-semibold mb-4">Payment Options</h2>
            <div className="flex flex-col gap-4">
              <Button variant="outline" className="w-full">Pay with Credit/Debit Card</Button>
              <Button variant="outline" className="w-full">Pay with UPI</Button>
              <Button variant="outline" className="w-full">Pay with Net Banking</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
