import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DiscountsManagementPage = () => {
  const [banners, setBanners] = useState([]);
  const [editingBanner, setEditingBanner] = useState(null);
  const [newBanner, setNewBanner] = useState({ text: "", color: "#f59e42" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch banners from Supabase (or use local state if not in DB yet)
  useEffect(() => {
    fetchBanners();
  }, []);

  async function fetchBanners() {
    setLoading(true);
    // If you have a 'discount_banners' table, use it. Otherwise, use localStorage for demo.
    const { data, error } = await supabase.from("discount_banners").select("id, text, color").order("id");
    if (error) setError(error.message);
    setBanners(data || []);
    setLoading(false);
  }

  async function handleAddBanner(e) {
    e.preventDefault();
    const { error } = await supabase.from("discount_banners").insert([newBanner]);
    if (!error) {
      setNewBanner({ text: "", color: "#f59e42" });
      fetchBanners();
    }
  }

  async function handleUpdateBanner(e) {
    e.preventDefault();
    const { error } = await supabase.from("discount_banners").update(editingBanner).eq("id", editingBanner.id);
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
            {banners.map(banner => (
              <div key={banner.id} className="flex items-center gap-4 p-3 rounded shadow" style={{ background: banner.color }}>
                {editingBanner && editingBanner.id === banner.id ? (
                  <form onSubmit={handleUpdateBanner} className="flex gap-2 w-full">
                    <Input value={editingBanner.text} onChange={e => setEditingBanner({ ...editingBanner, text: e.target.value })} className="flex-1" />
                    <Input type="color" value={editingBanner.color} onChange={e => setEditingBanner({ ...editingBanner, color: e.target.value })} className="w-12 h-8 p-0 border-none" />
                    <Button type="submit" size="sm">Save</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingBanner(null)}>Cancel</Button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 font-semibold text-lg" style={{ color: '#fff', textShadow: '0 1px 4px #0006' }}>{banner.text}</span>
                    <Button size="sm" variant="outline" onClick={() => setEditingBanner(banner)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteBanner(banner.id)}>Delete</Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        {/* Add New Banner */}
        <form onSubmit={handleAddBanner} className="flex gap-2 items-center mt-2">
          <Input value={newBanner.text} onChange={e => setNewBanner({ ...newBanner, text: e.target.value })} placeholder="Banner text..." className="flex-1" required />
          <Input type="color" value={newBanner.color} onChange={e => setNewBanner({ ...newBanner, color: e.target.value })} className="w-12 h-8 p-0 border-none" />
          <Button type="submit" size="sm">Add Banner</Button>
        </form>
      </div>
      {/* ...other discounts/coupons management features can go here... */}
    </div>
  );
};

export default DiscountsManagementPage;
