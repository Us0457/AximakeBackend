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
  // modal and cancel state moved to dedicated Order Details page
  const [liveStatuses, setLiveStatuses] = useState({}); // { shipment_id: { status, track_url } }
  const navigate = useNavigate();

  // SEO: page title
  useEffect(() => {
    document.title = 'Your Orders — Aximake';
  }, []);

  // Load orders helper (used by other actions)
  async function loadOrders() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('id, user_id, created_at, price, order_status, items, address, order_code, discount_amount, total, shiprocket_shipment_id, shiprocket_awb, shiprocket_status, shiprocket_label_url, shiprocket_events')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error) setOrders(data || []);
    setLoading(false);
  }

  useEffect(() => { loadOrders(); }, [user]);

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
      let data = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error || data?.message || data?.details || 'Invoice not available yet';
        alert('Invoice not available: ' + msg);
        return;
      }
      if (!data || !data.invoice_url) {
        alert('Invoice is not available yet. Please try again later.');
        return;
      }
      window.open(data.invoice_url, '_blank');
      // Refresh orders after download
      if (typeof fetchOrders === 'function') await fetchOrders();
    } catch (e) {
      alert('Failed to download invoice: ' + (e?.message || e));
    }
  }

  function isOrderCancelable(order) {
    // Cancel allowed only if no AWB and status is before 'Ready To Ship'
    const awb = order.shiprocket_awb && String(order.shiprocket_awb).trim();
    if (awb) return false;
    const fallback = order.shiprocket_status || order.order_status || 'pending';
    const displayStatus = getLatestScanLabel(order.shiprocket_events, fallback);
    const cur = String(displayStatus || '').toLowerCase();
    // Disallow once status reaches ready/shipped/picked or final states
    const blocked = ['ready to ship', 'ready', 'shipped', 'picked', 'picked up', 'delivered', 'cancel', 'return', 'fulfilled'];
    return !blocked.some(b => cur.includes(b));
  }

  // Cancellation flow moved to OrderDetailsPage; modal/state removed from this list view.

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
    <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-10 max-w-3xl">
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
                onClick={() => { navigate(`/orders/${order.id}`); }}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { navigate(`/orders/${order.id}`); } }}
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
                      const colorClass = String(displayStatus || '').toLowerCase().includes('cancel') ? 'text-red-600' : 'text-green-700';
                      return (<span>Status: <span className={`font-semibold ${colorClass}`}>{displayStatus}</span></span>);
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
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition text-sm"
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
                        {/* Cancel button intentionally removed from card to keep list view clean.
                            Cancellation is only available inside the order details modal. */}
                      </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {/* Order details now open on a dedicated page at /orders/:orderId */}
    </div>
  );
};

export default UserOrdersPage;
