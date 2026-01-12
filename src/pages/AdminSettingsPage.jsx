import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminSettingsPage = () => {
  const [customPrintMaterials, setCustomPrintMaterials] = useState([]);
  const [savingMaterials, setSavingMaterials] = useState(false);
  const { toast } = useToast ? useToast() : { toast: () => {} };
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchMaterials() {
      const { data } = await supabase.from('settings').select('custom_print_materials').single();
      if (data && data.custom_print_materials) {
        setCustomPrintMaterials(data.custom_print_materials);
      } else {
        setCustomPrintMaterials([
          { name: 'PLA', color: '#8A2BE2', price: 5 },
          { name: 'PETG', color: '#00BFFF', price: 7 },
        ]);
      }
    }
    fetchMaterials();
  }, []);

  const handleMaterialChange = (idx, field, value) => {
    setCustomPrintMaterials((prev) => prev.map((mat, i) => i === idx ? { ...mat, [field]: value } : mat));
  };
  const handleAddMaterial = () => {
    setCustomPrintMaterials((prev) => [...prev, { name: '', color: '#000000', price: 1 }]);
  };
  const handleRemoveMaterial = (idx) => {
    setCustomPrintMaterials((prev) => prev.filter((_, i) => i !== idx));
  };
  const handleSaveMaterials = async () => {
    setSavingMaterials(true);
    await supabase.from('settings').upsert({ id: 1, custom_print_materials: customPrintMaterials }, { onConflict: 'id' });
    setSavingMaterials(false);
    toast({ title: 'Saved!', description: 'Custom print materials updated.' });
  };

  return (
    <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-8">
      <h1 className="text-3xl font-bold mb-6">Store Settings</h1>
      <h2 className="text-xl font-semibold mb-4">Custom Print Materials Configuration</h2>
      <div className="space-y-3 max-w-xl mx-auto">
        {customPrintMaterials.map((mat, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-1">
            <Input
              className="w-28"
              placeholder="Material Name"
              value={mat.name}
              onChange={e => handleMaterialChange(idx, 'name', e.target.value)}
            />
            <input
              type="color"
              className="w-8 h-8 border rounded"
              value={mat.color}
              onChange={e => handleMaterialChange(idx, 'color', e.target.value)}
              title="Pick color"
            />
            <Input
              className="w-20"
              type="number"
              min="0"
              step="0.01"
              placeholder="Unit Price"
              value={mat.price}
              onChange={e => handleMaterialChange(idx, 'price', e.target.value)}
            />
            <Button type="button" size="icon" variant="ghost" onClick={() => handleRemoveMaterial(idx)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <Button type="button" size="sm" variant="outline" onClick={handleAddMaterial}>Add Material</Button>
          <Button type="button" size="sm" onClick={handleSaveMaterials} disabled={savingMaterials}>{savingMaterials ? 'Saving...' : 'Save'}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
