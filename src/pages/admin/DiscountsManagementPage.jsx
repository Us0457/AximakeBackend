import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DiscountsManagementPage = () => {
  const [banners, setBanners] = useState([]);
  const [editingBanner, setEditingBanner] = useState(null);
  const [newBanner, setNewBanner] = useState({ text: "", bg_color: "#f59e42", font_color: '#ffffff', is_active: true, moving: false, speed: 100 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch banners from Supabase (or use local state if not in DB yet)
  useEffect(() => {
    fetchBanners();
  }, []);

  async function fetchBanners() {
    setLoading(true);
    // Try the newer schema first; if the DB doesn't have those columns, fallback to basic columns
    try {
      const { data, error } = await supabase
        .from("discount_banners")
        .select('id, text, bg_color, font_color, is_active, moving, speed, "order"')
        .order('"order"', { ascending: true });
      if (error) throw error;
      setBanners(data || []);
    } catch (e) {
      // Fallback: older schema with `color` column
      try {
        const { data: data2, error: err2 } = await supabase.from('discount_banners').select('id, text, color').order('id');
        if (err2) setError(err2.message);
        // normalize into new shape for UI
        const normalized = (data2 || []).map(r => ({ id: r.id, text: r.text, bg_color: r.color, font_color: '#ffffff', is_active: true, moving: false, speed: 100, order: r.id }));
        setBanners(normalized);
      } catch (e2) {
        setError(e2.message || String(e2));
        setBanners([]);
      }
    }
    setLoading(false);
  }

  async function handleAddBanner(e) {
    e.preventDefault();
    // determine order: append to end
    const maxOrder = (banners || []).reduce((m, b) => Math.max(m, Number(b.order || b.id || 0)), 0);
    const payload = { ...newBanner, order: maxOrder + 1 };
    const { error } = await supabase.from("discount_banners").insert([payload]);
    if (!error) {
      setNewBanner({ text: "", bg_color: "#f59e42", font_color: '#ffffff', is_active: true, moving: false, speed: 100 });
      fetchBanners();
    }
  }

  async function handleUpdateBanner(e) {
    e.preventDefault();
    const payload = { ...editingBanner };
    // remove transient fields
    const { id } = payload;
    delete payload.id;
    const { error } = await supabase.from("discount_banners").update(payload).eq("id", id);
    if (!error) {
      setEditingBanner(null);
      fetchBanners();
    }
  }

  async function handleDeleteBanner(id) {
    if (!window.confirm("Delete this banner?")) return;
    await supabase.from("discount_banners").delete().eq("id", id);
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
      setError(err.message || String(err));
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-primary">Discounts & Coupons</h1>
      {/* Editable Discount Banners */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Discount Banners</h2>
        {loading ? (
          <div>Loading banners...</div>
        ) : banners.length === 0 ? (
          <div className="text-gray-400">No banners yet.</div>
        ) : (
          <div className="flex flex-col gap-3 mb-4">
            {banners.map((banner, idx) => (
              <div key={banner.id} className="p-3 rounded shadow flex flex-col md:flex-row md:items-center md:gap-4" style={{ background: banner.bg_color || banner.color || '#f59e42' }}>
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
        {/* Add New Banner */}
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
          <Button type="submit" size="sm">Add Banner</Button>
        </form>
      </div>
      {/* ...other discounts/coupons management features can go here... */}
    </div>
  );
};

export default DiscountsManagementPage;
