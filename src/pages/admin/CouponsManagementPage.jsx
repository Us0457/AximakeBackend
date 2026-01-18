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
  // Discount banners (mirrored from DiscountsManagementPage)
  const [banners, setBanners] = useState([]);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [bannerError, setBannerError] = useState(null);
  const [editingBanner, setEditingBanner] = useState(null);
  const [newBanner, setNewBanner] = useState({ text: "", bg_color: "#f59e42", font_color: '#ffffff', is_active: true, moving: false, speed: 100, height: 40 });

  useEffect(() => {
    fetchCoupons();
    fetchUsageHistory();
    fetchBanners();
  }, []);

  async function fetchBanners() {
    setBannerLoading(true);
    try {
      const { data, error } = await supabase
        .from('discount_banners')
        .select('id, text, bg_color, font_color, is_active, moving, speed, "order"')
        .order('"order"', { ascending: true });
      if (error) throw error;
      setBanners(data || []);
    } catch (e) {
      try {
        const { data: data2, error: err2 } = await supabase.from('discount_banners').select('id, text, color').order('id');
        if (err2) setBannerError(err2.message);
        const normalized = (data2 || []).map(r => ({ id: r.id, text: r.text, bg_color: r.color, font_color: '#ffffff', is_active: true, moving: false, speed: 100, order: r.id, height: 40 }));
        setBanners(normalized);
      } catch (e2) {
        setBannerError(e2.message || String(e2));
        setBanners([]);
      }
    }
    setBannerLoading(false);
  }

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

  // --- Discount Banners CRUD (safe mirror) ---
  async function handleAddBanner(e) {
    e.preventDefault();
    const maxOrder = (banners || []).reduce((m, b) => Math.max(m, Number(b.order || b.id || 0)), 0);
    const payload = { ...newBanner, order: maxOrder + 1 };
    try {
      const { error } = await supabase.from('discount_banners').insert([payload]);
      if (error) throw error;
      setNewBanner({ text: '', bg_color: '#f59e42', font_color: '#ffffff', is_active: true, moving: false, speed: 100, height: 40 });
      fetchBanners();
    } catch (err) {
      // If DB doesn't have `height` column, retry without it
      const msg = err?.message || String(err);
      if (/column .*height.* does not exist/i.test(msg) || msg.includes('42703')) {
        const fallbacks = { ...payload }; delete fallbacks.height;
        const { error: e2 } = await supabase.from('discount_banners').insert([fallbacks]);
        if (!e2) {
          setNewBanner({ text: '', bg_color: '#f59e42', font_color: '#ffffff', is_active: true, moving: false, speed: 100, height: 40 });
          fetchBanners();
          return;
        }
      }
      setBannerError(msg);
    }
  }

  async function handleUpdateBanner(e) {
    e.preventDefault();
    const payload = { ...editingBanner };
    const { id } = payload;
    delete payload.id;
    try {
      const { error } = await supabase.from('discount_banners').update(payload).eq('id', id);
      if (error) throw error;
      setEditingBanner(null);
      fetchBanners();
    } catch (err) {
      const msg = err?.message || String(err);
      if (/column .*height.* does not exist/i.test(msg) || msg.includes('42703')) {
        const fallback = { ...payload }; delete fallback.height;
        const { error: e2 } = await supabase.from('discount_banners').update(fallback).eq('id', id);
        if (!e2) {
          setEditingBanner(null);
          fetchBanners();
          return;
        }
      }
      setBannerError(msg);
    }
  }

  async function handleDeleteBanner(id) {
    if (!window.confirm('Delete this banner?')) return;
    await supabase.from('discount_banners').delete().eq('id', id);
    fetchBanners();
  }

  async function moveBanner(id, delta) {
    const idx = (banners || []).findIndex(b => b.id === id);
    if (idx === -1) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= banners.length) return;
    const a = banners[idx];
    const b = banners[targetIdx];
    const aOrder = Number(a.order || a.id || 0);
    const bOrder = Number(b.order || b.id || 0);
    try {
      const { error: e1 } = await supabase.from('discount_banners').update({ "order": bOrder }).eq('id', a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('discount_banners').update({ "order": aOrder }).eq('id', b.id);
      if (e2) throw e2;
      fetchBanners();
    } catch (err) {
      console.error('moveBanner error', err);
      setBannerError(err.message || String(err));
    }
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

      {/* Discount Banners (mirrored UI) */}
      <div className="mb-8 mt-8">
        <h2 className="text-xl font-semibold mb-2">Discount Banners</h2>
        {bannerLoading ? (
          <div>Loading banners...</div>
        ) : banners.length === 0 ? (
          <div className="text-gray-400">No banners yet.</div>
        ) : (
          <div className="flex flex-col gap-3 mb-4">
            {banners.map((banner) => (
              <div key={banner.id} className="p-3 rounded shadow flex flex-col md:flex-row md:items-center md:gap-4" style={{ background: banner.bg_color || banner.color || '#f59e42', minHeight: (banner.height || 40) }}>
                {editingBanner && editingBanner.id === banner.id ? (
                  <form onSubmit={handleUpdateBanner} className="flex flex-col md:flex-row gap-2 w-full">
                    <Input value={editingBanner.text} onChange={e => setEditingBanner({ ...editingBanner, text: e.target.value })} className="flex-1" />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-800 mr-1">BG</label>
                      <Input type="color" value={editingBanner.bg_color || '#f59e42'} onChange={e => setEditingBanner({ ...editingBanner, bg_color: e.target.value })} className="w-12 h-8 p-0 border-none" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-800 mr-1">Font</label>
                      <Input type="color" value={editingBanner.font_color || '#ffffff'} onChange={e => setEditingBanner({ ...editingBanner, font_color: e.target.value })} className="w-12 h-8 p-0 border-none" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs">Active</label>
                      <input type="checkbox" checked={!!editingBanner.is_active} onChange={e => setEditingBanner({ ...editingBanner, is_active: e.target.checked })} />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs">Moving</label>
                      <input type="checkbox" checked={!!editingBanner.moving} onChange={e => setEditingBanner({ ...editingBanner, moving: e.target.checked })} />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs">Speed</label>
                      <input type="range" min="20" max="400" value={editingBanner.speed || 100} onChange={e => setEditingBanner({ ...editingBanner, speed: Number(e.target.value) })} />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs">Height</label>
                      <Input type="number" value={editingBanner.height || 40} onChange={e => setEditingBanner({ ...editingBanner, height: Number(e.target.value) })} className="w-24" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="submit" size="sm">Save</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingBanner(null)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-lg" style={{ color: banner.font_color || '#fff', textShadow: '0 1px 4px #0006' }}>{banner.text}</div>
                        <div className="text-xs text-slate-800 mt-1">{banner.moving ? `Moving • ${banner.speed || 100}` : 'Static'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingBanner(banner)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteBanner(banner.id)}>Delete</Button>
                      <Button size="sm" onClick={() => moveBanner(banner.id, -1)} title="Move up">↑</Button>
                      <Button size="sm" onClick={() => moveBanner(banner.id, 1)} title="Move down">↓</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddBanner} className="flex flex-col md:flex-row gap-2 items-center mt-2">
          <Input value={newBanner.text} onChange={e => setNewBanner({ ...newBanner, text: e.target.value })} placeholder="Banner text..." className="flex-1" required />
          <div className="flex items-center gap-2">
            <label className="text-xs">BG</label>
            <Input type="color" value={newBanner.bg_color} onChange={e => setNewBanner({ ...newBanner, bg_color: e.target.value })} className="w-12 h-8 p-0 border-none" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs">Font</label>
            <Input type="color" value={newBanner.font_color} onChange={e => setNewBanner({ ...newBanner, font_color: e.target.value })} className="w-12 h-8 p-0 border-none" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs">Moving</label>
            <input type="checkbox" checked={!!newBanner.moving} onChange={e => setNewBanner({ ...newBanner, moving: e.target.checked })} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs">Speed</label>
            <input type="range" min="20" max="400" value={newBanner.speed} onChange={e => setNewBanner({ ...newBanner, speed: Number(e.target.value) })} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs">Height</label>
            <Input type="number" value={newBanner.height} onChange={e => setNewBanner({ ...newBanner, height: Number(e.target.value) })} className="w-24" />
          </div>
          <Button type="submit" size="sm">Add Banner</Button>
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
