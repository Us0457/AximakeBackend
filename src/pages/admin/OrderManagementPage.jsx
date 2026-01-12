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
  // Shiprocket / DB may use either spelling; map both to same style
  canceled: "bg-red-500 text-white",
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
  const [selectedOrders, setSelectedOrders] = useState(new Set()); // set of shiprocket_order_id
  const [bulkAction, setBulkAction] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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
      .select("id, user_id, created_at, price, order_status, items, address, order_code, discount_code, discount_amount, shiprocket_shipment_id, shiprocket_order_id, shiprocket_awb, shiprocket_status, shiprocket_label_url, shiprocket_events, cancelled_by, cancel_reason, cancel_comment, cancelled_at")
      .order("created_at", { ascending: false });
    if (error) setFetchError(error.message);
    // Normalize items for each order in case items is stored as JSON string
    const normalized = (data || []).map(o => {
      if (o && o.items && typeof o.items === 'string') {
        try {
          const pd = JSON.parse(o.items);
          if (Array.isArray(pd)) return { ...o, items: pd };
        } catch (e) { }
      }
      return o;
    });
    setOrders(normalized);
    setLoading(false);
  }

  async function handleSingleAction(order, action) {
    if (!order || !action) return;
    const oid = order.shiprocket_order_id;
    // If shiprocket_order_id missing, try shipment-based fallbacks for common actions
    if (!oid) {
      if (action === 'download_invoice') {
        // Use existing shipment-based invoice flow
        await handleDownloadInvoice(order);
        return;
      }
      if (action === 'ship') {
        // Use shipment-based ship-now flow
        await handleShipNow(order);
        return;
      }
      alert('Order missing Shiprocket order id');
      return;
    }
    setActionLoading(true);
    try {
      let res, data;
      if (action === 'delete') {
        // Delete by DB id if available
        const dbId = order.id;
        if (!dbId) { alert('Cannot delete: missing DB id'); setActionLoading(false); return; }
        res = await fetch(getApiUrl('/api/orders/delete'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [dbId] }) });
        data = await res.json().catch(() => null);
        if (!res.ok) { alert('Delete failed: ' + (data?.error || `HTTP ${res.status}`)); return; }
      } else {
        res = await fetch(getApiUrl('/api/shiprocket-actions'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ids: [oid] })
        });
        data = await res.json().catch(() => null);
        if (!res.ok) { alert('Action failed: ' + (data?.error || data?.message || `HTTP ${res.status}`)); return; }
      }
      // If this was a download action and server returned a URL, automatically download it
      if (action === 'download_invoice') {
        const successItem = (data.success || [])[0];
        const invoiceUrl = successItem && successItem.info && successItem.info.invoice_url;
        if (invoiceUrl) {
          try {
            const pdfRes = await fetch(invoiceUrl);
            if (!pdfRes.ok) throw new Error('Failed to fetch invoice PDF');
            const blob = await pdfRes.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoice_${order.shiprocket_order_id || order.shiprocket_shipment_id || order.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { window.URL.revokeObjectURL(url); a.remove(); }, 200);
          } catch (e) {
            alert('Invoice download failed: ' + (e?.message || e));
          }
        }
      }
      if (action === 'download_label') {
        const successItem = (data.success || [])[0];
        const labelUrl = successItem && successItem.info && successItem.info.label_url;
        if (labelUrl) {
          try {
            const resPdf = await fetch(labelUrl);
            if (!resPdf.ok) throw new Error('Failed to fetch label PDF');
            const blob = await resPdf.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `label_${order.shiprocket_order_id || order.shiprocket_shipment_id || order.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { window.URL.revokeObjectURL(url); a.remove(); }, 200);
          } catch (e) {
            alert('Label download failed: ' + (e?.message || e));
          }
        }
      }
      // Present nice success/skip/errors
      const successCount = (data.success||[]).length;
      const skipped = (data.skipped||[]).map(s => `${s.id}: ${s.reason}`);
      const errors = (data.errors||[]).map(e => `${e.id}: ${e.error}`);
      if (successCount) alert(`${successCount} action(s) completed successfully`);
      if (skipped.length) alert(`Skipped: ${skipped.join('; ')}`);
      if (errors.length) alert(`Errors: ${errors.join('; ')}`);
      await fetchOrders();
    } catch (e) {
      alert('Action failed: ' + (e?.message || e));
    }
    setActionLoading(false);
  }

  async function handleBulkActionExecute() {
    if (!bulkAction) return alert('Select a bulk action');
    const ids = Array.from(selectedOrders || []);
    if (!ids.length) return alert('No orders selected');
    setActionLoading(true);
    try {
      // Handle DB delete locally without calling shiprocket-actions
      if (bulkAction === 'delete') {
        const idMap = {};
        (orders || []).forEach(o => { if (o.shiprocket_order_id) idMap[o.shiprocket_order_id] = o.id; });
        const dbIds = ids.map(sid => idMap[sid]).filter(Boolean);
        if (!dbIds.length) { alert('No matching DB rows found for selected orders'); setActionLoading(false); return; }
        try {
          const delRes = await fetch(getApiUrl('/api/orders/delete'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: dbIds }) });
          const delJson = await delRes.json().catch(() => null);
          if (!delRes.ok) { alert('Delete failed: ' + (delJson?.error || `HTTP ${delRes.status}`)); setActionLoading(false); return; }
          alert(`${delJson.deleted || dbIds.length} order(s) removed from DB`);
          setSelectedOrders(new Set());
          setBulkAction('');
          await fetchOrders();
        } catch (e) {
          alert('Delete failed: ' + (e?.message || e));
        }
        setActionLoading(false);
        return;
      }

      const res = await fetch(getApiUrl('/api/shiprocket-actions'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: bulkAction, ids }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) { alert('Bulk action failed: ' + (data?.error || `HTTP ${res.status}`)); setActionLoading(false); return; }
      const successCount = (data.success||[]).length;
      const skipped = (data.skipped||[]).map(s => `${s.id}: ${s.reason}`);
      const errors = (data.errors||[]).map(e => `${e.id}: ${e.error}`);
      // If this was a bulk download action, try to download returned URLs sequentially
      if (bulkAction === 'download_invoice' && Array.isArray(data.success) && data.success.length) {
        for (const item of data.success) {
          const url = item?.info?.invoice_url;
          if (!url) continue;
          try {
            const r = await fetch(url);
            if (!r.ok) { console.warn('Failed to fetch invoice for', item.id); continue; }
            const blob = await r.blob();
            const obj = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = obj;
            a.download = `invoice_${item.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { window.URL.revokeObjectURL(obj); a.remove(); }, 200);
          } catch (e) { console.warn('Invoice download failed for', item.id, e); }
        }
      }
      if (bulkAction === 'download_label' && Array.isArray(data.success) && data.success.length) {
        for (const item of data.success) {
          const url = item?.info?.label_url;
          if (!url) continue;
          try {
            const r = await fetch(url);
            if (!r.ok) { console.warn('Failed to fetch label for', item.id); continue; }
            const blob = await r.blob();
            const obj = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = obj;
            a.download = `label_${item.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { window.URL.revokeObjectURL(obj); a.remove(); }, 200);
          } catch (e) { console.warn('Label download failed for', item.id, e); }
        }
      }
      
      if (successCount) alert(`${successCount} orders processed successfully`);
      if (skipped.length) alert(`Skipped: ${skipped.join('; ')}`);
      if (errors.length) alert(`Errors: ${errors.join('; ')}`);
      setSelectedOrders(new Set());
      setBulkAction('');
      await fetchOrders();
    } catch (e) {
      alert('Bulk action failed: ' + (e?.message || e));
    }
    setActionLoading(false);
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
      // If order is in a final state, skip external refresh to avoid regressions
      const currentFallback = order.shiprocket_status || order.order_status || "pending";
      const currentLabel = getLatestScanLabel(order.shiprocket_events, currentFallback) || currentFallback;
      const curNorm = (String(currentLabel || "")).toLowerCase();
      if (curNorm.includes('delivered') || curNorm.includes('cancel') || curNorm.includes('fulfilled')) {
        // nothing to refresh for final states
        setRefreshing(prev => ({ ...prev, [order.shiprocket_shipment_id]: false }));
        alert('Order is in a final state; refresh skipped.');
        return;
      }

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
      // Avoid promoting transient "ready" labels to the canonical shiprocket_status via manual refresh.
      const fetchedNorm = String(status || '').toLowerCase();
      const shouldWriteStatus = status && !fetchedNorm.includes('ready');
      // Update only AWB/courier/track_url and conditionally status
      const updates = {
        shiprocket_awb: awb,
        shiprocket_courier: courier,
        shiprocket_track_url: track_url
      };
      if (shouldWriteStatus) updates.shiprocket_status = status;
      await supabase.from('orders').update(updates).eq('shiprocket_shipment_id', order.shiprocket_shipment_id);
      // Add a short delay to ensure DB update is reflected before fetching
      await new Promise(resolve => setTimeout(resolve, 350));
      await fetchOrders();
    } catch (e) {
      console.error('Failed to refresh status:', e);
      alert('Failed to refresh status: ' + (e?.message || e));
    }
    setRefreshing(prev => ({ ...prev, [order.shiprocket_shipment_id]: false }));
  }

  // Cancel order with guards: only allow cancellation for non-final states and before AWB assignment
  async function handleCancelOrder(order) {
    const currentFallback = order.shiprocket_status || order.order_status || "pending";
    const currentLabel = getLatestScanLabel(order.shiprocket_events, currentFallback) || currentFallback;
    const curNorm = (String(currentLabel || "")).toLowerCase();

    // Disallow cancelling final states
    if (curNorm.includes('delivered') || curNorm.includes('cancel') || curNorm.includes('fulfilled')) {
      alert('Order is in a final state and cannot be cancelled.');
      return;
    }

    // Disallow cancelling after AWB assigned — Shiprocket cancellation requires logistics intervention
    if (order.shiprocket_awb) {
      alert('Cannot cancel order after AWB has been assigned. Please contact logistics.');
      return;
    }

    // Only allow cancel from early stages (pending/processing/ready)
    if (!(curNorm.includes('pending') || curNorm.includes('processing') || curNorm.includes('ready') || curNorm.includes('new'))) {
      alert('Order cannot be cancelled in its current state.');
      return;
    }

    // Proceed with cancellation: call backend to cancel via Shiprocket and update DB
    setStatusUpdating(true);
    try {
      const res = await fetch(getApiUrl('/api/shiprocket-cancel-order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id })
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error || data?.message || `HTTP ${res.status}`;
        alert('Cancel failed: ' + msg);
      } else {
        // Optionally trigger email/notification via existing flow
        try { await handleStatusChange(order, 'cancelled'); } catch (e) { /* ignore */ }
        await fetchOrders();
      }
    } catch (e) {
      console.error('Failed to cancel order:', e);
      alert('Failed to cancel order: ' + (e?.message || e));
    }
    setStatusUpdating(false);
  }

  // Download Shiprocket invoice and refresh orders
  async function handleDownloadInvoice(order) {
    if (!order.shiprocket_shipment_id) return;
    try {
      // First call backend to get invoice_url (backend may return 200 JSON with invoice_url or 409 if not ready)
      const res = await fetch(getApiUrl(`/api/shiprocket-invoice?shipment_id=${order.shiprocket_shipment_id}`));
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
      // Fetch the actual PDF from the returned URL and trigger download
      const pdfRes = await fetch(data.invoice_url);
      if (!pdfRes.ok) throw new Error('Failed to fetch invoice PDF from Shiprocket URL');
      const blob = await pdfRes.blob();
      let filename = `invoice_${order.shiprocket_shipment_id}.pdf`;
      const disposition = pdfRes.headers.get('content-disposition');
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

  // Determine if a given action is allowed for an order (used to enable/disable action UI)
  function isActionAllowed(order, action) {
    if (!order) return false;
    const fallback = order.shiprocket_status || order.order_status || "pending";
    const currentLabel = getLatestScanLabel(order.shiprocket_events, fallback) || fallback;
    const curNorm = String(currentLabel || "").toLowerCase();
    const isFinal = curNorm.includes('delivered') || curNorm.includes('cancel') || curNorm.includes('fulfilled');

    switch (action) {
      case 'ship':
        // Allow shipping only when Shiprocket status is NEW, shipment exists and no AWB assigned
        return !!order.shiprocket_shipment_id && !order.shiprocket_awb && curNorm.includes('new');
      case 'download_invoice':
        // Invoice can be requested if we have a shipment id; backend will return 409 if not ready
        return !!order.shiprocket_shipment_id;
      case 'download_label':
        return !!order.shiprocket_awb;
      case 'generate_manifest':
        // Not implemented server-side yet
        return false;
      case 'sync_order':
        return !!order.shiprocket_order_id;
      case 'sync_shipment':
        return !!order.shiprocket_shipment_id;
      case 'sync_tracking':
        return !!order.shiprocket_awb;
      case 'cancel':
        // Allow cancel at any stage (server will attempt cancel via Shiprocket)
        return true;
      default:
        return false;
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-10 px-1">
      <h1 className="text-3xl font-bold mb-6 text-primary">Order Management</h1>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-sm text-gray-700">Selected: <strong>{selectedOrders.size}</strong></div>
        <select value={bulkAction} onChange={e => setBulkAction(e.target.value)} className="border rounded px-2 py-1">
          <option value="">Bulk action</option>
          <option value="ship">Ship (generate AWB)</option>
          <option value="download_invoice">Download Invoice</option>
          <option value="download_label">Download Label</option>
          <option value="sync_order">Sync Order</option>
          <option value="sync_shipment">Sync Shipment</option>
          <option value="sync_tracking">Sync Tracking</option>
          <option value="generate_manifest">Generate Manifest</option>
          <option value="cancel">Cancel Orders</option>
          <option value="delete">Delete Orders (remove from DB)</option>
        </select>
        <Button onClick={handleBulkActionExecute} disabled={actionLoading || selectedOrders.size === 0 || !bulkAction}>Execute</Button>
        <Button variant="outline" onClick={() => { setSelectedOrders(new Set()); setBulkAction(''); }} disabled={selectedOrders.size === 0}>Clear</Button>
      </div>
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                <input type="checkbox" onChange={e => { if (e.target.checked) { const all = filterOrders(orders); const s = new Set(selectedOrders); paginatedOrders(all).forEach(o => o.shiprocket_order_id && s.add(o.shiprocket_order_id)); setSelectedOrders(s); } else setSelectedOrders(new Set()); }} checked={paginatedOrders(filterOrders(orders)).every(o => o.shiprocket_order_id && selectedOrders.has(o.shiprocket_order_id))} />
              </th>
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
                <td className="px-4 py-3">
                  <input type="checkbox" checked={!!(o.shiprocket_order_id && selectedOrders.has(o.shiprocket_order_id))} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); setSelectedOrders(prev => { const s = new Set(Array.from(prev)); if (!o.shiprocket_order_id) return s; if (s.has(o.shiprocket_order_id)) s.delete(o.shiprocket_order_id); else s.add(o.shiprocket_order_id); return s; }); }} />
                </td>
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
                <td className="px-4 py-3">
                  <select onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); const val = e.target.value; if (!val) return; handleSingleAction(o, val); e.target.selectedIndex = 0; }} className="border rounded px-2 py-1">
                    <option value="">Action</option>
                    <option value="ship" disabled={!isActionAllowed(o,'ship')}>Ship Order</option>
                    <option value="download_invoice" disabled={!isActionAllowed(o,'download_invoice')}>Download Invoice</option>
                    <option value="download_label" disabled={!isActionAllowed(o,'download_label')}>Download Label</option>
                    <option value="sync_order" disabled={!isActionAllowed(o,'sync_order')}>Sync Order</option>
                    <option value="sync_shipment" disabled={!isActionAllowed(o,'sync_shipment')}>Sync Shipment</option>
                    <option value="sync_tracking" disabled={!isActionAllowed(o,'sync_tracking')}>Sync Tracking</option>
                    <option value="generate_manifest" disabled={!isActionAllowed(o,'generate_manifest')}>Generate Manifest</option>
                    <option value="cancel" disabled={!isActionAllowed(o,'cancel')}>Cancel Order</option>
                    <option value="delete">Delete Order (remove from DB)</option>
                  </select>
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
                          {item.item_type === 'custom_kit' ? (
                            <span className="text-green-700">Custom Kits: {item.name}</span>
                          ) : item.product_id ? (
                            <span className="text-indigo-700">Product: {item.name}</span>
                          ) : (
                            <span className="text-yellow-700">Quote: {item.product_id ? item.name : getQuoteDisplayName(item)}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-1">
                          {item.category && <span>Category: <span className="font-semibold text-indigo-700">{item.category}</span></span>}
                          {item.material && <span>Material: <span className="font-semibold text-indigo-700">{item.material}</span></span>}
                          {item.color && (
                            (() => {
                              function hexToRgb(hex) {
                                if (!hex) return null;
                                const h = hex.replace('#', '').trim();
                                if (h.length === 3) return { r: parseInt(h[0]+h[0],16), g: parseInt(h[1]+h[1],16), b: parseInt(h[2]+h[2],16) };
                                if (h.length === 6) return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
                                return null;
                              }
                              function hexToColorName(hex) {
                                try {
                                  const names = { Black: '#000000', White: '#ffffff', Red: '#ff0000', Green: '#008000', Blue: '#0000ff', Yellow: '#ffff00', Orange: '#ffa500', Purple: '#800080', Pink: '#ffc0cb', Brown: '#a52a2a', Gray: '#808080', Cyan: '#00ffff', Magenta: '#ff00ff', Teal: '#008080', Olive: '#808000', Navy: '#000080', Maroon: '#800000', Lime: '#00ff00', Silver: '#c0c0c0', Gold: '#ffd700', Indigo: '#4b0082', Violet: '#ee82ee', Beige: '#f5f5dc', Coral: '#ff7f50', 'BlueViolet':'#8a2be2', 'DeepSkyBlue':'#00bfff' };
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
                                } catch (e) { return null; }
                              }
                              const colorLabel = item.color_name || (typeof item.color === 'string' && !item.color.startsWith('#') ? item.color : (typeof item.color === 'string' && item.color.startsWith('#') ? (hexToColorName(item.color) || '') : ''));
                              return (
                                <span>Color: <span className="font-semibold text-indigo-700">
                                  <span className="inline-block w-4 h-4 rounded-full align-middle mr-1 border" style={{ backgroundColor: item.color, borderColor: '#ccc' }}></span>
                                  {colorLabel || 'Custom'}
                                </span></span>
                              );
                            })()
                          )}
                          {item.infill && <span>Infill: <span className="font-semibold text-indigo-700">{item.infill}%</span></span>}
                          {(!item.product_id && (item.file_url || item.file_name)) && item.print_quality && <span>Quality: <span className="font-semibold text-indigo-700">{item.print_quality}</span></span>}
                          {/* Product ID removed from UI per design */}
                        </div>
                        {/* Product description removed from order item display (UI-only change) */}
                        {item.item_type === 'custom_kit' && (() => {
                          // extract components from item.items or description
                          let comps = Array.isArray(item.items) ? item.items : null;
                          if (!comps && typeof item.items === 'string') {
                            try { const pd = JSON.parse(item.items); if (Array.isArray(pd)) comps = pd; } catch (e) { comps = null; }
                          }
                          if (!comps && item.description && typeof item.description === 'string') {
                            try { const pd = JSON.parse(item.description); if (pd && Array.isArray(pd.custom_kit_items)) comps = pd.custom_kit_items; } catch (e) { comps = null; }
                          }
                          comps = comps || [];
                          return (
                            <div className="mt-2">
                              <div className="text-sm font-medium mb-1">Components</div>
                              <div className="space-y-1 text-sm text-gray-700">
                                {comps.length === 0 && <div className="text-xs text-gray-500">No components listed</div>}
                                {comps.map((c, ci) => (
                                  <div key={ci} className="flex items-center justify-between">
                                    <div className="min-w-0 truncate">{c.name}</div>
                                    <div className="text-sm text-gray-600">{c.quantity} × ₹{Number(c.price).toLocaleString()}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
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
              {(() => {
                const isCancelled = (String((selectedOrder.order_status || selectedOrder.shiprocket_status || '')).toLowerCase().includes('cancel') || String(selectedOrder.order_status || '').toLowerCase() === 'cancelled');
                if (!isCancelled) return null;
                return (
                  <div className="border rounded-lg p-4 bg-red-50">
                    <div className="font-semibold mb-2 text-red-700">Cancellation Details</div>
                    <div className="text-sm text-gray-700 space-y-2">
                      <div><strong>Cancelled By:</strong> {selectedOrder.cancelled_by === 'admin' ? 'Admin' : 'User'}</div>
                      <div><strong>Reason:</strong> {selectedOrder.cancel_reason || '—'}</div>
                      {selectedOrder.cancel_comment && <div><strong>Comment:</strong> {selectedOrder.cancel_comment}</div>}
                      <div><strong>Cancelled On:</strong> {selectedOrder.cancelled_at ? new Date(selectedOrder.cancelled_at).toLocaleString() : '—'}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagementPage;
