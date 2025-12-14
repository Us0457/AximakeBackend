import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialCoupon = {
  code: "",
  discount_type: "percentage",
  value: 0,
  valid_from: "",
  valid_to: "",
  usage_limit: "",
  active: true,
};

const CouponsManagementPage = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [newCoupon, setNewCoupon] = useState(initialCoupon);
  const [usageHistory, setUsageHistory] = useState([]);

  useEffect(() => {
    fetchCoupons();
    fetchUsageHistory();
  }, []);

  async function fetchCoupons() {
    setLoading(true);
    const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    if (error) setError(error.message);
    setCoupons(data || []);
    setLoading(false);
  }

  async function fetchUsageHistory() {
    // Fetch coupon usage from orders table
    const { data, error } = await supabase
      .from('orders')
      .select('id, coupon, created_at, user_id')
      .not('coupon', 'is', null)
      .order('created_at', { ascending: false });
    if (!error && data) setUsageHistory(data);
  }

  async function handleAddCoupon(e) {
    e.preventDefault();
    const { error } = await supabase.from("coupons").insert([{ ...newCoupon, value: Number(newCoupon.value) }]);
    if (!error) {
      setNewCoupon(initialCoupon);
      fetchCoupons();
    }
  }

  async function handleUpdateCoupon(e) {
    e.preventDefault();
    const { error } = await supabase.from("coupons").update(editingCoupon).eq("id", editingCoupon.id);
    if (!error) {
      setEditingCoupon(null);
      fetchCoupons();
    }
  }

  async function handleDeleteCoupon(id) {
    if (!window.confirm("Delete this coupon?")) return;
    await supabase.from("coupons").delete().eq("id", id);
    fetchCoupons();
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-primary">Discounts & Coupons</h1>
      {/* Coupons Table */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Coupons</h2>
        {loading ? (
          <div>Loading coupons...</div>
        ) : coupons.length === 0 ? (
          <div className="text-gray-400">No coupons yet.</div>
        ) : (
          <div className="flex flex-col gap-3 mb-4">
            {coupons.map(coupon => (
              <div key={coupon.id} className="flex flex-wrap items-center gap-4 p-3 rounded shadow bg-white border border-gray-200">
                {editingCoupon && editingCoupon.id === coupon.id ? (
                  <form onSubmit={handleUpdateCoupon} className="flex flex-wrap gap-2 w-full items-center">
                    <Input value={editingCoupon.code} onChange={e => setEditingCoupon({ ...editingCoupon, code: e.target.value })} placeholder="Code" className="w-32" required />
                    <select value={editingCoupon.discount_type} onChange={e => setEditingCoupon({ ...editingCoupon, discount_type: e.target.value })} className="w-32 border rounded px-2 py-1">
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed</option>
                    </select>
                    <Input type="number" value={editingCoupon.value} onChange={e => setEditingCoupon({ ...editingCoupon, value: e.target.value })} placeholder="Value" className="w-24" required />
                    <Input type="date" value={editingCoupon.valid_from || ""} onChange={e => setEditingCoupon({ ...editingCoupon, valid_from: e.target.value })} className="w-36" />
                    <Input type="date" value={editingCoupon.valid_to || ""} onChange={e => setEditingCoupon({ ...editingCoupon, valid_to: e.target.value })} className="w-36" />
                    <Input type="number" value={editingCoupon.usage_limit || ""} onChange={e => setEditingCoupon({ ...editingCoupon, usage_limit: e.target.value })} placeholder="Usage Limit" className="w-24" />
                    <label className="flex items-center gap-1"><input type="checkbox" checked={editingCoupon.active} onChange={e => setEditingCoupon({ ...editingCoupon, active: e.target.checked })} />Active</label>
                    <Button type="submit" size="sm">Save</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingCoupon(null)}>Cancel</Button>
                  </form>
                ) : (
                  <>
                    <span className="font-mono font-bold text-lg bg-gray-100 px-2 py-1 rounded">{coupon.code}</span>
                    <span className="text-sm">{coupon.discount_type === "percentage" ? `${coupon.value}%` : `₹${coupon.value}`}</span>
                    <span className="text-xs text-gray-500">{coupon.valid_from} to {coupon.valid_to}</span>
                    <span className="text-xs text-gray-500">Used: {coupon.usage_count || 0}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""}</span>
                    <span className={`text-xs font-bold ${coupon.active ? "text-green-600" : "text-red-500"}`}>{coupon.active ? "Active" : "Inactive"}</span>
                    <Button size="sm" variant="outline" onClick={() => setEditingCoupon(coupon)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteCoupon(coupon.id)}>Delete</Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        {/* Add New Coupon */}
        <form onSubmit={handleAddCoupon} className="flex flex-wrap gap-2 items-center mt-2">
          <Input value={newCoupon.code} onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value })} placeholder="Code" className="w-32" required />
          <select value={newCoupon.discount_type} onChange={e => setNewCoupon({ ...newCoupon, discount_type: e.target.value })} className="w-32 border rounded px-2 py-1">
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed</option>
          </select>
          <Input type="number" value={newCoupon.value} onChange={e => setNewCoupon({ ...newCoupon, value: e.target.value })} placeholder="Value" className="w-24" required />
          <Input type="date" value={newCoupon.valid_from || ""} onChange={e => setNewCoupon({ ...newCoupon, valid_from: e.target.value })} className="w-36" />
          <Input type="date" value={newCoupon.valid_to || ""} onChange={e => setNewCoupon({ ...newCoupon, valid_to: e.target.value })} className="w-36" />
          <Input type="number" value={newCoupon.usage_limit || ""} onChange={e => setNewCoupon({ ...newCoupon, usage_limit: e.target.value })} placeholder="Usage Limit" className="w-24" />
          <label className="flex items-center gap-1"><input type="checkbox" checked={newCoupon.active} onChange={e => setNewCoupon({ ...newCoupon, active: e.target.checked })} />Active</label>
          <Button type="submit" size="sm">Add Coupon</Button>
        </form>
      </div>
      {/* Coupon Usage History Table */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-2">Coupon Usage History</h2>
        {usageHistory.length === 0 ? (
          <div className="text-gray-400">No coupon usage yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg shadow bg-white/80 mb-8">
            <table className="min-w-full divide-y divide-accent/30">
              <thead className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Order ID</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Coupon Code</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">User ID</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Date Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent/10">
                {usageHistory.map((row) => (
                  <tr key={row.id} className="hover:bg-accent/10 transition">
                    <td className="px-4 py-3">{row.id}</td>
                    <td className="px-4 py-3 font-mono">{row.coupon}</td>
                    <td className="px-4 py-3">{row.user_id}</td>
                    <td className="px-4 py-3 text-xs">{new Date(row.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CouponsManagementPage;
