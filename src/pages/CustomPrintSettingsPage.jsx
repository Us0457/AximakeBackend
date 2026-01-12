import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label'; // Ensure Label import exists
import { useNavigate } from 'react-router-dom';

const CustomPrintSettingsPage = () => {
  const [materials, setMaterials] = useState([]); // [{name, price}]
  const [colorsByMaterial, setColorsByMaterial] = useState({}); // { [materialName]: [{name, value}] }
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch settings from Supabase
  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase.from('settings').select('custom_print_materials, custom_print_prices').single();
      if (data) {
        setMaterials(data.custom_print_prices || []);
        setColorsByMaterial(
          (data.custom_print_materials || []).reduce((acc, mat) => {
            acc[mat.name] = mat.colors || [];
            return acc;
          }, {})
        );
        if ((data.custom_print_prices || []).length > 0) {
          setSelectedMaterial(data.custom_print_prices[0].name);
        }
      } else {
        setMaterials([
          { name: 'PLA', price: 5 },
          { name: 'PETG', price: 7 },
        ]);
        setColorsByMaterial({
          'PLA': [{ name: 'Purple', value: '#8A2BE2' }],
          'PETG': [{ name: 'Blue', value: '#00BFFF' }],
        });
        setSelectedMaterial('PLA');
      }
    }
    fetchSettings();
  }, []);

  useEffect(() => {
    // Defensive: if material changes, update price if possible
    const selected = materials.find(m => m.name === selectedMaterial);
    if (selected && selected.price !== undefined) {
      // Optionally, you could update a preview price here if needed
    }
  }, [selectedMaterial, materials]);

  // --- Material Table Section ---
  const handleMaterialChange = (idx, field, value) => {
    setMaterials(prev => prev.map((mat, i) =>
      i === idx ? { ...mat, [field]: field === 'price' ? Number(value) : value } : mat
    ));
  };
  const handleAddMaterial = () => {
    setMaterials(prev => [...prev, { name: '', price: 1 }]);
  };
  const handleRemoveMaterial = (idx) => {
    const matName = materials[idx].name;
    setMaterials(prev => prev.filter((_, i) => i !== idx));
    setColorsByMaterial(prev => {
      const copy = { ...prev };
      delete copy[matName];
      return copy;
    });
    setTimeout(() => {
      const remaining = materials.filter((_, i) => i !== idx);
      if (remaining.length > 0) {
        setSelectedMaterial(remaining[0].name);
      } else {
        setSelectedMaterial('');
      }
    }, 0);
  };

  // --- Color Config Section ---
  const handleSelectMaterial = (name) => {
    setSelectedMaterial(name);
  };
  const handleAddColor = () => {
    if (!selectedMaterial) return;
    setColorsByMaterial(prev => ({
      ...prev,
      [selectedMaterial]: [...(prev[selectedMaterial] || []), { name: '', value: '#000000' }]
    }));
  };
  const handleColorChange = (colorIdx, field, value) => {
    setColorsByMaterial(prev => {
      const colors = prev[selectedMaterial] || [];
      let updatedColor = { ...colors[colorIdx] };
      if (field === 'name') {
        // If user types a color name or hex, update the color picker if valid
        let colorValue = updatedColor.value;
        const temp = document.createElement('div');
        temp.style.color = value;
        if (temp.style.color !== '') {
          // Valid CSS color name
          document.body.appendChild(temp);
          const computed = getComputedStyle(temp).color;
          document.body.removeChild(temp);
          // Convert rgb to hex
          if (computed.startsWith('rgb')) {
            const rgb = computed.match(/\d+/g);
            if (rgb) {
              colorValue = '#' + rgb.map(x => (+x).toString(16).padStart(2, '0')).join('');
            }
          } else {
            colorValue = value;
          }
        } else if (/^#([0-9A-F]{3}){1,2}$/i.test(value)) {
          colorValue = value;
        }
        updatedColor = { ...updatedColor, name: value, value: colorValue };
      } else if (field === 'value') {
        // If user picks a color, update the name to the hex code
        updatedColor = { ...updatedColor, value, name: value };
      }
      return {
        ...prev,
        [selectedMaterial]: colors.map((c, i) => i === colorIdx ? updatedColor : c)
      };
    });
  };
  const handleRemoveColor = (colorIdx) => {
    setColorsByMaterial(prev => ({
      ...prev,
      [selectedMaterial]: prev[selectedMaterial].filter((_, i) => i !== colorIdx)
    }));
  };

  const handleSaveAll = async () => {
    // Prevent saving if any material name is empty or duplicated
    const names = materials.map(m => m.name.trim());
    const hasEmpty = names.some(n => !n);
    const hasDup = new Set(names).size !== names.length;
    if (hasEmpty) {
      toast({ title: 'Error', description: 'Material names cannot be empty.' });
      return;
    }
    if (hasDup) {
      toast({ title: 'Error', description: 'Material names must be unique.' });
      return;
    }
    setSaving(true);
    // Save both prices and colors in a way Custom Print Page expects
    const custom_print_materials = materials.map(mat => ({
      name: mat.name,
      colors: colorsByMaterial[mat.name] || [],
    }));
    const custom_print_prices = materials.map(mat => ({
      name: mat.name,
      price: Number(mat.price)
    }));
    await supabase.from('settings').upsert({ id: 1, custom_print_materials, custom_print_prices }, { onConflict: 'id' });
    setSaving(false);
    toast({ title: 'Saved!', description: 'Custom print settings updated.' });
  };

  // Defensive validation for material names and prices
  const isMaterialNameValid = (name, idx) => {
    if (!name.trim()) return false;
    return materials.findIndex((mat, i) => mat.name.trim() === name.trim() && i !== idx) === -1;
  };
  const isPriceValid = (price) => !isNaN(Number(price)) && Number(price) >= 0;
  const canSave = materials.length > 0 && materials.every((mat, idx) => isMaterialNameValid(mat.name, idx) && isPriceValid(mat.price));

  // --- Shop Section Settings State ---
  const [shopSections, setShopSections] = useState([]); // [{title,image,mode,category_id,product_ids,display_order,active}]
  const [editingSectionIndex, setEditingSectionIndex] = useState(-1);
  const [sectionDraft, setSectionDraft] = useState({ title: '', image: '', mode: 'category', category_id: null, product_ids: [], display_order: 0, active: true });
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    async function fetchShopSections() {
      // Defensive: some deployments may not have a shop_sections column yet
      const { data } = await supabase.from('settings').select('*').maybeSingle();
      if (data && data.shop_sections) {
        // Normalize image paths to full public URLs when needed using supabase client
        const normalized = await Promise.all((data.shop_sections || []).map(async (s) => {
          if (!s || !s.image) return s;
          // if it's already a URL, leave it
          if (/^https?:\/\//i.test(s.image)) return s;

          try {
            const { data: pub } = await supabase.storage.from('banners').getPublicUrl(s.image);
            let publicUrl = pub?.publicUrl || pub?.publicURL || s.image;

            // try a HEAD to ensure the URL is valid
            try {
              const resp = await fetch(publicUrl, { method: 'HEAD' });
              if (resp.status !== 200) {
                const m = publicUrl.match(/\/object\/public\/banners\/(.*)$/);
                if (m && m[1]) {
                  const key = decodeURIComponent(m[1]);
                  const { data: pub2 } = await supabase.storage.from('banners').getPublicUrl(key);
                  publicUrl = pub2?.publicUrl || pub2?.publicURL || publicUrl;
                }
              }
            } catch (e) {
              // ignore HEAD failure
            }

            return { ...s, image: publicUrl };
          } catch (e) {
            return { ...s, image: s.image };
          }
        }));
        setShopSections(normalized || []);
      }
    }
    async function fetchProductsAndCategories() {
      let prodData = [];
      let catData = [];
      // Try to select minimal columns; if the DB schema differs, fall back to broader select
      try {
        // include `category` so we can derive categories from the product rows (matches ProductGalleryPage)
        const { data: p } = await supabase.from('products').select('id, name, category').order('name');
        prodData = p || [];
      } catch (err) {
        try {
          const { data: p } = await supabase.from('products').select('*').limit(1000);
          prodData = p || [];
        } catch (e) {
          prodData = [];
        }
      }

      // Derive categories from products to avoid depending on a separate `categories` table
      const names = Array.from(new Set((prodData || []).map(p => p.category).filter(Boolean)));
      const derived = names.map((n, i) => ({ id: n, name: n }));

      setProducts(prodData || []);
      setCategories(derived || []);
    }
    fetchShopSections();
    fetchProductsAndCategories();
  }, []);

  const startNewSection = () => {
    setEditingSectionIndex(-1);
    setSectionDraft({ title: '', image: '', mode: 'category', category_id: categories[0]?.id || null, product_ids: [], display_order: (shopSections.length || 0) + 1, active: true });
  };

  const startEditSection = (idx) => {
    setEditingSectionIndex(idx);
    const s = shopSections[idx];
    setSectionDraft({ title: s.title || '', image: s.image || '', mode: s.mode || 'category', category_id: s.category_id || null, product_ids: s.product_ids || [], display_order: s.display_order || idx + 1, active: s.active !== false });
  };

  const removeSection = async (idx) => {
    if (!window.confirm('Delete this shop section? This only removes the section configuration.')) return;
    const copy = shopSections.slice();
    copy.splice(idx, 1);
    const updated = copy.map((s, i) => ({ ...s, display_order: i + 1 }));
    setShopSections(updated);
    try {
      await saveSectionsToSettings(updated);
    } catch (e) {
      console.error('Failed to persist section deletion', e);
      toast({ title: 'Error', description: 'Could not save changes. Please try again.', variant: 'destructive' });
    }
  };

  const handleUploadImage = async (file) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      // Use a simple filename path (avoid adding a 'banners/' prefix which may conflict with bucket policies)
      const uploadPath = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('banners').upload(uploadPath, file, { upsert: true });
      if (error) throw error;
      // prefer returned path if available, else call getPublicUrl
      let publicUrl;
      if (data && data.path) {
        const { data: pub } = await supabase.storage.from('banners').getPublicUrl(data.path);
        publicUrl = pub?.publicUrl || pub?.publicURL || data.path;
      } else {
        const { data: pub } = await supabase.storage.from('banners').getPublicUrl(uploadPath);
        publicUrl = pub?.publicUrl || pub?.publicURL || uploadPath;
      }
      // verify the public URL is reachable (some deployments return odd shapes)
      async function verifyUrl(url) {
        try {
          const resp = await fetch(url, { method: 'HEAD' });
          return resp.status;
        } catch (e) {
          return null;
        }
      }

      let finalUrl = publicUrl;
      const status = await verifyUrl(finalUrl);
      if (status !== 200) {
        // Try to recover: if the publicUrl contains the object/public path, extract the object key
        const m = finalUrl.match(/\/object\/public\/banners\/(.*)$/);
        if (m && m[1]) {
          const key = decodeURIComponent(m[1]);
          try {
            const { data: pub2 } = await supabase.storage.from('banners').getPublicUrl(key);
            const candidate = pub2?.publicUrl || pub2?.publicURL || finalUrl;
            const s2 = await verifyUrl(candidate);
            if (s2 === 200) finalUrl = candidate;
          } catch (e) {
            // ignore
          }
        }
      }

      // store the full public URL so frontend image fetches the public object endpoint
      console.info('banner upload result', { data, publicUrl: finalUrl, raw: data });
      setSectionDraft(prev => ({ ...prev, image: finalUrl }));
    } catch (err) {
      console.error('Upload error', err);
      // Detect RLS / unauthorized error and show actionable guidance
      const message = err?.message || (err?.error && err.error.message) || String(err);
      if (message && /row-level security|violates row-level security|Unauthorized|403/i.test(message)) {
        toast({
          title: 'Upload blocked by Storage policy',
          description: `Supabase blocked the upload due to a Storage RLS policy. Attempted object path: ${uploadPath}. Ensure the bucket 'banners' allows authenticated uploads to this path (or upload via server). See Storage → Policies.`,
          variant: 'destructive'
        });
      } else {
        toast({ title: 'Image upload failed', description: message, variant: 'destructive' });
      }
    }
    setUploadingImage(false);
  };

  const saveSectionsToSettings = async (sections) => {
    await supabase.from('settings').upsert({ id: 1, shop_sections: sections }, { onConflict: 'id' });
    toast({ title: 'Saved', description: 'Shop sections updated.' });
  };

  const handleSaveSectionDraft = () => {
    const draft = { ...sectionDraft };
    const cleaned = { ...draft, title: (draft.title || '').trim(), product_ids: draft.product_ids || [], display_order: Number(draft.display_order) || 0 };
    let updated = shopSections.slice();
    if (editingSectionIndex >= 0) {
      updated[editingSectionIndex] = cleaned;
    } else {
      updated.push(cleaned);
    }
    // Normalize order
    updated = updated.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)).map((s, i) => ({ ...s, display_order: i + 1 }));
    setShopSections(updated);
    setEditingSectionIndex(-1);
    setSectionDraft({ title: '', image: '', mode: 'category', category_id: null, product_ids: [], display_order: 0, active: true });
    saveSectionsToSettings(updated);
  };

  return (
    <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-8">
      <h1 className="text-3xl font-bold mb-6">Custom Print Page Settings</h1>
      <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
        <div className="flex-1 min-w-0">
          {/* Material Table Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Material Table</h2>
            <table className="min-w-full text-sm border rounded mb-2">
              <thead>
                <tr>
                  <th className="px-2 py-1 border">Material</th>
                  <th className="px-2 py-1 border">Unit Price (₹)</th>
                  <th className="px-2 py-1 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((mat, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-1 border">
                      <Input className="w-32" placeholder="Material Name" value={mat.name} onChange={e => handleMaterialChange(idx, 'name', e.target.value)} />
                    </td>
                    <td className="px-2 py-1 border">
                      <Input className="w-20" type="number" min="0" step="0.01" placeholder="Unit Price" value={mat.price} onChange={e => handleMaterialChange(idx, 'price', e.target.value)} />
                    </td>
                    <td className="px-2 py-1 border">
                      <Button type="button" size="icon" variant="ghost" onClick={() => handleRemoveMaterial(idx)}><Trash2 className="w-4 h-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button type="button" size="sm" variant="outline" onClick={handleAddMaterial}>Add Material</Button>
          </div>
          {/* Color Configuration Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Color Configuration</h2>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-medium">Select Material:</span>
              <select className="border rounded px-2 py-1" value={selectedMaterial} onChange={e => handleSelectMaterial(e.target.value)}>
                {materials.map((mat, idx) => (
                  <option key={idx} value={mat.name}>{mat.name}</option>
                ))}
              </select>
            </div>
            {selectedMaterial && (
              <div className="ml-0 lg:ml-6">
                <div className="mb-1 font-medium">Colors for {selectedMaterial}:</div>
                {(colorsByMaterial[selectedMaterial] || []).map((color, cidx) => (
                  <div key={cidx} className="flex items-center gap-2 mb-1 flex-wrap">
                    <Input className="w-24" placeholder="Color Name or Hex" value={color.name} onChange={e => handleColorChange(cidx, 'name', e.target.value)} />
                    <input type="color" className="w-8 h-8 border rounded" value={color.value} onChange={e => handleColorChange(cidx, 'value', e.target.value)} />
                    <Button type="button" size="icon" variant="ghost" onClick={() => handleRemoveColor(cidx)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={handleAddColor} disabled={!selectedMaterial}>Add Color</Button>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <Button type="button" size="sm" onClick={handleSaveAll} disabled={saving || !canSave}>{saving ? 'Saving...' : 'Save All'}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => navigate(-1)}>Back</Button>
          </div>
        </div>
        {/* Material & Color Overview Card */}
        <div className="w-full lg:w-96 bg-white/80 rounded-lg shadow-md p-4 border border-gray-200 mt-8 lg:mt-0">
          <h3 className="font-semibold mb-2 text-lg">Material & Color Overview</h3>
          <div className="grid grid-cols-1 gap-3">
            {materials.map(mat => (
              <div key={mat.name} className="mb-2">
                <div className="font-medium mb-1">{mat.name}</div>
                <div className="flex flex-wrap gap-2">
                  {(colorsByMaterial[mat.name] || []).map((color, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <span className="inline-block w-5 h-5 rounded border" style={{ background: color.value }} title={color.name || color.value}></span>
                      <span className="text-xs text-gray-700">{color.name || color.value}</span>
                    </div>
                  ))}
                  {(colorsByMaterial[mat.name] || []).length === 0 && <span className="text-xs text-gray-400">No colors</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Shop Section Settings */}
      <div className="mt-10 border-t pt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Shop Section Settings</h2>
          <Button type="button" size="sm" onClick={startNewSection}>Add Section</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            {shopSections.length === 0 ? (
              <div className="text-sm text-gray-500">No shop sections configured yet.</div>
            ) : (
              shopSections.sort((a,b)=> (a.display_order||0)-(b.display_order||0)).map((s, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded border">
                  <div className="w-20 h-20 flex-shrink-0 bg-gray-50 rounded overflow-hidden border">
                    {s.image ? <img src={s.image} alt={s.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No Image</div>}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{s.title || 'Untitled'}</div>
                    <div className="text-xs text-gray-500">Mode: {s.mode || 'category'} • Order: {s.display_order || idx+1} • {s.active === false ? 'Inactive' : 'Active'}</div>
                    {s.mode === 'category' && s.category_id && <div className="text-xs text-gray-600 mt-1">Category: {categories.find(c=>c.id===s.category_id)?.name || s.category_id}</div>}
                    {s.mode === 'manual' && Array.isArray(s.product_ids) && s.product_ids.length > 0 && <div className="text-xs text-gray-600 mt-1">Products: {s.product_ids.length}</div>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEditSection(idx)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => removeSection(idx)}>Delete</Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div>
            <div className="bg-white p-4 rounded border">
              <h3 className="font-medium mb-3">{editingSectionIndex >= 0 ? 'Edit Section' : 'New Section'}</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="section_title">Section Title</Label>
                  <Input id="section_title" value={sectionDraft.title} onChange={e=>setSectionDraft(prev=>({...prev, title: e.target.value}))} className="w-full" />
                </div>
                <div>
                  <Label>Left-side Banner Image</Label>
                  <div className="flex items-center gap-2">
                    <input type="file" accept="image/*" onChange={e=>handleUploadImage(e.target.files?.[0])} />
                    {uploadingImage && <span className="text-sm text-gray-500">Uploading...</span>}
                  </div>
                  {sectionDraft.image && <div className="mt-2 w-40 h-24 overflow-hidden rounded border"><img src={sectionDraft.image} alt="banner" className="w-full h-full object-cover" /></div>}
                </div>
                <div>
                  <Label>Product Source Type</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <label className="flex items-center gap-2"><input type="radio" name="mode" checked={sectionDraft.mode==='category'} onChange={()=>setSectionDraft(prev=>({...prev, mode:'category'}))} /> <span className="text-sm">Category-based</span></label>
                    <label className="flex items-center gap-2"><input type="radio" name="mode" checked={sectionDraft.mode==='manual'} onChange={()=>setSectionDraft(prev=>({...prev, mode:'manual'}))} /> <span className="text-sm">Manual selection</span></label>
                  </div>
                </div>
                {sectionDraft.mode === 'category' ? (
                  <div>
                    <Label htmlFor="section_category">Select Category</Label>
                    <select id="section_category" className="w-full rounded border px-2 py-1" value={sectionDraft.category_id||''} onChange={e=>setSectionDraft(prev=>({...prev, category_id: e.target.value || null}))}>
                      <option value="">-- Select --</option>
                      {categories.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <Label>Choose Products (manual)</Label>
                    <div className="max-h-44 overflow-auto border rounded p-2">
                      {products.map(p=> (
                        <label key={p.id} className="flex items-center gap-2 text-sm mb-1">
                          <input type="checkbox" checked={(sectionDraft.product_ids||[]).includes(p.id)} onChange={e=>{
                            const checked = e.target.checked;
                            setSectionDraft(prev=>{
                              const list = new Set(prev.product_ids || []);
                              if (checked) list.add(p.id); else list.delete(p.id);
                              return {...prev, product_ids: Array.from(list)};
                            });
                          }} />
                          <span>{p.title || p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Display Order</Label>
                    <Input type="number" value={sectionDraft.display_order||0} onChange={e=>setSectionDraft(prev=>({...prev, display_order: Number(e.target.value)}))} className="h-10" />
                  </div>
                  <div>
                    <Label>Active</Label>
                    <div className="mt-2"><label className="flex items-center gap-2"><input type="checkbox" checked={sectionDraft.active} onChange={e=>setSectionDraft(prev=>({...prev, active: e.target.checked}))} /> <span className="text-sm">Enabled</span></label></div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={()=>{ setEditingSectionIndex(-1); setSectionDraft({ title: '', image: '', mode: 'category', category_id: null, product_ids: [], display_order: 0, active: true }); }}>Reset</Button>
                  <Button type="button" onClick={handleSaveSectionDraft}>Save Section</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomPrintSettingsPage;
