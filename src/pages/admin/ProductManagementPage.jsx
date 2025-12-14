import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as XLSX from 'xlsx';
import { useToast } from '@/components/ui/use-toast';

const ProductManagementPage = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({ name: "", category: "", price: 0, original_price: '', stock: 0, visible: true, featured: false, description: "", material: "", weight: "", dimensions: "", short_description: "", difficulty: "", includes: "", outcomes: "", specifications: "", documentation: "", faq: "" });
  const [imageFiles, setImageFiles] = useState([]);
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    // Fetch all columns; optional kit fields may or may not exist in schema
    const { data, error } = await supabase.from("products").select("*").limit(1000);
    setProducts(data || []);
    setLoading(false);
  }

  // Image upload handler
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(files);
  };

  // Helper to sanitize numeric fields (convert empty string to null or number)
  function sanitizeProductData(product) {
    const numericFields = ['price', 'original_price', 'stock', 'weight'];
    const sanitized = { ...product };
    numericFields.forEach(field => {
      if (sanitized[field] === '' || sanitized[field] === undefined) {
        sanitized[field] = null;
      } else if (typeof sanitized[field] === 'string') {
        const num = Number(sanitized[field]);
        sanitized[field] = isNaN(num) ? null : num;
      }
    });
    return sanitized;
  }

  // Parse comma-separated input into array and trim entries
  function parseCommaSeparated(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  }

  // Normalize specifications (key: value lines or JSON) into object or raw string
  function normalizeSpecifications(value) {
    if (!value) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    // Try JSON
    if ((trimmed.startsWith('{') || trimmed.startsWith('['))) {
      try { return JSON.parse(trimmed); } catch {}
    }
    // Parse key: value lines
    const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const obj = {};
    let foundKV = false;
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join(':').trim();
        if (key) { obj[key] = val; foundKV = true; }
      }
    }
    if (foundKV) return obj;
    // otherwise keep as raw string
    return trimmed;
  }

  // Normalize FAQ text into array of {q,a} — always returns array
  function normalizeFAQ(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      // Ensure shape
      return value.map(entry => {
        if (!entry) return { q: '', a: '' };
        if (typeof entry === 'string') return { q: entry, a: '' };
        return { q: entry.q || entry.question || '', a: entry.a || entry.answer || '' };
      });
    }
    if (typeof value !== 'string') {
      // Convert object-like into array if possible
      try {
        const asJson = JSON.parse(JSON.stringify(value));
        if (Array.isArray(asJson)) return normalizeFAQ(asJson);
      } catch {}
      return [];
    }
    const trimmed = value.trim();
    // Try JSON
    if ((trimmed.startsWith('[') || trimmed.startsWith('{'))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return normalizeFAQ(parsed);
        if (typeof parsed === 'object') {
          // Possibly an object mapping questions to answers
          return Object.entries(parsed).map(([k, v]) => ({ q: k, a: String(v) }));
        }
      } catch {}
    }
    // Split into blocks separated by blank line
    const blocks = trimmed.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    const out = [];
    for (const block of blocks) {
      // Try "Question - Answer" on a single line
      const dash = block.split(/\s?-\s?/);
      if (dash.length === 2) {
        out.push({ q: dash[0].trim(), a: dash[1].trim() });
        continue;
      }
      // Try first line as question, rest as answer
      const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length >= 2) {
        out.push({ q: lines[0], a: lines.slice(1).join(' ') });
        continue;
      }
      // Fallback: whole block as question
      out.push({ q: block, a: '' });
    }
    return out;
  }

  // Prepare a string for editing in textarea: pretty JSON if structured, otherwise raw string
  function faqForEdit(value) {
    if (!value) return '';
    if (Array.isArray(value)) return JSON.stringify(value, null, 2);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return JSON.stringify(parsed, null, 2);
      } catch {}
      return value;
    }
    // object -> stringify
    try {
      return JSON.stringify(value, null, 2);
    } catch { return String(value); }
  }

  async function handleAddProduct(e) {
    e.preventDefault();
    setUploading(true);
    setSuccessMsg("");
    setErrorMsg("");
    let imageUrls = [];
    if (imageFiles.length > 0) {
      for (let file of imageFiles) {
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(`products/${Date.now()}-${file.name}`, file);
        if (data && data.path) {
          imageUrls.push(data.path);
        }
      }
    }
    // Convert includes/outcomes (comma-separated) into arrays
    const includesArr = parseCommaSeparated(newProduct.includes);
    const outcomesArr = parseCommaSeparated(newProduct.outcomes);
    const specs = normalizeSpecifications(newProduct.specifications);
    const faqs = normalizeFAQ(newProduct.faq);
    const payload = {
      ...newProduct,
      images: JSON.stringify(imageUrls),
      includes: includesArr,
      outcomes: outcomesArr,
      // store structured specs/faqs as JSON strings if structured, else as raw text
      specifications: typeof specs === 'object' ? JSON.stringify(specs) : (specs || ''),
      faq: Array.isArray(faqs) ? JSON.stringify(faqs) : (faqs || ''),
    };
    const sanitizedProduct = sanitizeProductData(payload);
    // Validate original_price: must be greater than selling price. If invalid, clear and warn.
    if (sanitizedProduct.original_price !== null && sanitizedProduct.price !== null && Number(sanitizedProduct.original_price) <= Number(sanitizedProduct.price)) {
      toast({ title: 'Original price ignored', description: 'Original Price must be greater than selling Price — it was cleared.', variant: 'warning' });
      sanitizedProduct.original_price = null;
    }
    const { error } = await supabase.from("products").insert([
      sanitizedProduct
    ]);
    setUploading(false);
    if (error) {
      setErrorMsg(error.message);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSuccessMsg("Product added successfully!");
      toast({ title: 'Success', description: 'Product added successfully!' });
      fetchProducts();
    }
  }

  async function handleUpdateProduct() {
    setUploading(true);
    setSuccessMsg("");
    setErrorMsg("");
    // --- Fix: Only update images if new files are selected ---
    let imagePaths;
    if (imageFiles.length > 0) {
      imagePaths = editingProduct.images && Array.isArray(editingProduct.images) ? [...editingProduct.images] : [];
      for (let file of imageFiles) {
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(`products/${Date.now()}-${file.name}`, file);
        if (data && data.path) {
          imagePaths.push(data.path);
        }
      }
    } else {
      // If no new files, preserve the original images as-is (parse if needed)
      imagePaths = (() => {
        if (!editingProduct.images || (Array.isArray(editingProduct.images) && editingProduct.images.length === 0)) {
          // fallback to original product images if available
          const original = products.find(p => p.id === editingProduct.id);
          if (original && original.images) {
            if (Array.isArray(original.images)) return original.images;
            if (typeof original.images === 'string') {
              try {
                const arr = JSON.parse(original.images);
                if (Array.isArray(arr)) return arr;
                if (typeof arr === 'string') return [arr];
              } catch {
                if (original.images.includes(',')) return original.images.split(',').map(s => s.trim()).filter(Boolean);
                return [original.images];
              }
            }
          }
          return [];
        }
        if (Array.isArray(editingProduct.images)) return editingProduct.images;
        if (typeof editingProduct.images === 'string') {
          try {
            const arr = JSON.parse(editingProduct.images);
            if (Array.isArray(arr)) return arr;
            if (typeof arr === 'string') return [arr];
          } catch {
            if (editingProduct.images.includes(',')) return editingProduct.images.split(',').map(s => s.trim()).filter(Boolean);
            return [editingProduct.images];
          }
        }
        return [];
      })();
    }
    // --- Fix: Always preserve description if not changed ---
    let description = editingProduct.description;
    if (!description || description.trim() === '') {
      const original = products.find(p => p.id === editingProduct.id);
      if (original && original.description) description = original.description;
      else description = '';
    }
    // Ensure includes/outcomes are stored as arrays and specs/faqs are stored as structured JSON when possible
    const includesArr = parseCommaSeparated(editingProduct.includes);
    const outcomesArr = parseCommaSeparated(editingProduct.outcomes);

    // Specifications: normalize and, if object, store as JSON string; otherwise store raw string
    const specsNormalized = normalizeSpecifications(editingProduct.specifications);
    const specsForStore = (specsNormalized && typeof specsNormalized === 'object') ? JSON.stringify(specsNormalized) : (specsNormalized || '');

    // FAQ: produce a consistent array of {q,a} and store as JSON string
    let faqArray = [];
    if (Array.isArray(editingProduct.faq)) {
      faqArray = normalizeFAQ(editingProduct.faq);
    } else if (typeof editingProduct.faq === 'string') {
      const s = editingProduct.faq.trim();
      if (s.startsWith('[') || s.startsWith('{')) {
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) faqArray = normalizeFAQ(parsed);
          else if (typeof parsed === 'object') faqArray = Object.entries(parsed).map(([k, v]) => ({ q: k, a: String(v) }));
        } catch {
          faqArray = normalizeFAQ(s);
        }
      } else {
        faqArray = normalizeFAQ(s);
      }
    }
    const faqForStore = (faqArray && faqArray.length > 0) ? JSON.stringify(faqArray) : '';

    const sanitizedProduct = sanitizeProductData({
      ...editingProduct,
      images: JSON.stringify(imagePaths),
      description,
      includes: includesArr,
      outcomes: outcomesArr,
      short_description: editingProduct.short_description || '',
      difficulty: editingProduct.difficulty || '',
      specifications: specsForStore,
      documentation: editingProduct.documentation || '',
      faq: faqForStore,
    });
    // Validate original_price for updates as well
    if (sanitizedProduct.original_price !== null && sanitizedProduct.price !== null && Number(sanitizedProduct.original_price) <= Number(sanitizedProduct.price)) {
      toast({ title: 'Original price ignored', description: 'Original Price must be greater than selling Price — it was cleared.', variant: 'warning' });
      sanitizedProduct.original_price = null;
    }
    const { error } = await supabase.from("products").update(sanitizedProduct).eq("id", editingProduct.id);
    setUploading(false);
    setImageFiles([]); // Clear image files after update
    if (error) {
      setErrorMsg(error.message);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSuccessMsg("Product updated successfully!");
      toast({ title: 'Success', description: 'Product updated successfully!' });
      setEditingProduct(null);
      fetchProducts();
    }
  }

  async function handleDeleteProduct(id) {
    if (!window.confirm("Delete this product?")) return;
    await supabase.from("products").delete().eq("id", id);
    fetchProducts();
  }

  function filteredProducts() {
    if (!search) return products;
    return products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }

  // Bulk upload handler
  const handleBulkUpload = async (e) => {
    setUploading(true);
    setSuccessMsg("");
    setErrorMsg("");
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const [header, ...rows] = json;
      const productsToInsert = rows.map(row => {
        const obj = {};
        header.forEach((key, idx) => {
          obj[key.toLowerCase()] = row[idx];
        });
        // Normalize images field
        if (obj.images) {
          let images = obj.images;
          if (typeof images === 'string') {
            // Remove curly braces and quotes
            images = images.replace(/[{}'"]/g, '').trim();
            // Split by comma if needed
            let arr = images.split(',').map(s => s.trim()).filter(Boolean);
            obj.images = JSON.stringify(arr);
          } else if (Array.isArray(images)) {
            obj.images = JSON.stringify(images.filter(Boolean));
          }
        } else {
          obj.images = JSON.stringify([]);
        }
        // Sanitize numeric fields
        const numericFields = ['price', 'stock', 'weight'];
        numericFields.forEach(field => {
          if (obj[field] === '' || obj[field] === undefined) {
            obj[field] = null;
          } else if (typeof obj[field] === 'string') {
            const num = Number(obj[field]);
            obj[field] = isNaN(num) ? null : num;
          }
        });
        obj.visible = Boolean(obj.visible);
        obj.featured = Boolean(obj.featured);
        return obj;
      });
      const { error } = await supabase.from('products').insert(productsToInsert);
      setUploading(false);
      if (error) {
        setErrorMsg(error.message);
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        setSuccessMsg("Bulk upload successful!");
        toast({ title: 'Success', description: 'Bulk upload successful!' });
        fetchProducts();
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // When opening the edit modal, ensure images and description are always present and parsed correctly
  useEffect(() => {
    if (editingProduct) {
      // Parse images if it's a string
      let images = editingProduct.images;
      if (typeof images === 'string') {
        try {
          images = JSON.parse(images);
        } catch {
          images = images ? [images] : [];
        }
      }
      if (!Array.isArray(images)) images = images ? [images] : [];
      // Parse includes/outcomes and other optional kit fields
      let includes = editingProduct.includes;
      if (typeof includes === 'string') {
        try { includes = JSON.parse(includes); } catch { includes = includes ? includes.split(',').map(s => s.trim()).filter(Boolean) : []; }
      }
      if (!Array.isArray(includes)) includes = includes ? [includes] : [];
      let outcomes = editingProduct.outcomes;
      if (typeof outcomes === 'string') {
        try { outcomes = JSON.parse(outcomes); } catch { outcomes = outcomes ? outcomes.split(',').map(s => s.trim()).filter(Boolean) : []; }
      }
      if (!Array.isArray(outcomes)) outcomes = outcomes ? [outcomes] : [];
      // Prepare specifications and faq for textarea editing (pretty JSON if structured)
      const specsVal = (function(val) {
        if (!val) return '';
        if (typeof val === 'string') {
          const s = val.trim();
          try {
            const parsed = JSON.parse(s);
            if (typeof parsed === 'object') return JSON.stringify(parsed, null, 2);
          } catch {}
          return val;
        }
        try { return JSON.stringify(val, null, 2); } catch { return String(val); }
      })(editingProduct.specifications);
      const faqVal = faqForEdit(editingProduct.faq);

      setEditingProduct(p => ({
        ...p,
        images,
        description: p.description || '',
        includes,
        outcomes,
        short_description: p.short_description || '',
        difficulty: p.difficulty || '',
        specifications: specsVal,
        documentation: p.documentation || '',
        faq: faqVal,
      }));
    }
    // eslint-disable-next-line
  }, [editingProduct && editingProduct.id]);

  // --- Add this helper to always parse images to an array ---
  function getImageArray(images) {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    if (typeof images === 'string') {
      try {
        const arr = JSON.parse(images);
        if (Array.isArray(arr)) return arr;
        if (typeof arr === 'string') return [arr];
      } catch {
        if (images.includes(',')) return images.split(',').map(s => s.trim()).filter(Boolean);
        return [images];
      }
    }
    return [];
  }

  return (
    <div className="max-w-7xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-primary">Product Management</h1>
      <div className="bg-white rounded-xl shadow p-6 mb-8 space-y-6">
        <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="block font-medium text-sm text-zinc-700">Name
              <Input placeholder="Name" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} required className="mt-1" />
            </label>
            <label className="block font-medium text-sm text-zinc-700">Description
              <Input placeholder="Description" value={newProduct.description || ""} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} className="mt-1" />
            </label>
            <label className="block font-medium text-sm text-zinc-700">Category
              <Input placeholder="Category" value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))} className="mt-1" />
            </label>
            <label className="block font-medium text-sm text-zinc-700">Material
              <Input placeholder="Material" value={newProduct.material} onChange={e => setNewProduct(p => ({ ...p, material: e.target.value }))} className="mt-1" />
            </label>
            <label className="block font-medium text-sm text-zinc-700">Weight (g)
              <Input placeholder="Weight" type="number" min={0} value={newProduct.weight} onChange={e => setNewProduct(p => ({ ...p, weight: e.target.value }))} className="mt-1" />
            </label>
            <label className="block font-medium text-sm text-zinc-700">Dimensions
              <Input placeholder="Dimensions (e.g. 10x10x10cm)" value={newProduct.dimensions} onChange={e => setNewProduct(p => ({ ...p, dimensions: e.target.value }))} className="mt-1" />
            </label>
            <label className="block font-medium text-sm text-zinc-700">Short Description
              <Input placeholder="Short description for listing" value={newProduct.short_description} onChange={e => setNewProduct(p => ({ ...p, short_description: e.target.value }))} className="mt-1" />
            </label>
            <label className="block font-medium text-sm text-zinc-700">Difficulty
              <Input placeholder="Difficulty (e.g. Beginner)" value={newProduct.difficulty} onChange={e => setNewProduct(p => ({ ...p, difficulty: e.target.value }))} className="mt-1" />
            </label>
            <label className="block font-medium text-sm text-zinc-700">Includes (comma-separated)
              <Input placeholder="e.g. Arduino UNO, USB cable, Sensors" value={newProduct.includes} onChange={e => setNewProduct(p => ({ ...p, includes: e.target.value }))} className="mt-1" />
            </label>
            <label className="block font-medium text-sm text-zinc-700">Outcomes (comma-separated)
              <Input placeholder="e.g. Build IoT projects, Learn sensors" value={newProduct.outcomes} onChange={e => setNewProduct(p => ({ ...p, outcomes: e.target.value }))} className="mt-1" />
            </label>
            <label className="block font-medium text-sm text-zinc-700">Specifications
              <textarea placeholder="Specifications or technical notes" value={newProduct.specifications} onChange={e => setNewProduct(p => ({ ...p, specifications: e.target.value }))} className="mt-1 w-full border rounded p-2 text-sm" />
            </label>
            <label className="block font-medium text-sm text-zinc-700">Documentation URL
              <Input placeholder="Documentation URL or notes" value={newProduct.documentation} onChange={e => setNewProduct(p => ({ ...p, documentation: e.target.value }))} className="mt-1" />
            </label>
            <label className="block font-medium text-sm text-zinc-700">FAQ
              <textarea placeholder="FAQ or common questions" value={newProduct.faq} onChange={e => setNewProduct(p => ({ ...p, faq: e.target.value }))} className="mt-1 w-full border rounded p-2 text-sm" />
            </label>
          </div>
          <div className="space-y-4">
            <label className="block font-medium text-sm text-zinc-700">Price
              <Input placeholder="Price" type="number" min={0} value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} required className="mt-1" />
            </label>
            <label className="block font-medium text-sm text-zinc-700">Original Price (MRP)
              <Input placeholder="Original price / MRP" type="number" min={0} value={newProduct.original_price} onChange={e => setNewProduct(p => ({ ...p, original_price: e.target.value }))} className="mt-1" />
            </label>
            <label className="block font-medium text-sm text-zinc-700">Stock
              <Input placeholder="Stock" type="number" min={0} value={newProduct.stock} onChange={e => setNewProduct(p => ({ ...p, stock: e.target.value }))} required className="mt-1" />
            </label>
            <label className="block font-medium text-sm text-zinc-700">Images
              <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="mt-1" />
              {imageFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {imageFiles.map((file, idx) => (
                    <span key={idx} className="text-xs bg-zinc-100 px-2 py-1 rounded border border-zinc-200">{file.name}</span>
                  ))}
                </div>
              )}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={newProduct.visible} onChange={e => setNewProduct(p => ({ ...p, visible: e.target.checked }))} /> Visible
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={newProduct.featured} onChange={e => setNewProduct(p => ({ ...p, featured: e.target.checked }))} /> Featured
            </label>
            <Button type="submit" disabled={uploading}>{uploading ? 'Adding...' : 'Add Product'}</Button>
          </div>
        </form>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <label className="block font-medium text-sm text-zinc-700 mb-1">Bulk Upload (CSV or Excel)
              <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleBulkUpload} className="mt-1" />
            </label>
            <p className="text-xs text-zinc-500 mt-1">Check column names and formatting. <a href="/sample-products.csv" download className="text-blue-600 underline">Download sample CSV</a>.</p>
          </div>
        </div>
        {(successMsg || errorMsg) && (
          <div className={`rounded p-3 text-sm font-medium ${successMsg ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{successMsg || errorMsg}</div>
        )}
      </div>
      <div className="flex justify-between mb-4">
        <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
      </div>
      <div className="overflow-x-auto rounded-lg shadow border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Category</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Price</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Stock</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Visible</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Featured</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">Loading...</td></tr>
            ) : filteredProducts().length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">No products found.</td></tr>
            ) : filteredProducts().map(p => (
              <tr key={p.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-primary underline cursor-pointer" onClick={() => {
                  // Parse images if needed
                  let images = p.images;
                  if (typeof images === 'string') {
                    try {
                      images = JSON.parse(images);
                    } catch {
                      images = images.split(',').map(s => s.trim()).filter(Boolean);
                    }
                  }
                  setEditingProduct({
                    ...p,
                    images,
                    description: p.description || '',
                    weight: p.weight || '',
                    material: p.material || '',
                    dimensions: p.dimensions || '',
                    category: p.category || '',
                    price: p.price || 0,
                    stock: p.stock || 0,
                    visible: typeof p.visible === 'boolean' ? p.visible : true,
                    featured: typeof p.featured === 'boolean' ? p.featured : false,
                    name: p.name || '',
                  });
                }}>{p.name}</td>
                <td className="px-4 py-3">{p.category}</td>
                <td className="px-4 py-3">₹{p.price}</td>
                <td className="px-4 py-3">{p.stock}</td>
                <td className="px-4 py-3">{p.visible ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3">{p.featured ? "Yes" : "No"}</td>
                <td className="px-4 py-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingProduct(p)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteProduct(p.id)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-3xl w-full relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-primary" onClick={() => setEditingProduct(null)}>&times;</button>
            <h2 className="text-2xl font-bold mb-4 text-primary">Edit Product</h2>
            <form onSubmit={e => { e.preventDefault(); handleUpdateProduct(); }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="block font-medium text-sm text-zinc-700">Name
                  <Input placeholder="Name" value={editingProduct.name} onChange={e => setEditingProduct(p => ({ ...p, name: e.target.value }))} required className="mt-1" />
                </label>
                <label className="block font-medium text-sm text-zinc-700">Description
                  <Input placeholder="Description" value={editingProduct.description || ""} onChange={e => setEditingProduct(p => ({ ...p, description: e.target.value }))} className="mt-1" />
                </label>
                <label className="block font-medium text-sm text-zinc-700">Category
                  <Input placeholder="Category" value={editingProduct.category} onChange={e => setEditingProduct(p => ({ ...p, category: e.target.value }))} className="mt-1" />
                </label>
                <label className="block font-medium text-sm text-zinc-700">Material
                  <Input placeholder="Material" value={editingProduct.material || ''} onChange={e => setEditingProduct(p => ({ ...p, material: e.target.value }))} className="mt-1" />
                </label>
                <label className="block font-medium text-sm text-zinc-700">Weight (g)
                  <Input placeholder="Weight" type="number" min={0} value={editingProduct.weight || ''} onChange={e => setEditingProduct(p => ({ ...p, weight: e.target.value }))} className="mt-1" />
                </label>
                <label className="block font-medium text-sm text-zinc-700">Dimensions
                  <Input placeholder="Dimensions (e.g. 10x10x10cm)" value={editingProduct.dimensions || ''} onChange={e => setEditingProduct(p => ({ ...p, dimensions: e.target.value }))} className="mt-1" />
                </label>
                <label className="block font-medium text-sm text-zinc-700">Short Description
                  <Input placeholder="Short description for listing" value={editingProduct.short_description || ''} onChange={e => setEditingProduct(p => ({ ...p, short_description: e.target.value }))} className="mt-1" />
                </label>
                <label className="block font-medium text-sm text-zinc-700">Difficulty
                  <Input placeholder="Difficulty (e.g. Beginner)" value={editingProduct.difficulty || ''} onChange={e => setEditingProduct(p => ({ ...p, difficulty: e.target.value }))} className="mt-1" />
                </label>
                <label className="block font-medium text-sm text-zinc-700">Includes (comma-separated)
                  <Input placeholder="e.g. Arduino UNO, USB cable, Sensors" value={Array.isArray(editingProduct.includes) ? editingProduct.includes.join(', ') : (editingProduct.includes || '')} onChange={e => setEditingProduct(p => ({ ...p, includes: e.target.value }))} className="mt-1" />
                </label>
                <label className="block font-medium text-sm text-zinc-700">Outcomes (comma-separated)
                  <Input placeholder="e.g. Build IoT projects, Learn sensors" value={Array.isArray(editingProduct.outcomes) ? editingProduct.outcomes.join(', ') : (editingProduct.outcomes || '')} onChange={e => setEditingProduct(p => ({ ...p, outcomes: e.target.value }))} className="mt-1" />
                </label>
                <label className="block font-medium text-sm text-zinc-700">Specifications
                  <textarea placeholder="Specifications or technical notes" value={editingProduct.specifications || ''} onChange={e => setEditingProduct(p => ({ ...p, specifications: e.target.value }))} className="mt-1 w-full border rounded p-2 text-sm" />
                </label>
                <label className="block font-medium text-sm text-zinc-700">Documentation URL
                  <Input placeholder="Documentation URL or notes" value={editingProduct.documentation || ''} onChange={e => setEditingProduct(p => ({ ...p, documentation: e.target.value }))} className="mt-1" />
                </label>
                <label className="block font-medium text-sm text-zinc-700">FAQ
                  <textarea placeholder="FAQ or common questions" value={editingProduct.faq || ''} onChange={e => setEditingProduct(p => ({ ...p, faq: e.target.value }))} className="mt-1 w-full border rounded p-2 text-sm" />
                </label>
              </div>
              <div className="space-y-4 flex flex-col justify-between">
                <div>
                  <label className="block font-medium text-sm text-zinc-700">Price
                    <Input placeholder="Price" type="number" min={0} value={editingProduct.price} onChange={e => setEditingProduct(p => ({ ...p, price: +e.target.value }))} required className="mt-1" />
                  </label>
                  <label className="block font-medium text-sm text-zinc-700">Original Price (MRP)
                    <Input placeholder="Original price / MRP" type="number" min={0} value={editingProduct.original_price || ''} onChange={e => setEditingProduct(p => ({ ...p, original_price: e.target.value }))} className="mt-1" />
                  </label>
                  <label className="block font-medium text-sm text-zinc-700">Stock
                    <Input placeholder="Stock" type="number" min={0} value={editingProduct.stock} onChange={e => setEditingProduct(p => ({ ...p, stock: +e.target.value }))} required className="mt-1" />
                  </label>
                  <label className="block font-medium text-sm text-zinc-700">Images
                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="mt-1" />
                    {/* Always show existing images if no new files are selected */}
                    {(!imageFiles.length && getImageArray(editingProduct.images).length > 0) && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getImageArray(editingProduct.images).map((img, idx) => {
                          if (!img) return null;
                          let src = img.startsWith('http') ? img : `https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/product-images/${img}`;
                          return (
                            <div key={idx} className="relative group">
                              <img src={src} alt="Product" className="w-16 h-16 object-cover rounded border" />
                              <button
                                type="button"
                                className="absolute top-1 right-1 bg-white/80 rounded-full p-1 shadow group-hover:opacity-100 opacity-70 transition"
                                title="Remove image"
                                onClick={() => {
                                  setEditingProduct(p => ({
                                    ...p,
                                    images: getImageArray(p.images).filter((_, i) => i !== idx)
                                  }));
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Show preview of new files if selected */}
                    {imageFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {imageFiles.map((file, idx) => (
                          <span key={idx} className="text-xs bg-zinc-100 px-2 py-1 rounded border border-zinc-200">{file.name}</span>
                        ))}
                      </div>
                    )}
                  </label>
                </div>
                <div className="flex flex-wrap gap-4 items-center mt-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editingProduct.visible} onChange={e => setEditingProduct(p => ({ ...p, visible: e.target.checked }))} /> Visible
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editingProduct.featured} onChange={e => setEditingProduct(p => ({ ...p, featured: e.target.checked }))} /> Featured
                  </label>
                  <Button type="submit" disabled={uploading}>{uploading ? 'Saving...' : 'Save Changes'}</Button>
                </div>
                {(successMsg || errorMsg) && (
                  <div className={`rounded p-3 text-sm font-medium ${successMsg ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'} mt-2`}>{successMsg || errorMsg}</div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManagementPage;
