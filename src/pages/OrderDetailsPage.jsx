import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import ShipmentTracker from '@/components/ShipmentTracker';
import ModelViewer from '@/components/custom-print/ModelViewer';
import uploadImg from '@/assets/upload.jpg';
import { getLatestScanLabel, getApiUrl } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ChevronDown } from 'lucide-react';

function getOrderCode(order) {
  if (!order) return '';
  if (order.order_code) return order.order_code;
  const idPart = (order.id || '').toString(36).toUpperCase().padStart(6, '0').slice(-6);
  const datePart = order.created_at ? new Date(order.created_at).getFullYear().toString().slice(-2) : 'XX';
  return `AXMK-${datePart}${idPart}`;
}

const OrderDetailsPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Ordered by mistake');
  const [cancelComment, setCancelComment] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  useEffect(() => { document.title = `Order ${orderId} — Aximake`; }, [orderId]);

  async function fetchOrder() {
    setLoading(true);
    try {
      let found = null;
      if (orderId) {
        // Try by primary id (UUID) first
        const r1 = await supabase
          .from('orders')
          .select('id, user_id, created_at, price, order_status, items, address, order_code, discount_amount, total, shiprocket_shipment_id, shiprocket_awb, shiprocket_status, shiprocket_label_url, shiprocket_events')
          .eq('id', orderId)
          .limit(1)
          .single();
        if (!r1.error && r1.data) found = r1.data;
        // If not found, try treating the param as an order_code
        if (!found) {
          const r2 = await supabase
            .from('orders')
            .select('id, user_id, created_at, price, order_status, items, address, order_code, discount_amount, total, shiprocket_shipment_id, shiprocket_awb, shiprocket_status, shiprocket_label_url, shiprocket_events')
            .eq('order_code', orderId)
            .limit(1)
            .single();
          if (!r2.error && r2.data) found = r2.data;
        }
      }
      // Normalize items field: sometimes items may be stored as JSON string
      if (found && found.items && typeof found.items === 'string') {
        try {
          const parsed = JSON.parse(found.items);
          if (Array.isArray(parsed)) found.items = parsed;
        } catch (e) {
          // leave as-is
        }
      }
      setOrder(found || null);
    } catch (e) {
      setOrder(null);
    }
    setLoading(false);
  }

  useEffect(() => { fetchOrder(); }, [orderId]);

  // Re-fetch on relevant DB changes for this order
  useEffect(() => {
    if (!order || !order.id) return;
    const sub = supabase
      .channel(`order-details-${order.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` }, () => fetchOrder())
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [order && order.id]);

  // Local wrapper to fetch STL binary and render ModelViewer like Cart does
  function ModelViewerWrapper({ url, color }) {
    const [modelData, setModelData] = useState(null);
    useEffect(() => {
      let mounted = true;
      if (!url) { setModelData(null); return; }
      fetch(url)
        .then(res => res.arrayBuffer())
        .then(ab => { if (mounted) setModelData(ab); })
        .catch(() => { if (mounted) setModelData(null); });
      return () => { mounted = false; };
    }, [url]);
    if (!modelData) return <div className="w-20 h-20 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-500">Loading…</div>;
    return <ModelViewer modelData={modelData} modelColor={color || '#FFD700'} small scaleFactor={0.6} />;
  }

  function isOrderCancelable(o) {
    if (!o) return false;
    const awb = o.shiprocket_awb && String(o.shiprocket_awb).trim();
    if (awb) return false;
    const fallback = o.shiprocket_status || o.order_status || 'pending';
    const displayStatus = getLatestScanLabel(o.shiprocket_events, fallback);
    const cur = String(displayStatus || '').toLowerCase();
    const blocked = ['ready to ship', 'ready', 'shipped', 'picked', 'picked up', 'delivered', 'cancel', 'return', 'fulfilled'];
    return !blocked.some(b => cur.includes(b));
  }

  async function handleDownloadInvoice(o) {
    if (!o?.shiprocket_shipment_id) return;
    try {
      const res = await fetch(getApiUrl(`/api/shiprocket-invoice?shipment_id=${o.shiprocket_shipment_id}&skip_update=1`));
      const contentType = res.headers.get('content-type') || '';
      let data = null;
      if (contentType.includes('application/json')) data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error || data?.message || data?.details || `HTTP ${res.status}`;
        alert('Invoice not available: ' + msg);
        return;
      }
      if (!data || !data.invoice_url) {
        alert('Invoice is not available yet. Please try again later.');
        return;
      }
      // Open invoice URL using a real anchor click to satisfy mobile browser user-gesture requirements.
      // Mobile browsers treat this as a genuine user action and will allow cross-origin navigation.
      const a = document.createElement('a');
      a.href = data.invoice_url;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      // remove anchor immediately
      a.remove();
      // Refresh order data after initiating the navigation
      await fetchOrder();
    } catch (e) {
      alert('Failed to download invoice: ' + (e?.message || e));
    }
  }

  async function confirmCancelOrder() {
    if (!order) return;
    setCancelError(null);
    setCancelLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/shiprocket-cancel-order'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id, reason: cancelReason, comment: cancelComment })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || data?.message || `HTTP ${res.status}`;
        setCancelError(msg);
        setCancelLoading(false);
        return;
      }
      await fetchOrder();
      setShowCancelModal(false);
      setCancelComment('');
      setCancelReason('Ordered by mistake');
      alert('Your order was successfully cancelled. A confirmation has been sent to your email.');
    } catch (e) {
      setCancelError(e?.message || String(e));
    }
    setCancelLoading(false);
  }

  if (loading) return <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-10 max-w-3xl">Loading order...</div>;
  if (!order) return <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-10 max-w-3xl">Order not found.</div>;

  const displayStatus = getLatestScanLabel(order.shiprocket_events, order.shiprocket_status || order.order_status || 'pending');

  return (
    <div className="mx-auto w-full px-2 sm:px-4 py-10 md:max-w-6xl">
      <div className="mb-6 md:pb-4 md:border-b md:border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="text-sm text-gray-600" onClick={() => navigate(-1)}>← Back</button>
            <h1 className="text-2xl font-bold text-primary">Order #{getOrderCode(order)}</h1>
          </div>
          <div className="hidden md:flex md:items-center md:gap-6">
            <div className="text-sm text-gray-500">Date: {new Date(order.created_at).toLocaleString()}</div>
            <div className="text-sm text-gray-500">Status: <span className={`font-semibold ${String(displayStatus||'').toLowerCase().includes('cancel') ? 'text-red-600' : 'text-green-700'}`}>{displayStatus}</span></div>
          </div>
        </div>
      </div>

      <div className="w-full md:bg-white md:rounded-lg md:shadow-md md:p-6">
        <div className="flex flex-col md:flex-row gap-6 md:divide-x md:divide-gray-100">
          <div className="w-full md:w-2/3 md:pr-6">
            <div className="px-2 sm:px-4 py-2 md:p-0">
              <div className="block md:hidden mb-2 text-sm text-gray-500">Date: {new Date(order.created_at).toLocaleString()}</div>
              <div className="block md:hidden mb-2 text-sm text-gray-500">Status: <span className={`font-semibold ${String(displayStatus||'').toLowerCase().includes('cancel') ? 'text-red-600' : 'text-green-700'}`}>{displayStatus}</span></div>

              <div className="mb-4">
                <div className="md:rounded-lg md:p-4 md:bg-gray-50 md:border">
                  <ShipmentTracker status={order.shiprocket_status} events={order.shiprocket_events} />
                </div>
              </div>

              <div className="font-semibold mb-1 mt-2">Order Details</div>
              <div className="text-sm text-gray-700 space-y-3">
                {Array.isArray(order.items) && order.items.length > 0 ? (
                  order.items.map((item, idx) => {
                    // Helpers copied from CartPage to ensure consistent rendering and preview behavior
                    function cleanImageUrl(url) {
                      if (!url) return '/assets/fallback-product.png';
                      let img = String(url).replace(/[\[\]\"'{}]/g, '').trim();
                      if (!img) return '/assets/fallback-product.png';
                      if (/^https?:\/\//i.test(img)) return img;
                      if (img.startsWith('products/')) return 'https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/product-images/' + img;
                      if (img.startsWith('/assets/')) return img;
                      if (img.startsWith('/')) return img;
                      return '/assets/' + img;
                    }

                    function getSupabasePublicUrlForStl(fileUrl) {
                      if (!fileUrl) return null;
                      if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
                      const cleaned = fileUrl.replace(/^stl-files\//, '');
                      return `https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/stl-files/${cleaned}`;
                    }

                    const isQuote = !item.product_id && (item.file_url || item.file_name);
                    const isCustomKit = item.item_type === 'custom_kit';

                    function getComponentsForItem(it) {
                      if (!it) return [];
                      if (Array.isArray(it.items) && it.items.length) return it.items;
                      if (typeof it.items === 'string') {
                        try { const parsed = JSON.parse(it.items); if (Array.isArray(parsed)) return parsed; } catch (e) {}
                      }
                      if (it.description && typeof it.description === 'string') {
                        try { const pd = JSON.parse(it.description); if (pd && Array.isArray(pd.custom_kit_items)) return pd.custom_kit_items; } catch (e) {}
                      }
                      return [];
                    }

                    // Decide whether we have an STL preview available
                    const hasStlPreview = isQuote && item.file_url && typeof item.file_url === 'string' && item.file_url.toLowerCase().endsWith('.stl');
                    const stlUrl = hasStlPreview ? getSupabasePublicUrlForStl(item.file_url) : null;

                    // Determine product image fallback
                    let img = null;
                    if (!hasStlPreview) {
                      img = Array.isArray(item.images) ? item.images[0] : (typeof item.images === 'string' && item.images.includes(',') ? item.images.split(',')[0].trim() : item.images);
                      img = cleanImageUrl(img);
                    }

                    // Render product-style card for both products and quotes to keep consistent UI
                    if (item.product_id) {
                      // Product card (same structure as in CartPage)
                      const productImage = img;
                      return (
                        <Card key={item.id || idx} className="relative flex flex-row items-stretch gap-0 p-0 mb-4 shadow-lg border border-blue-100 bg-white/90 hover:shadow-2xl transition-all min-h-[112px] h-32 sm:h-32 overflow-hidden w-full">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate(`/product/${item.product_id}`)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/product/${item.product_id}`); }}
                            className="w-28 h-full flex-shrink-0 flex items-stretch justify-center bg-zinc-50 p-0 cursor-pointer"
                          >
                            <img
                              src={productImage}
                              alt={item.name}
                              className="w-full h-full object-cover rounded-none"
                              style={{ minHeight: '100%', minWidth: '100%', objectFit: 'cover' }}
                              onError={e => { e.target.onerror = null; e.target.src = '/assets/fallback-product.png'; }}
                            />
                          </div>
                          <div className="flex flex-1 flex-col justify-between p-3 min-w-0">
                            <div className="flex flex-col min-w-0">
                              <span
                                onClick={() => navigate(`/product/${item.product_id}`)}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/product/${item.product_id}`); }}
                                role="button"
                                tabIndex={0}
                                className="text-base font-bold text-indigo-800 truncate line-clamp-1 cursor-pointer"
                              >
                                {item.name}
                              </span>
                              {item.sku && (
                                <span className="text-xs text-zinc-500 mt-0.5">SKU: <span className="font-mono text-xs text-zinc-700">{item.sku}</span></span>
                              )}
                              {item.description && (
                                <span className="text-xs text-zinc-700 line-clamp-1 mb-1">
                                  {item.description.split(' ').slice(0, 10).join(' ')}{item.description.split(' ').length > 10 ? '…' : ''}
                                </span>
                              )}
                            </div>
                            <div className="flex items-end justify-between gap-2 mt-2">
                              <div className="flex items-baseline gap-2">
                                {(() => {
                                  const priceNum = Number(item.price) || 0;
                                  const mrpNum = Number(item.original_price ?? item.old_price) || 0;
                                  const showMRP = mrpNum > 0 && mrpNum > priceNum;
                                  return (
                                    <>
                                      {showMRP && (
                                        <div className="text-sm line-through text-gray-500">₹{mrpNum.toLocaleString('en-IN')}</div>
                                      )}
                                      <div className="text-base font-bold text-primary">₹{Number(item.price).toLocaleString('en-IN')}</div>
                                      <div className="text-sm text-gray-600 ml-3">Qty: {item.quantity || 1}</div>
                                    </>
                                  );
                                })()}
                              </div>
                              <div className="hidden md:flex items-center gap-2 ml-auto">
                                <div className="flex items-center gap-2">
                                  <div className="px-2 min-w-[2ch] text-center">{item.quantity || 1}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    }

                    // Custom kit rendered like a product card with expandable components
                    if (isCustomKit) {
                      const comps = getComponentsForItem(item);
                      const kitImage = '/assets/categories/Kit.jpg';
                      const expanded = expandedItem === (item.id || idx);
                      return (
                        <Card key={item.id || idx} className="relative flex flex-row items-stretch gap-0 p-0 mb-4 shadow-lg border border-green-100 bg-white/90 hover:shadow-2xl transition-all min-h-[112px] overflow-hidden w-full">
                          <div className="w-28 h-full flex-shrink-0 flex items-stretch justify-center bg-green-50 p-0 border-r border-green-100">
                            <div className="w-full h-full flex items-center justify-center">
                              <img src={kitImage} alt={item.name || 'Custom Kit'} className="w-full h-full object-cover rounded-none" onError={e => { e.target.onerror = null; e.target.src = '/assets/fallback-product.png'; }} />
                            </div>
                          </div>
                          <div className="flex flex-1 flex-col justify-between p-3 min-w-0">
                            <div className="flex flex-col min-w-0">
                              <span className="text-base font-bold text-green-800 truncate line-clamp-1">{item.name || 'Custom Kit'}</span>
                              <div className="text-xs text-zinc-600">{comps.length} components</div>
                            </div>
                            <div className="flex items-end justify-between gap-2 mt-2">
                              <div>
                                <div className="text-base font-bold text-green-700">₹{Math.round(Number(item.price)).toLocaleString()}</div>
                                <div className="text-sm text-gray-600">Qty: {item.quantity || 1}</div>
                              </div>
                              <div className="flex items-center gap-2 ml-auto">
                                <button aria-expanded={expanded} className="p-2 rounded-md hover:bg-gray-100" onClick={() => setExpandedItem(expanded ? null : (item.id || idx))}>
                                  <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                </button>
                              </div>
                            </div>
                            {expanded && (
                              <div className="mt-3 border-t pt-2">
                                {comps.length === 0 && <div className="text-sm text-muted-foreground">No components listed.</div>}
                                {comps.map((c, ci) => (
                                  <div key={ci} className="flex items-center justify-between py-1">
                                    <div className="text-sm truncate">{c.name}</div>
                                    <div className="text-sm text-muted-foreground">{c.quantity} × ₹{Number(c.price).toLocaleString()}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    }

                    // Quote card (mirror CartPage quote layout)
                    return (
                      <Card key={item.id || idx} className="relative flex flex-row items-stretch gap-0 p-0 mb-4 shadow-lg border border-yellow-100 bg-white/90 hover:shadow-2xl transition-all min-h-[112px] h-32 sm:h-32 overflow-hidden w-full">
                        <div className="w-28 h-full flex-shrink-0 flex items-stretch justify-center bg-yellow-50 p-0 border-r border-yellow-100">
                          <div className="w-full h-full flex items-center justify-center">
                            {hasStlPreview ? (
                              // STL preview in thumbnail area (exact CartPage wrapper)
                              <div className="w-full h-full flex items-center justify-center">
                                <ModelViewerWrapper url={stlUrl} color={item.color || '#FFD700'} />
                              </div>
                            ) : (
                              <img
                                src={item.file_url && item.file_url.toLowerCase().endsWith('.stl') ? getSupabasePublicUrlForStl(item.file_url) : (img || uploadImg)}
                                alt={item.file_name || '3D Model Preview'}
                                className="w-20 h-20 object-contain rounded-md bg-white border border-yellow-200"
                                style={{ maxWidth: '80px', maxHeight: '80px' }}
                                onError={e => { e.target.onerror = null; e.target.src = uploadImg; }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="flex flex-1 flex-col justify-between p-3 min-w-0">
                          <div className="flex flex-col min-w-0">
                            <span className="text-base font-bold text-yellow-800 truncate line-clamp-1">
                              {item.file_name ? item.file_name.split('/').pop().replace(/^\d+[_\-.]*/, '').split('.')[0] : (item.name || 'Quote')}
                            </span>
                            <div className="flex flex-wrap gap-2 text-xs text-zinc-600 mb-1">
                              {item.material && <span>Material: <span className="font-medium text-yellow-700">{item.material}</span></span>}
                              {item.color && (
                                        (() => {
                                          // helper: convert hex to human-friendly name (approximate)
                                          function hexToRgb(hex) {
                                            if (!hex) return null;
                                            const h = hex.replace('#', '').trim();
                                            if (h.length === 3) {
                                              return {
                                                r: parseInt(h[0] + h[0], 16),
                                                g: parseInt(h[1] + h[1], 16),
                                                b: parseInt(h[2] + h[2], 16),
                                              };
                                            }
                                            if (h.length === 6) {
                                              return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
                                            }
                                            return null;
                                          }
                                          function hexToColorName(hex) {
                                            try {
                                              const names = {
                                                Black: '#000000', White: '#ffffff', Red: '#ff0000', Green: '#008000', Blue: '#0000ff', Yellow: '#ffff00',
                                                Orange: '#ffa500', Purple: '#800080', Pink: '#ffc0cb', Brown: '#a52a2a', Gray: '#808080', Cyan: '#00ffff',
                                                Magenta: '#ff00ff', Teal: '#008080', Olive: '#808000', Navy: '#000080', Maroon: '#800000', Lime: '#00ff00',
                                                Silver: '#c0c0c0', Gold: '#ffd700', Indigo: '#4b0082', Violet: '#ee82ee', Beige: '#f5f5dc', Coral: '#ff7f50',
                                                'BlueViolet': '#8a2be2', 'DeepSkyBlue': '#00bfff'
                                              };
                                              const rgb = hexToRgb(hex);
                                              if (!rgb) return null;
                                              let best = { name: null, dist: Infinity };
                                              for (const [name, h] of Object.entries(names)) {
                                                const c = hexToRgb(h);
                                                const dr = c.r - rgb.r, dg = c.g - rgb.g, db = c.b - rgb.b;
                                                const d = dr*dr + dg*dg + db*db;
                                                if (d < best.dist) best = { name, dist: d };
                                              }
                                              return best.name;
                                            } catch (e) {
                                              return null;
                                            }
                                          }

                                          const colorLabel = item.color_name || (typeof item.color === 'string' && !item.color.startsWith('#') ? item.color : (typeof item.color === 'string' && item.color.startsWith('#') ? (hexToColorName(item.color) || '') : ''));
                                          return (
                                            <span className="flex items-center gap-1">Color:
                                              <span className="inline-block w-3 h-3 rounded-full border border-gray-300 align-middle" style={{ background: (typeof item.color === 'string' && item.color.startsWith('#')) ? item.color : (item.color || '#ccc') }}></span>
                                              <span className="font-medium text-yellow-700">{colorLabel || 'Custom'}</span>
                                            </span>
                                          );
                                        })()
                                      )}
                              {(item.infill !== undefined && item.infill !== null) && <span>Infill: <span className="font-medium text-yellow-700">{item.infill}%</span></span>}
                              {isQuote && item.print_quality && <span>Quality: <span className="font-medium text-yellow-700">{item.print_quality}</span></span>}
                            </div>
                            {item.description && <div className="text-xs text-zinc-700 mb-1 line-clamp-2">{item.description}</div>}
                          </div>
                          <div className="flex items-end justify-between gap-2 mt-2">
                            <span className="text-base font-bold text-yellow-700">₹{Math.round(Number(item.price)).toLocaleString()}</span>
                            <span className="text-sm text-gray-600 ml-3">Qty: {item.quantity || 1}</span>
                            <div className="hidden md:flex items-center gap-2 ml-auto">
                              <div className="flex items-center gap-2">
                                <div className="px-2 min-w-[2ch] text-center">{item.quantity || 1}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                ) : (
                  <div>No items found in this order.</div>
                )}
              </div>

              {/* Pricing summary */}
              <div className="mt-4 border-t pt-4">
                <div className="text-sm text-gray-600 mb-2">Pricing</div>
                <div className="text-sm text-gray-700 space-y-2">
                  <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold">₹{Math.round((order.price || order.total || 0) + (order.discount_amount || 0))}</span></div>
                  {order.discount_amount ? (<div className="flex justify-between text-gray-600"><span>Discount</span><span className="font-semibold text-red-600">-₹{Math.round(order.discount_amount)}</span></div>) : null}
                  {order.shipping_amount ? (<div className="flex justify-between text-gray-600"><span>Shipping</span><span className="font-semibold">₹{Math.round(order.shipping_amount)}</span></div>) : null}
                  {order.tax_amount ? (<div className="flex justify-between text-gray-600"><span>Taxes</span><span className="font-semibold">₹{Math.round(order.tax_amount)}</span></div>) : null}
                  <div className="flex justify-between pt-2 border-t"><span className="font-semibold">Total</span><span className="font-bold text-primary">₹{Math.round(order.total || order.price || 0)}</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/3 md:pl-6 flex flex-col gap-6">
            <div className="w-full md:top-24 md:bg-transparent">
              <div className="md:border md:rounded-lg md:px-4 py-4 md:bg-gray-50 px-2 sm:px-4 md:px-0">
                <div className="font-semibold mb-2 text-primary">Delivery Address</div>
                {order.address ? (
                  <div className="text-sm text-gray-700 space-y-1">
                    {order.address.name && <div className="font-semibold">{order.address.name}</div>}
                    <div>{order.address.flat_no}, {order.address.area}</div>
                    <div>{order.address.city}, {order.address.state} - {order.address.pincode}</div>
                    <div>Phone: {order.address.phone}</div>
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm">No address provided.</div>
                )}
              </div>
            </div>

            <div className="w-full px-2 sm:px-4 md:px-0">
              <div className="md:border md:rounded-lg md:p-4 md:bg-gray-50">
                <div className="font-semibold mb-2 text-primary">Payment Info</div>
                <div className="text-gray-400 text-sm">(Payment details coming soon)</div>
              </div>
              <div className="mt-4">
                <button className="w-full px-4 py-2 border border-gray-200 rounded text-gray-700 hover:bg-gray-100 transition text-sm mb-2" onClick={() => handleDownloadInvoice(order)}>Download Invoice</button>
                {isOrderCancelable(order) ? (
                  <>
                    <button className="w-full px-4 py-2 border border-gray-200 rounded text-gray-700 hover:bg-gray-100 transition text-sm" onClick={() => setShowCancelModal(true)}>Cancel Order</button>
                    <div className="text-xs text-gray-500 mt-2">You can cancel this order now; we’ll try to stop shipment if possible.</div>
                  </>
                ) : (
                  <>
                    <button className="w-full px-4 py-2 border border-gray-100 rounded text-gray-400 opacity-70 cursor-not-allowed text-sm" disabled>Cancellation Unavailable</button>
                    <div className="text-xs text-gray-500 mt-2">Cancellation is no longer available for this order.</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/60 p-4" onClick={() => setShowCancelModal(false)}>
          <div className="bg-white rounded-t-lg md:rounded-lg shadow-lg w-full md:w-2/3 max-w-2xl p-6 transform transition-all relative z-[10000]" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className="text-xl font-semibold mb-3">Cancel Order</h3>
            <p className="text-sm text-gray-600 mb-4">Please let us know why you want to cancel this order. We’ll attempt to cancel it for you if it’s still eligible.</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Reason</label>
                <div className="mt-2 space-y-2">
                  {['Ordered by mistake','Found a better alternative','Shipping address needs correction','Delivery time is too long','Other'].map(r => (
                    <label key={r} className="flex items-center gap-3">
                      <input type="radio" name="cancelReason" value={r} checked={cancelReason===r} onChange={() => setCancelReason(r)} />
                      <span className="text-sm">{r}</span>
                    </label>
                  ))}
                </div>
              </div>
              {cancelReason === 'Other' && (
                <div>
                  <label className="text-sm font-medium">Additional comments (optional)</label>
                  <textarea value={cancelComment} onChange={e => setCancelComment(e.target.value)} className="w-full mt-2 p-2 border rounded text-sm" rows={3} />
                </div>
              )}
              {cancelError && <div className="text-red-600 text-sm">{cancelError}</div>}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button className="px-4 py-2 bg-white border rounded" onClick={() => setShowCancelModal(false)} disabled={cancelLoading}>Keep Order</button>
              <button className="px-4 py-2 bg-red-600 text-white rounded" onClick={() => confirmCancelOrder()} disabled={cancelLoading}>{cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetailsPage;
