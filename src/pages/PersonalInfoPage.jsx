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
    <Card className="max-w-xl mx-auto mt-8 w-full">
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6">
          <div className="flex flex-col items-center gap-2 mb-4">
            <div className="relative group flex flex-col items-center">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.avatar_url} alt={profile.first_name || profile.email} />
                <AvatarFallback>{profile.first_name ? profile.first_name[0] : profile.email[0]}</AvatarFallback>
              </Avatar>
              <span className="mt-2 text-lg font-semibold text-primary">{profile.first_name}</span>
              {editing && (
                <label className="absolute bottom-0 right-0 bg-primary rounded-full p-1 cursor-pointer shadow-lg hover:bg-accent transition-colors">
                  <Camera className="h-5 w-5 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoChange} />
                </label>
              )}
            </div>
            <span className="text-xs text-muted-foreground">Profile Picture</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Input id="first_name" name="first_name" type="text" value={profile.first_name} onChange={handleProfileChange} disabled={!editing} required className="peer bg-background/70 pt-6" placeholder=" " />
              <Label htmlFor="first_name" className="absolute left-3 top-1.5 text-muted-foreground text-xs transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-1.5 peer-focus:text-xs bg-background px-1 pointer-events-none">First Name</Label>
            </div>
            <div className="relative">
              <Input id="last_name" name="last_name" type="text" value={profile.last_name} onChange={handleProfileChange} disabled={!editing} required className="peer bg-background/70 pt-6" placeholder=" " />
              <Label htmlFor="last_name" className="absolute left-3 top-1.5 text-muted-foreground text-xs transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-1.5 peer-focus:text-xs bg-background px-1 pointer-events-none">Last Name</Label>
            </div>
            <div className="relative col-span-1 md:col-span-2">
              <Input id="phone" name="phone" type="tel" value={profile.phone} onChange={handleProfileChange} disabled={!editing} required className="peer bg-background/70 pt-6" placeholder=" " />
              <Label htmlFor="phone" className="absolute left-3 top-1.5 text-muted-foreground text-xs transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-1.5 peer-focus:text-xs bg-background px-1 pointer-events-none">Phone</Label>
            </div>
            <div className="relative col-span-1 md:col-span-2">
              <Input id="email" name="email" type="email" value={profile.email} disabled className="peer bg-background/70 pt-6" placeholder=" " />
              <Label htmlFor="email" className="absolute left-3 top-1.5 text-muted-foreground text-xs transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-1.5 peer-focus:text-xs bg-background px-1 pointer-events-none">Email</Label>
            </div>
            <div className="relative col-span-1 md:col-span-2">
              <DatePicker
                id="dob"
                selected={profile.dob ? new Date(profile.dob) : null}
                onChange={handleDateChange}
                dateFormat="yyyy-MM-dd"
                className="peer bg-background/70 pt-6 w-full rounded-md border px-3 py-2"
                disabled={!editing}
                placeholderText="Select date"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                required
              />
              <Label htmlFor="dob" className="absolute left-3 top-1.5 text-muted-foreground text-xs transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-1.5 peer-focus:text-xs bg-background px-1 pointer-events-none">Date of Birth</Label>
              <span className="helper-text text-xs text-muted-foreground">Format: YYYY-MM-DD</span>
            </div>
            <div className="relative col-span-1 md:col-span-2">
              <select id="gender" name="gender" value={profile.gender} onChange={handleProfileChange} disabled={!editing} required className="peer bg-background/70 w-full rounded-md border px-3 py-6 pt-6">
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <Label htmlFor="gender" className="absolute left-3 top-1.5 text-muted-foreground text-xs transition-all peer-focus:top-1.5 peer-focus:text-xs bg-background px-1 pointer-events-none">Gender</Label>
              <span className="helper-text text-xs text-muted-foreground">Choose your gender.</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
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
