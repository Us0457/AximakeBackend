import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Camera } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabaseClient';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const PersonalInfoPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    dob: '',
    gender: '',
    avatar_url: '',
    phone: '',
    email: '',
  });
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Fetch profile from Supabase on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      // Use .maybeSingle() and handle null result to avoid 406/PGRST116 errors
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (data) {
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          dob: data.dob || '',
          gender: data.gender || '',
          avatar_url: data.avatar_url || '',
          phone: data.phone || '',
          email: data.email || user.email || '',
        });
      } else if (error) {
        toast({ title: 'Profile Error', description: error.message, variant: 'destructive' });
      } else {
        // No profile found, optionally handle as needed
        setProfile({
          first_name: '',
          last_name: '',
          dob: '',
          gender: '',
          avatar_url: '',
          phone: '',
          email: user.email || '',
        });
      }
    };
    fetchProfile();
  }, [user]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfilePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePhotoFile(e.target.files[0]);
      setProfile((prev) => ({ ...prev, avatar_url: URL.createObjectURL(e.target.files[0]) }));
    }
  };

  const handleDateChange = (date) => {
    setProfile((prev) => ({ ...prev, dob: date ? date.toISOString().slice(0, 10) : '' }));
  };

  const handleProfileSave = async () => {
    setProfileLoading(true);
    let avatar_url = profile.avatar_url;
    try {
      if (profilePhotoFile) {
        const fileExt = profilePhotoFile.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('avatars').upload(fileName, profilePhotoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(fileName);
        avatar_url = publicUrl.publicUrl;
      }
      const { error: updateError } = await supabase.from('profiles').update({
        first_name: profile.first_name,
        last_name: profile.last_name,
        dob: profile.dob,
        gender: profile.gender,
        avatar_url,
        phone: profile.phone,
      }).eq('id', user.id);
      if (updateError) throw updateError;
      setProfile((prev) => ({ ...prev, avatar_url }));
      setEditing(false);
      toast({ title: 'Profile updated!' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto my-12 w-full">
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form className="space-y-6">
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="relative inline-flex">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatar_url} alt={profile.first_name || profile.email} />
                <AvatarFallback>{profile.first_name ? profile.first_name[0] : profile.email[0]}</AvatarFallback>
              </Avatar>
              {editing && (
                <label className="absolute -bottom-0.5 -right-0.5 bg-primary rounded-full p-2 cursor-pointer shadow-md hover:bg-accent transition-colors">
                  <Camera className="h-4 w-4 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoChange} />
                </label>
              )}
            </div>
            <span className="text-xl font-semibold text-slate-900">{profile.first_name || `${profile.email?.split('@')?.[0] || ''}`}</span>
            <span className="text-xs text-muted-foreground">Profile Picture</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name">First Name</Label>
              <Input id="first_name" name="first_name" type="text" value={profile.first_name} onChange={handleProfileChange} disabled={!editing} required className="h-12 rounded-md text-sm" />
            </div>
            <div>
              <Label htmlFor="last_name">Last Name</Label>
              <Input id="last_name" name="last_name" type="text" value={profile.last_name} onChange={handleProfileChange} disabled={!editing} required className="h-12 rounded-md text-sm" />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" value={profile.phone} onChange={handleProfileChange} disabled={!editing} required className="h-12 rounded-md text-sm" />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" value={profile.email} disabled className="h-12 rounded-md text-sm" />
            </div>

            <div>
              <Label htmlFor="dob">Date of Birth</Label>
              <DatePicker
                id="dob"
                selected={profile.dob ? new Date(profile.dob) : null}
                onChange={handleDateChange}
                dateFormat="yyyy-MM-dd"
                className="h-12 rounded-md text-sm w-full px-3 py-2 border"
                disabled={!editing}
                placeholderText="Select date"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Format: YYYY-MM-DD</p>
            </div>

            <div>
              <Label htmlFor="gender">Gender</Label>
              <select id="gender" name="gender" value={profile.gender} onChange={handleProfileChange} disabled={!editing} required className="h-12 rounded-md text-sm w-full px-3 border">
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">Choose your gender.</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            {editing ? (
              <>
                <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={profileLoading}>Cancel</Button>
                <Button type="button" onClick={handleProfileSave} disabled={profileLoading}>{profileLoading ? 'Saving...' : 'Save'}</Button>
              </>
            ) : (
              <Button type="button" onClick={() => setEditing(true)}>Edit</Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default PersonalInfoPage;
