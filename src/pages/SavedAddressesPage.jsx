import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const SavedAddressesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    flat_no: '',
    area: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    if (!user) return;
    const fetchAddresses = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id);
      if (!error) setAddresses(data);
      setLoading(false);
    };
    fetchAddresses();
  }, [user]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.flat_no || !form.area || !form.city || !form.state || !form.pincode || !form.phone) {
      toast({ title: 'Error', description: 'Please fill in all fields.', variant: 'destructive' });
      return;
    }
    let result;
    if (editingId) {
      result = await supabase
        .from('addresses')
        .update({ ...form })
        .eq('id', editingId)
        .eq('user_id', user.id);
    } else {
      result = await supabase
        .from('addresses')
        .insert([{ ...form, user_id: user.id }]);
    }
    if (!result.error) {
      toast({ title: 'Success', description: 'Address saved.' });
      setForm({ name: '', flat_no: '', area: '', city: '', state: '', pincode: '', phone: '' });
      setEditingId(null);
      setShowForm(false);
      // Refresh list
      const { data } = await supabase.from('addresses').select('*').eq('user_id', user.id);
      setAddresses(data);
    } else {
      toast({ title: 'Error', description: result.error.message, variant: 'destructive' });
    }
  };

  const handleEdit = (address) => {
    setForm(address);
    setEditingId(address.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('addresses').delete().eq('id', id).eq('user_id', user.id);
    if (!error) {
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      toast({ title: 'Deleted', description: 'Address removed.' });
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Card className="max-w-2xl mx-auto mt-8 w-full">
      <CardHeader>
        <div className="flex flex-col items-center mb-2">
          <CardTitle className="text-lg font-bold"><MapPin className="inline-block mr-2 text-primary" />Saved Addresses</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="text-[0.97rem]">
        <div>
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : addresses.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No addresses saved yet. Add a new address to get started.</div>
          ) : (
            <div className="space-y-4">
              {addresses.map(addr => (
                <div key={addr.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-background/80">
                  <div>
                    <div className="font-semibold">{addr.name ? `${addr.name}, ` : ''}{addr.flat_no}, {addr.area}</div>
                    <div className="text-xs text-muted-foreground">{addr.city}, {addr.state} - {addr.pincode}</div>
                    <div className="text-xs text-muted-foreground">Phone: {addr.phone}</div>
                  </div>
                  <div className="flex gap-2 mt-2 md:mt-0">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(addr)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(addr.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Add Address Button */}
        {!showForm && (
          <div className="flex justify-end mt-6">
            <Button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', flat_no: '', area: '', city: '', state: '', pincode: '', phone: '', email: '' }); }}>Add Address</Button>
          </div>
        )}
        {/* Address Form */}
        {showForm && (
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 mb-6 bg-background/70 p-4 rounded-lg border">
            <div>
              <Label htmlFor="name">Recipient Name</Label>
              <Input id="name" name="name" value={form.name} onChange={handleFormChange} required />
            </div>
            <div>
              <Label htmlFor="flat_no">Flat / House No.</Label>
              <Input id="flat_no" name="flat_no" value={form.flat_no} onChange={handleFormChange} required />
            </div>
            <div>
              <Label htmlFor="area">Area / Locality</Label>
              <Input id="area" name="area" value={form.area} onChange={handleFormChange} required />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" value={form.city} onChange={handleFormChange} required />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" value={form.state} onChange={handleFormChange} required />
            </div>
            <div>
              <Label htmlFor="pincode">Pincode</Label>
              <Input id="pincode" name="pincode" value={form.pincode} onChange={handleFormChange} required />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" value={form.phone} onChange={handleFormChange} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" value={form.email} onChange={handleFormChange} required />
            </div>
            <div className="col-span-full flex gap-2 justify-end mt-2">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setForm({ name: '', flat_no: '', area: '', city: '', state: '', pincode: '', phone: '', email: '' }); }}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default SavedAddressesPage;
