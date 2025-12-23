import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiUrl, getPhpUrl, getLatestScanLabel } from '@/lib/utils';
import ShipmentTracker from '@/components/ShipmentTracker';

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-amber-300 text-amber-900", // more visible brown
  shipping: "bg-purple-200 text-purple-900", // added for shipping status
  delivered: "bg-green-500 text-white", // strong green
  cancelled: "bg-red-500 text-white",
  fulfilled: "bg-green-300 text-green-900", // fallback for legacy
};

const OrderManagementPage = () => {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [shipLoading, setShipLoading] = useState({}); // { [shipment_id]: boolean }
  const [refreshing, setRefreshing] = useState({}); // { [shipment_id]: boolean }
  const maxRows = 50;

  // --- Real-time subscription for new/updated orders and Shiprocket status ---
  useEffect(() => {
    fetchOrders();
    fetchCustomers();
    // --- Real-time subscription for new/updated orders ---
    const quotesSub = supabase
      .channel('public:quotes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, (payload) => {
        fetchOrders();
      })
      .subscribe();
    // --- Real-time subscription for Shiprocket status updates ---
    const ordersSub = supabase
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrders();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(quotesSub);
      supabase.removeChannel(ordersSub);
    };
  }, []);

  async function fetchOrders() {
    setLoading(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from("orders")
      .select("id, user_id, created_at, price, order_status, items, address, order_code, discount_code, discount_amount, shiprocket_shipment_id, shiprocket_awb, shiprocket_status, shiprocket_label_url, shiprocket_events")
      .order("created_at", { ascending: false });
    if (error) setFetchError(error.message);
    setOrders(data || []);
    setLoading(false);
  }

  async function fetchCustomers() {
    const { data, error } = await supabase.from("profiles").select("id, email");
    setCustomers(data || []);
  }

  function getCustomerEmail(user_id) {
    const c = customers.find(u => u.id === user_id);
    return c ? c.email : "-";
  }

  function filterOrders(list) {
    let filtered = list;
    if (statusFilter !== "all") filtered = filtered.filter(o => (o.order_status || "pending") === statusFilter);
    if (search) {
      filtered = filtered.filter(
        o =>
          o.id.toString().includes(search) ||
          getCustomerEmail(o.user_id).toLowerCase().includes(search.toLowerCase())
      );
    }
    return filtered;
  }

  function paginatedOrders(list) {
    const start = (currentPage - 1) * rowsPerPage;
    return list.slice(start, start + rowsPerPage);
  }

  useEffect(() => {
    setCurrentPage(1); // Reset to first page on filter/search change
  }, [search, statusFilter, rowsPerPage]);

  async function handleStatusChange(order, newStatus) {
    setStatusUpdating(true);
    // 1. Update status in Supabase
    await supabase.from("orders").update({ order_status: newStatus }).eq("id", order.id);
    // 2. Send email to customer (use absolute path for dev, relative for prod)
    const customer = customers.find(u => u.id === order.user_id);
    if (customer && customer.email) {
      try {
        await fetch(getPhpUrl('/order-status-email.php'), {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            to: customer.email,
            order_id: order.id,
            status: newStatus,
          }),
        });
      } catch (err) {
        // Optionally, show a toast or log error
        console.error("Failed to send status email", err);
      }
    }
    await fetchOrders();
    setStatusUpdating(false);
  }

  // Shiprocket: Trigger shipment (generate AWB)
  async function handleShipNow(order) {
    if (!order.shiprocket_shipment_id) return;
    setShipLoading(prev => ({ ...prev, [order.shiprocket_shipment_id]: true }));
    try {
      // Use new endpoint: POST /api/shiprocket-ship-now with shipment_id in body
      const res = await fetch(getApiUrl('/api/shiprocket-ship-now'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipment_id: order.shiprocket_shipment_id })
      });
      const data = await res.json();
      if (data && !data.error) {
        // Immediately sync status after AWB generation
        await fetch(getApiUrl('/api/shiprocket-status'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shipment_id: order.shiprocket_shipment_id, order_code: order.order_code })
        });
        await fetchOrders();
      } else {
        alert(data.error || 'Failed to generate AWB');
      }
    } catch (e) {
      alert('Failed to generate AWB');
    }
    setShipLoading(prev => ({ ...prev, [order.shiprocket_shipment_id]: false }));
  }

  // Refresh Shiprocket status for a single order
  async function handleRefreshStatus(order) {
    if (!order.shiprocket_shipment_id) return;
    setRefreshing(prev => ({ ...prev, [order.shiprocket_shipment_id]: true }));
    try {
      const res = await fetch(getApiUrl(`/api/shiprocket-tracking/${order.shiprocket_shipment_id}`));
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      const status = data?.tracking_data?.shipment_track?.[0]?.current_status || data?.tracking_data?.shipment_status || null;
      const awb = data?.tracking_data?.shipment_track?.[0]?.awb_code || order.shiprocket_awb;
      const courier = data?.tracking_data?.shipment_track?.[0]?.courier_name || order.shiprocket_courier;
      const track_url = data?.tracking_data?.track_url || null;
      // Update in DB for consistency
      await supabase.from('orders').update({
        shiprocket_status: status,
        shiprocket_awb: awb,
        shiprocket_courier: courier,
        shiprocket_track_url: track_url
      }).eq('shiprocket_shipment_id', order.shiprocket_shipment_id);
      // Add a short delay to ensure DB update is reflected before fetching
      await new Promise(resolve => setTimeout(resolve, 350));
      await fetchOrders();
    } catch (e) {
      console.error('Failed to refresh status:', e);
      alert('Failed to refresh status: ' + (e?.message || e));
    }
    setRefreshing(prev => ({ ...prev, [order.shiprocket_shipment_id]: false }));
  }

  // Download Shiprocket invoice and refresh orders
  async function handleDownloadInvoice(order) {
    if (!order.shiprocket_shipment_id) return;
    try {
      const res = await fetch(getApiUrl(`/api/shiprocket-invoice/${order.shiprocket_shipment_id}`));
      if (!res.ok) throw new Error('Failed to download invoice');
      const blob = await res.blob();
      let filename = `invoice_${order.shiprocket_shipment_id}.pdf`;
      const disposition = res.headers.get('content-disposition');
      if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match) filename = match[1];
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        a.remove();
      }, 100);
      // Refresh orders after download
      await fetchOrders();
    } catch (e) {
      alert('Failed to download invoice: ' + (e?.message || e));
    }
  }

  // Utility to generate order code like AXMK-23B6C9
  function getOrderCode(order) {
    if (order.order_code) return order.order_code;
    // Fallback: generate from id and created_at if not present
    const idPart = (order.id || '').toString(36).toUpperCase().padStart(6, '0').slice(-6);
    const datePart = order.created_at ? new Date(order.created_at).getFullYear().toString().slice(-2) : 'XX';
    return `AXMK-${datePart}${idPart}`;
  }

  // Utility to get a public download URL for Supabase storage
  function getSupabasePublicUrl(file_url) {
    if (!file_url) return null;
    if (/^https?:\/\//i.test(file_url)) return file_url;
    // Use Supabase public URL for stl-files bucket
    return `https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/stl-files/${file_url.replace(/^stl-files\//, '')}`;
  }

  // Utility to get a cropped display name for quotes (same as CartPage)
  function getQuoteDisplayName(item) {
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
    return displayName;
  }

  return (
    <div className="max-w-7xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-primary">Order Management</h1>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex gap-2">
          <Button variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>All</Button>
          <Button variant={statusFilter === "pending" ? "default" : "outline"} onClick={() => setStatusFilter("pending")}>Pending</Button>
          <Button variant={statusFilter === "processing" ? "default" : "outline"} onClick={() => setStatusFilter("processing")}>Processing</Button>
          <Button variant={statusFilter === "delivered" ? "default" : "outline"} onClick={() => setStatusFilter("delivered")}>Delivered</Button>
          <Button variant={statusFilter === "cancelled" ? "default" : "outline"} onClick={() => setStatusFilter("cancelled")}>Cancelled</Button>
        </div>
        <Input
          placeholder="Search by order ID or customer email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          <label htmlFor="rowsPerPage" className="text-sm text-gray-600">Rows per page:</label>
          <input
            id="rowsPerPage"
            type="number"
            min={1}
            max={maxRows}
            value={rowsPerPage}
            onChange={e => setRowsPerPage(Math.max(1, Math.min(maxRows, Number(e.target.value))))}
            className="w-16 border rounded px-2 py-1 text-sm"
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg shadow border border-gray-200 bg-white">
        {fetchError && <div className="text-red-600 p-4">Supabase fetch error: {fetchError}</div>}
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Order ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Subtotal</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Discount Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Discount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Total</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">AWB</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Tracking</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={13} className="py-8 text-center text-gray-400">Loading...</td></tr>
            ) : filterOrders(orders).length === 0 ? (
              <tr><td colSpan={13} className="py-8 text-center text-gray-400">No orders found.</td></tr>
            ) : paginatedOrders(filterOrders(orders)).map(o => (
              <tr key={o.id} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => setSelectedOrder(o)}>
                <td className="px-4 py-3 font-medium text-primary underline">{getOrderCode(o)}</td>
                <td className="px-4 py-3">{getCustomerEmail(o.user_id)}</td>
                <td className="px-4 py-3">{o.created_at?.slice(0,10)}</td>
                <td className="px-4 py-3">
                  {(() => {
                    const fallback = o.shiprocket_status || o.order_status || "pending";
                    const ds = getLatestScanLabel(o.shiprocket_events, fallback) || fallback;
                    return (
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[(ds || "pending").toLowerCase()] || statusColors["pending"]}`}>
                        {ds}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3">₹{
                  Array.isArray(o.items) && o.items.length > 0
                    ? Math.round(o.items.reduce((sum, item) => sum + ((Number(item.price) || 0) * (item.quantity || 1)), 0))
                    : (o.price && o.discount_amount ? Math.round(o.price + o.discount_amount) : Math.round(o.price || 0))
                }</td>
                <td className="px-4 py-3">
                  {o.discount_code ? (
                    <span className="text-green-700 font-semibold">{o.discount_code}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {o.discount_amount ? (
                    <span className="text-red-600">-₹{Math.round(o.discount_amount)}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">₹{
                  Array.isArray(o.items) && o.items.length > 0
                    ? Math.round(o.items.reduce((sum, item) => sum + ((Number(item.price) || 0) * (item.quantity || 1)), 0) - (o.discount_amount || 0))
                    : Math.round(typeof o.price === 'number' ? o.price : (o.total ?? (o.price - (o.discount_amount || 0))))
                }</td>
                <td className="px-4 py-3">{o.shiprocket_awb || '-'}</td>
                <td className="px-4 py-3">
                  {(() => {
                    const trackingUrl = o.shiprocket_track_url
                      || (o.shiprocket_awb ? `https://shiprocket.co/tracking/${o.shiprocket_awb}` : null);
                    return trackingUrl && o.shiprocket_awb ? (
                      <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition">Track</a>
                    ) : '-';
                  })()}
                </td>
                <td className="px-4 py-3 flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" disabled={statusUpdating} onClick={e => {e.stopPropagation(); handleStatusChange(o, "processing");}}>
                    Mark Processing
                  </Button>
                  <Button size="sm" variant="outline" disabled={statusUpdating} onClick={e => {e.stopPropagation(); handleStatusChange(o, "shipped");}}>
                    Mark Shipped
                  </Button>
                  <Button size="sm" variant="outline" disabled={statusUpdating} onClick={e => {e.stopPropagation(); handleStatusChange(o, "delivered");}}>
                    Mark Delivered
                  </Button>
                  <Button size="sm" variant="outline" disabled={statusUpdating} onClick={e => {e.stopPropagation(); handleStatusChange(o, "cancelled");}}>
                    Cancel
                  </Button>
                  {/* Ship Now button: only show if shipment_id exists and not shipped */}
                  {o.shiprocket_shipment_id && !o.shiprocket_awb && (
                    <Button
                      size="sm"
                      variant="default"
                      disabled={!!shipLoading[o.shiprocket_shipment_id]}
                      onClick={e => { e.stopPropagation(); handleShipNow(o); }}
                    >
                      {shipLoading[o.shiprocket_shipment_id] ? 'Shipping...' : 'Ship'}
                    </Button>
                  )}
                  {o.shiprocket_shipment_id && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!!refreshing[o.shiprocket_shipment_id]}
                      onClick={e => { e.stopPropagation(); handleRefreshStatus(o); }}
                    >
                      {refreshing[o.shiprocket_shipment_id] ? 'Refreshing...' : 'Refresh Status'}
                    </Button>
                  )}
                  {/* Download Invoice button */}
                  {o.shiprocket_shipment_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={e => { e.stopPropagation(); handleDownloadInvoice(o); }}
                    >
                      Download Invoice
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination Controls */}
      {!loading && filterOrders(orders).length > 0 && (
        <div className="flex items-center justify-end gap-4 mt-4">
          <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Prev</Button>
          <span className="text-sm">Page {currentPage} of {Math.ceil(filterOrders(orders).length / rowsPerPage)}</span>
          <Button size="sm" variant="outline" disabled={currentPage >= Math.ceil(filterOrders(orders).length / rowsPerPage)} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
        </div>
      )}
      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-5xl w-full relative flex flex-row gap-8 items-start min-h-[80vh] max-h-[90vh] overflow-y-auto">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-primary text-2xl" onClick={() => setSelectedOrder(null)}>&times;</button>
            {/* Left: Order Items */}
            <div className="w-2/3 pr-4">
              <h2 className="text-2xl font-bold mb-2 text-primary">Order #{getOrderCode(selectedOrder)}</h2>
              <div className="mb-2 text-sm text-gray-500">Customer: {getCustomerEmail(selectedOrder.user_id)}</div>
              <div className="mb-2 text-sm text-gray-500">Date: {selectedOrder.created_at?.slice(0,10)}</div>
              {(() => {
                let displayStatus = selectedOrder.shiprocket_status || selectedOrder.order_status || "pending";
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
                } catch (e) {}

                return (
                  <div className="mb-2 text-sm text-gray-500">Status: <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[(displayStatus || "pending").toLowerCase()] || statusColors["pending"]}`}>{displayStatus}</span></div>
                );
              })()}
              {/* AWB number styled consistently */}
              {selectedOrder.shiprocket_awb && (
                <div className="mb-2 text-sm text-gray-700">
                  <span className="font-semibold">AWB:</span> {selectedOrder.shiprocket_awb}
                </div>
              )}
              {selectedOrder.shiprocket_shipment_id && (() => {
                const trackingUrl = selectedOrder.shiprocket_track_url
                  || (selectedOrder.shiprocket_awb ? `https://shiprocket.co/tracking/${selectedOrder.shiprocket_awb}` : null);
                return trackingUrl && selectedOrder.shiprocket_awb ? (
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

              {/* Shipment tracker (admin modal) */}
              <div className="mt-4">
                <ShipmentTracker status={selectedOrder.shiprocket_status} events={selectedOrder.shiprocket_events} />
              </div>
              
              <div className="mt-4">
                <div className="font-semibold mb-1">Order Details</div>
                <div className="text-sm text-gray-700 space-y-3">
                  {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((item, idx) => (
                      <div key={item.id || idx} className="border rounded p-3 bg-gray-50">
                        <div className="font-medium mb-1">
                          {item.product_id ? (
                            <span className="text-indigo-700">Product: {item.name}</span>
                          ) : (
                            <span className="text-yellow-700">Quote: {item.product_id ? item.name : getQuoteDisplayName(item)}</span>
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
                        </div>
                        {/* Product description removed from order item display (UI-only change) */}
                        <div className="flex items-center gap-4 mt-1">
                          <span className="font-bold text-primary">Qty: {item.quantity}</span>
                          <span className="font-bold text-primary">₹{Math.round(Number(item.price)).toLocaleString()}</span>
                        </div>
                        {/* Show STL file download for quotes */}
                        {!item.product_id && item.file_url && (
                          <div className="mt-2">
                            <a
                              href={getSupabasePublicUrl(item.file_url)}
                              download={item.file_name || true}
                              className="inline-flex items-center text-blue-600 hover:underline"
                            >
                              Download STL: {getQuoteDisplayName(item) || 'File'}
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
                      </div>
                    ))
                  ) : (
                    <div>No items found in this order.</div>
                  )}
                </div>
              </div>
            </div>
            {/* Right: Address and Payment Info */}
            <div className="w-1/3 pl-4 flex flex-col gap-6">
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
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="font-semibold mb-2 text-primary">Payment Info</div>
                <div className="text-gray-400 text-sm">(Payment details coming soon)</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagementPage;
