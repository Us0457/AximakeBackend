import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  async function handleStatusChange(id, newStatus) {
    setStatusUpdating(true);
    await supabase.from("profiles").update({ status: newStatus }).eq("id", id);
    await fetchData();
    setStatusUpdating(false);
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
                  <Button size="sm" variant="outline" disabled={statusUpdating} onClick={e => {e.stopPropagation(); handleStatusChange(c.id, c.status === "Active" ? "Suspended" : "Active");}}>
                    {c.status === "Active" ? "Suspend" : "Activate"}
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
    </div>
  );
};

export default CustomerManagementPage;
