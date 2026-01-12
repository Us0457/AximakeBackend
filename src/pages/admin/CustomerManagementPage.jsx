import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiUrl } from '@/lib/utils';

const statusColors = {
  Active: "bg-green-100 text-green-700",
  Suspended: "bg-red-100 text-red-700",
};

const CustomerManagementPage = () => {
  const [customers, setCustomers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [suspendModal, setSuspendModal] = useState({ open: false, id: null, email: null });
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [rawCustomers, setRawCustomers] = useState(null);
  const [rawOrders, setRawOrders] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setDataLoaded(false);
    setFetchError(null);
    // Fetch customers and orders in parallel
    const [{ data: customersData, error: customersError }, { data: ordersData, error: ordersError }] = await Promise.all([
      supabase.from("profiles").select("id, email, created_at"), // removed status
      supabase.from("quotes").select("id, user_id, price"),
    ]);
    setRawCustomers(customersData);
    setRawOrders(ordersData);
    if (customersError || ordersError) {
      setFetchError((customersError?.message || "") + (ordersError?.message || ""));
      setCustomers([]);
      setLoading(false);
      setDataLoaded(true);
      return;
    }
    // Calculate order_count and total_spent for each customer
    const normalized = (customersData || []).map(c => {
      const userOrders = (ordersData || []).filter(o => o.user_id === c.id);
      return {
        ...c,
        status: "Active", // default since no status column
        order_count: userOrders.length,
        total_spent: userOrders.reduce((sum, o) => sum + (o.price || 0), 0),
      };
    });
    setCustomers(normalized);
    setLoading(false);
    setDataLoaded(true);
  }

  function filterCustomers(list) {
    if (filter === "new") return list.filter(c => c.order_count === 1);
    if (filter === "returning") return list.filter(c => c.order_count > 1);
    if (filter === "high-value") return list.filter(c => (c.total_spent || 0) > 10000);
    return list;
  }

  function searchCustomers(list) {
    if (!search) return list;
    return list.filter(c => c.email.toLowerCase().includes(search.toLowerCase()));
  }

  // Suspend/Activate handler: do NOT update a non-existent `status` column directly.
  // Suspend should be handled by a backend admin API that performs safe deletion.
  async function handleStatusChange(id, newStatus) {
    // If attempting to suspend, ask for confirmation then call admin API
    if (newStatus === "Suspended") {
      const ok = window.confirm("Are you sure you want to suspend this customer? This action will permanently remove the user's account, profile data, and avatar image. This action cannot be undone.");
      if (!ok) return;
      setStatusUpdating(true);
      try {
        const res = await fetch(getApiUrl('/api/admin/suspend-user'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          alert('Suspend failed: ' + (data?.error || data?.message || `HTTP ${res.status}`));
        } else {
          alert('Customer suspended successfully');
          await fetchData();
        }
      } catch (e) {
        console.error('Suspend failed', e);
        alert('Suspend failed: ' + (e?.message || e));
      }
      setStatusUpdating(false);
      return;
    }

    // Activating a suspended user is not implemented here. If you have a `status` column
    // in your schema and wish to support toggling, implement a dedicated RPC or admin API.
    alert('Activation is not supported from this UI; please use the admin API.');
  }

  return (
    <div className="max-w-7xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-primary">Customer Management</h1>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
          <Button variant={filter === "new" ? "default" : "outline"} onClick={() => setFilter("new")}>New</Button>
          <Button variant={filter === "returning" ? "default" : "outline"} onClick={() => setFilter("returning")}>Returning</Button>
          <Button variant={filter === "high-value" ? "default" : "outline"} onClick={() => setFilter("high-value")}>High Value</Button>
        </div>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Search by email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Button variant="outline" onClick={fetchData}>Refresh</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg shadow border border-gray-200 bg-white">
        {fetchError && (
          <div className="text-red-600 p-4">Supabase fetch error: {fetchError}</div>
        )}
        {customers.length === 0 && (
          <div className="text-xs text-gray-400 p-2">Raw customers: <pre>{JSON.stringify(rawCustomers, null, 2)}</pre>Raw orders: <pre>{JSON.stringify(rawOrders, null, 2)}</pre></div>
        )}
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Joined</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Orders</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Total Spent</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">Loading...</td></tr>
            ) : !dataLoaded ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">Loading data...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">No customers found.</td></tr>
            ) : filterCustomers(searchCustomers(customers)).length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">No customers match your search/filter.</td></tr>
            ) : filterCustomers(searchCustomers(customers)).map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => setSelectedCustomer(c)}>
                <td className="px-4 py-3 font-medium text-primary underline">{c.email}</td>
                <td className="px-4 py-3">{c.created_at?.slice(0,10)}</td>
                <td className="px-4 py-3">{c.order_count || 0}</td>
                <td className="px-4 py-3">₹{c.total_spent || 0}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[c.status || "Active"]}`}>{c.status || "Active"}</span>
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="outline" disabled={statusUpdating} onClick={e => { e.stopPropagation(); if ((c.status || 'Active') === 'Active') { setSuspendModal({ open: true, id: c.id, email: c.email }); } else { alert('Activation not supported from this UI'); } }}>
                    {(c.status || 'Active') === 'Active' ? 'Suspend' : 'Activate'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-primary" onClick={() => setSelectedCustomer(null)}>&times;</button>
            <h2 className="text-2xl font-bold mb-2 text-primary">{selectedCustomer.email}</h2>
            <div className="mb-2 text-sm text-gray-500">Joined: {selectedCustomer.created_at?.slice(0,10)}</div>
            <div className="mb-2 text-sm text-gray-500">Status: <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[selectedCustomer.status || "Active"]}`}>{selectedCustomer.status || "Active"}</span></div>
            <div className="mb-2 text-sm text-gray-500">Total Orders: {selectedCustomer.order_count || 0}</div>
            <div className="mb-2 text-sm text-gray-500">Total Spent: ₹{selectedCustomer.total_spent || 0}</div>
            {/* Order History */}
            <div className="mt-4">
              <div className="font-semibold mb-1">Order History</div>
              {rawOrders && rawOrders.filter(o => o.user_id === selectedCustomer.id).length > 0 ? (
                <table className="min-w-full text-xs border mt-2">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 border">Order ID</th>
                      <th className="px-2 py-1 border">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawOrders.filter(o => o.user_id === selectedCustomer.id).map(o => (
                      <tr key={o.id}>
                        <td className="px-2 py-1 border">{o.id}</td>
                        <td className="px-2 py-1 border">₹{o.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-gray-400 text-sm">No orders found for this customer.</div>
              )}
            </div>
            {/* Customer Inquiries placeholder */}
            <div className="mt-4">
              <div className="font-semibold mb-1">Customer Inquiries</div>
              <div className="text-gray-400 text-sm">(Inquiries/messages coming soon)</div>
            </div>
          </div>
        </div>
      )}
      {/* Suspend Confirmation Modal */}
      {suspendModal.open && (
        <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/60 p-4" onClick={() => setSuspendModal({ open: false, id: null, email: null })}>
          <div className="bg-white rounded-lg shadow-lg w-full md:w-2/3 max-w-xl p-6 relative z-[10000]" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className="text-xl font-semibold mb-3">Confirm Suspension</h3>
            <p className="text-sm text-gray-700 mb-4">Are you sure you want to suspend this customer? This action will permanently remove the user’s account, profile data, and avatar image. This action cannot be undone.</p>
            <div className="text-sm text-gray-600 mb-4">Customer: <strong>{suspendModal.email}</strong></div>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 bg-white border rounded" onClick={() => setSuspendModal({ open: false, id: null, email: null })}>Cancel</button>
              <button className="px-4 py-2 bg-red-600 text-white rounded" onClick={async () => {
                setStatusUpdating(true);
                try {
                  // Use current session token for Authorization: Bearer <token>
                  const { data: sessionData } = await supabase.auth.getSession();
                  const token = sessionData?.session?.access_token || null;
                  const headers = { 'Content-Type': 'application/json' };
                  if (token) headers['Authorization'] = `Bearer ${token}`;
                  const res = await fetch(getApiUrl('/api/admin/suspend-user'), { method: 'POST', headers, body: JSON.stringify({ id: suspendModal.id }) });
                  const data = await res.json().catch(() => null);
                  if (!res.ok) {
                    alert('Suspend failed: ' + (data?.error || data?.message || `HTTP ${res.status}`));
                  } else {
                    alert('Customer suspended');
                    setSuspendModal({ open: false, id: null, email: null });
                    await fetchData();
                  }
                } catch (e) {
                  console.error('Suspend failed', e);
                  alert('Suspend failed: ' + (e?.message || e));
                }
                setStatusUpdating(false);
              }}>Confirm Suspension</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManagementPage;
