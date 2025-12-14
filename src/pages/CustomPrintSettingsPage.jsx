import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Trash2 } from 'lucide-react';
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

  return (
    <div className="container mx-auto px-4 py-8">
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
    </div>
  );
};

export default CustomPrintSettingsPage;
