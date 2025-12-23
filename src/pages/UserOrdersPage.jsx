import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SHIPROCKET_STATUS_MAP from '@/lib/shiprocketStatusMap';
import ShipmentTracker from '@/components/ShipmentTracker';
import { getLatestScanLabel } from '@/lib/utils';
import { getApiUrl, getPhpUrl } from '@/lib/utils';

// Utility to generate order code like AXMK-23B6C9
function getOrderCode(order) {
  if (order.order_code) return order.order_code;
  // Fallback: generate from id and created_at if not present
  const idPart = (order.id || '').toString(36).toUpperCase().padStart(6, '0').slice(-6);
  const datePart = order.created_at ? new Date(order.created_at).getFullYear().toString().slice(-2) : 'XX';
  return `AXMK-${datePart}${idPart}`;
}

const UserOrdersPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [liveStatuses, setLiveStatuses] = useState({}); // { shipment_id: { status, track_url } }
  const navigate = useNavigate();

  // SEO: page title
  useEffect(() => {
    document.title = 'Your Orders — Aximake';
  }, []);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('id, user_id, created_at, price, order_status, items, address, order_code, discount_amount, total, shiprocket_shipment_id, shiprocket_awb, shiprocket_status, shiprocket_label_url, shiprocket_events')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error) setOrders(data || []);
      setLoading(false);
    };
    fetchOrders();
  }, [user]);

  // SEO: title and meta for user orders
  useEffect(() => {
    document.title = 'Your Orders — Aximake';
    const desc = 'View your orders and tracking information at Aximake.';
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
    m.content = desc.slice(0, 160);
  }, []);

  // --- Real-time subscription for Shiprocket status updates ---
  useEffect(() => {
    if (!user) return;
    const ordersSub = supabase
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        // Refetch orders on any change
        const fetchOrders = async () => {
            const { data, error } = await supabase
            .from('orders')
            .select('id, user_id, created_at, price, order_status, items, address, order_code, discount_amount, total, shiprocket_shipment_id, shiprocket_awb, shiprocket_status, shiprocket_label_url, shiprocket_events')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          if (!error) setOrders(data || []);
        };
        fetchOrders();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ordersSub);
    };
  }, [user]);

  // Utility to download Shiprocket invoice and refresh order data
  async function handleDownloadInvoice(order, fetchOrders) {
    if (!order.shiprocket_shipment_id) return;
    try {
      // Use query parameter for shipment_id
      const res = await fetch(getApiUrl(`/api/shiprocket-invoice?shipment_id=${order.shiprocket_shipment_id}`));
      if (!res.ok) throw new Error('Failed to get invoice URL');
      const data = await res.json();
      if (!data.invoice_url) throw new Error('No invoice_url returned');
      // Open invoice_url in a new tab (or trigger download)
      window.open(data.invoice_url, '_blank');
      // Refresh orders after download
      if (typeof fetchOrders === 'function') await fetchOrders();
    } catch (e) {
      alert('Failed to download invoice: ' + (e?.message || e));
    }
  }

  // Fetch and update order status from Shiprocket
  const fetchAndUpdateOrderStatus = async (order) => {
    if (!order.shiprocket_shipment_id) return;
    try {
      // Call backend to fetch latest status and update DB
      await fetch(getApiUrl(`/api/shiprocket-status`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipment_id: order.shiprocket_shipment_id, order_code: order.order_code })
      });
      // Refetch orders to get updated status
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('id, user_id, created_at, price, order_status, items, address, order_code, discount_amount, total, shiprocket_shipment_id, shiprocket_awb, shiprocket_status, shiprocket_label_url, shiprocket_events')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error) setOrders(data || []);
      setLoading(false);
    } catch (e) {
      // Optionally show error
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <ClipboardList className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold text-primary">Your Orders</h1>
      </div>
      {loading ? (
        <div className="text-muted-foreground text-center py-12">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-muted-foreground text-center py-12">No orders found.</div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => {
            const live = order.shiprocket_shipment_id ? liveStatuses[order.shiprocket_shipment_id] : null;
            return (
              <Card
                key={order.id}
                className="hover:shadow-lg transition cursor-pointer"
                onClick={() => { setSelectedOrder(order); }}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setSelectedOrder(order); } }}
              >
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{`Order #${getOrderCode(order)}`}</CardTitle>
                  <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</span>
                </CardHeader>
                <CardContent>
                  <div className="mb-2 text-sm text-muted-foreground">
                    {(() => {
                      const fallback = live?.status || order.shiprocket_status || order.order_status || 'pending';
                      const displayStatus = getLatestScanLabel(order.shiprocket_events, fallback);
                      return (<span>Status: <span className="font-semibold text-green-700">{displayStatus}</span></span>);
                    })()}
                  </div>
                  {order.shiprocket_awb && (
                    <div className="mb-2 text-sm text-blue-700">
                      <span className="font-semibold">AWB:</span> {order.shiprocket_awb}
                    </div>
                  )}
                  {/* Track Shipment Button */}
                  {(() => {
                    const awb = order.shiprocket_awb && String(order.shiprocket_awb).trim();
                    const trackingUrl = (live?.track_url && awb)
                      ? live.track_url
                      : (awb ? `https://shiprocket.co/tracking/${awb}` : null);
                    return trackingUrl ? (
                      <a
                      href={trackingUrl}
                      className="mt-2 px-3 py-1 bg-green-600 text-white rounded shadow hover:bg-green-700 transition inline-block text-sm font-medium align-middle"
                      style={{ minHeight: 'unset', lineHeight: '1.5', height: 'auto' }}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      >
                      Track Shipment
                      </a>
                    ) : null;
                    })()}

                    <div className="text-xs text-muted-foreground mt-2">Click for details</div>
                    <button
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition"
                    onClick={async e => {
                      e.stopPropagation();
                      await handleDownloadInvoice(order, async () => {
                        // Refetch orders after download
                        setLoading(true);
                        const { data, error } = await supabase
                          .from('orders')
                          .select('id, user_id, created_at, price, order_status, items, address, order_code, discount_amount, total, shiprocket_shipment_id, shiprocket_awb, shiprocket_status, shiprocket_label_url')
                          .eq('user_id', user.id)
                          .order('created_at', { ascending: false });
                        if (!error) setOrders(data || []);
                        setLoading(false);
                      });
                    }}
                  >
                    Download Invoice
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {/* Modal for order details */}
      {selectedOrder && (() => {
        // Fetch live status for selected order
        const live = selectedOrder.shiprocket_shipment_id ? liveStatuses[selectedOrder.shiprocket_shipment_id] : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-auto">
            <div
              className="bg-white rounded-lg shadow-lg p-4 md:p-8 w-full max-w-4xl relative flex flex-col md:flex-row gap-4 md:gap-8 items-stretch min-h-[60vh] max-h-[90vh] overflow-y-auto"
              style={{ boxSizing: 'border-box' }}
            >
              <button className="absolute top-2 right-2 text-gray-400 hover:text-primary text-2xl z-10" onClick={() => setSelectedOrder(null)} aria-label="Close order details">&times;</button>
              {/* Left: Order Details and Items */}
              <div className="w-full md:w-2/3 md:pr-4">
                <h2 className="text-2xl font-bold mb-2 text-primary">Order #{getOrderCode(selectedOrder)}</h2>
                <div className="mb-2 text-sm text-gray-500">Date: {new Date(selectedOrder.created_at).toLocaleString()}</div>
                {(() => {
                  // Prefer latest scan label/activity as the authoritative status when available
                  let displayStatus = live?.status || selectedOrder.shiprocket_status || selectedOrder.order_status || 'pending';
                  try {
                    const evs = Array.isArray(selectedOrder.shiprocket_events) ? selectedOrder.shiprocket_events : [];
                    if (evs.length) {
                      const sortedEvs = evs.slice().sort((a, b) => {
                        const da = a && a.date ? Date.parse(a.date) || 0 : 0;
                        const db = b && b.date ? Date.parse(b.date) || 0 : 0;
                        return db - da;
                      });
                      const latest = sortedEvs[0];
                      const lbl = latest && (latest['sr-status-label'] || latest.sr_status_label || latest.activity || latest.status);
                      if (lbl) displayStatus = String(lbl);
                    }
                  } catch (e) {
                    // ignore and fall back to backend status
                  }

                  return (
                    <>
                      <div className="mb-2 text-sm text-gray-500">Status: <span className="font-semibold text-green-700">{displayStatus}</span></div>
                      {/* Shipment tracker (modal) - shows progress and timeline based on scans/status */}
                      <ShipmentTracker status={live?.status || selectedOrder.shiprocket_status} events={selectedOrder.shiprocket_events} />
                    </>
                  );
                })()}
                {/* Subtotal, Discount, Total breakdown (clean, no border, label: value) */}
                <div className="mb-4">
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-semibold">₹{
                        Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0
                          ? Math.round(selectedOrder.items.reduce((sum, item) => sum + ((Number(item.price) || 0) * (item.quantity || 1)), 0))
                          : (selectedOrder.price && selectedOrder.discount_amount ? Math.round(selectedOrder.price + selectedOrder.discount_amount) : Math.round(selectedOrder.price || 0))
                      }</span>
                    </div>
                    {selectedOrder.discount_amount ? (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Discount:</span>
                        <span className="font-semibold text-red-600">-₹{Math.round(selectedOrder.discount_amount)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-800 font-bold">Total:</span>
                      <span className="font-bold text-primary">₹{
                        typeof selectedOrder.total === 'number'
                          ? Math.round(selectedOrder.total)
                          : (Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0
                              ? Math.round(selectedOrder.items.reduce((sum, item) => sum + ((Number(item.price) || 0) * (item.quantity || 1)), 0) - (selectedOrder.discount_amount || 0))
                              : Math.round(typeof selectedOrder.price === 'number' ? selectedOrder.price : (selectedOrder.total ?? (selectedOrder.price - (selectedOrder.discount_amount || 0))))
                            )
                      }</span>
                    </div>
                  </div>
                </div>
                {/* Download Invoice button in modal
                <button
                  className="mb-4 inline-block px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition"
                  onClick={async e => {
                    e.stopPropagation();
                    await handleDownloadInvoice(selectedOrder, async () => {
                      setLoading(true);
                      const { data, error } = await supabase
                        .from('orders')
                        .select('id, user_id, created_at, price, order_status, items, address, order_code, discount_amount, total, shiprocket_shipment_id, shiprocket_awb, shiprocket_status, shiprocket_label_url, shiprocket_events')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });
                      if (!error) setOrders(data || []);
                      setLoading(false);
                    });
                  }}
                >
                  Download Invoice
                </button> */}
                {/* Order Details */}
                <div className="font-semibold mb-1">Order Details</div>
                <div className="text-sm text-gray-700 space-y-3">
                  {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((item, idx) => (
                      <div key={item.id || idx} className="border rounded p-3 bg-gray-50">
                        <div className="font-medium mb-1">
                          {item.product_id ? (
                            <span className="text-indigo-700">Product: {item.name}</span>
                          ) : (
                            <span className="text-yellow-700">Quote: {item.file_name || item.name || 'Custom Quote'}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-1">
                          {item.category && <span>Category: <span className="font-semibold text-indigo-700">{item.category}</span></span>}
                          {item.material && <span>Material: <span className="font-semibold text-indigo-700">{item.material}</span></span>}
                          {item.color && (
                            <span>Color: <span className="font-semibold text-indigo-700">
                              {(item.color_name || (typeof item.color === 'string' && item.color.startsWith('#')))
                                ? <>
                                    <span className="inline-block w-4 h-4 rounded-full align-middle mr-1 border" style={{ backgroundColor: item.color, borderColor: '#ccc' }}></span>
                                    {item.color_name || 'Custom'}
                                  </>
                                : item.color}
                            </span></span>
                          )}
                          {item.infill && <span>Infill: <span className="font-semibold text-indigo-700">{item.infill}%</span></span>}
                          {/* Product ID removed from UI per design */}
                          {item.sku && <span>SKU: <span className="font-mono font-semibold text-indigo-700">{item.sku}</span></span>}
                        </div>
                        {/* Product description removed from order item display (UI-only change) */}
                        <div className="flex items-center gap-4 mt-1">
                          <span className="font-bold text-primary">Qty: {item.quantity}</span>
                          <span className="font-bold text-primary">₹{Math.round(Number(item.price)).toLocaleString()}</span>
                        </div>
                        {/* Show STL file download for quotes */}
                        {!item.product_id && item.file_url && (
                          <div className="mt-2">
                            <a href={item.file_url} download={item.file_name || true} className="inline-flex items-center text-blue-600 hover:underline">
                              Download STL: {item.file_name || 'File'}
                            </a>
                          </div>
                        )}
                        {/* Show product image if available */}
                        {item.product_id && item.images && (
                          <div className="mt-2">
                            {(() => {
                              let img = Array.isArray(item.images) ? item.images[0] : (typeof item.images === 'string' && item.images.includes(',') ? item.images.split(',')[0].trim() : item.images);
                              if (img) img = img.replace(/^[\[\"]+|[\]\"]+$/g, '').replace(/['{}]/g, '').trim();
                              // Remove any leading/trailing brackets or quotes
                              if (img && !/^https?:\/\//i.test(img)) {
                                const supabaseBaseUrl = 'https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/product-images/';
                                if (img.startsWith('products/')) {
                                  img = supabaseBaseUrl + img.replace(/^products\//, 'products/');
                                } else {
                                  img = supabaseBaseUrl + img;
                                }
                              }
                              return <img src={img} alt={item.name} className="w-24 h-24 object-cover rounded border" onError={e => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1585592049294-8f466326930a'; }} />;
                            })()}
                          </div>
                        )}
                        {/* Write a Product Review button for delivered products */}
                        {(selectedOrder.order_status || '').toLowerCase() === 'delivered' && item.product_id && (!item.review) && (
                          <button
                            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition"
                            onClick={e => { e.stopPropagation(); navigate(`/review/${selectedOrder.id}/${item.product_id}`); }}
                          >
                            Write a Product Review
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div>No items found in this order.</div>
                  )}
                </div>
              </div>
              {/* Right: Address and Payment Info */}
              <div className="w-full md:w-1/3 md:pl-4 flex flex-col gap-6 mt-6 md:mt-0">
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="font-semibold mb-2 text-primary">Delivery Address</div>
                  {selectedOrder.address ? (
                    <div className="text-sm text-gray-700 space-y-1">
                      {selectedOrder.address.name && (
                        <div className="font-semibold">{selectedOrder.address.name}</div>
                      )}
                      <div>{selectedOrder.address.flat_no}, {selectedOrder.address.area}</div>
                      <div>{selectedOrder.address.city}, {selectedOrder.address.state} - {selectedOrder.address.pincode}</div>
                      <div>Phone: {selectedOrder.address.phone}</div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">No address provided.</div>
                  )}
                </div>
                {/* Payment Info placeholder for future use */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="font-semibold mb-2 text-primary">Payment Info</div>
                  <div className="text-gray-400 text-sm">(Payment details coming soon)</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default UserOrdersPage;
