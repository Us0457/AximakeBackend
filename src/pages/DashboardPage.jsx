import { supabase } from '../lib/supabaseClient';
    import { motion } from 'framer-motion';
    import { useAuth } from '../contexts/AuthContext';
    import { useEffect, useState } from 'react';
    import { Edit, Trash2 } from 'lucide-react';
    import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
    import { Input } from '@/components/ui/input';
    import { Button } from '@/components/ui/button';
    import { Card } from '@/components/ui/card';
    import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
    import { Checkbox } from '@/components/ui/checkbox';
    import ChangePassword from '@/components/ChangePassword';
    import { useNavigate } from 'react-router-dom';
    import { User, MapPin, FileText, Heart, CreditCard, ClipboardList } from 'lucide-react';

    const dashboardSections = [
      {
        key: 'personal',
        icon: <User className="h-8 w-8 text-primary" />,
        title: 'Personal Information',
        description: 'View and update your profile details, password, and avatar.',
        onClick: (navigate) => navigate('/dashboard/personal'),
      },
      {
        key: 'addresses',
        icon: <MapPin className="h-8 w-8 text-primary" />,
        title: 'Saved Addresses',
        description: 'Manage your shipping and billing addresses.',
        onClick: (navigate) => navigate('/dashboard/addresses'),
      },
      {
        key: 'quotes',
        icon: <FileText className="h-8 w-8 text-primary" />,
        title: 'Your Quotes',
        description: 'Track, view, and manage your 3D print quotes.',
        onClick: (navigate) => navigate('/dashboard/quotes'),
      },
      {
        key: 'wishlist',
        icon: <Heart className="h-8 w-8 text-primary" />,
        title: 'Wishlist',
        description: 'View and manage your favorite products.',
        onClick: (navigate) => navigate('/dashboard/wishlist'),
      },
      {
        key: 'payments',
        icon: <CreditCard className="h-8 w-8 text-primary" />,
        title: 'Payments & Cards',
        description: 'Manage your saved payment methods and view payment history.',
        onClick: (navigate) => navigate('/dashboard/payments'),
      },
      {
        key: 'orders',
        icon: <ClipboardList className="h-8 w-8 text-primary" />,
        title: 'Your Orders',
        description: 'View your order history and details.',
        onClick: (navigate) => navigate('/dashboard/orders'),
      },
    ];

    const DashboardPage = () => {
      const { user } = useAuth();
      const navigate = useNavigate();
        const [profileFirstName, setProfileFirstName] = useState('');
      const [quotes, setQuotes] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [editingProfile, setEditingProfile] = useState(false);
      const [profile, setProfile] = useState({
        name: '',
        email: user?.email || '',
        address: '',
        avatar_url: '',
      });
      const [profilePhotoFile, setProfilePhotoFile] = useState(null);
      const [profileLoading, setProfileLoading] = useState(false);
      const [selectedQuotes, setSelectedQuotes] = useState([]);

      useEffect(() => {
        if (!user) {
          setQuotes([]);
          setLoading(false);
          return;
        }
        // Fetch profile details (first_name, avatar_url) for dashboard
        const fetchProfile = async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('first_name,avatar_url')
            .eq('id', user.id)
            .maybeSingle();
          if (data) {
            setProfileFirstName(data.first_name || '');
            setProfile(prev => ({ ...prev, name: data.first_name || '', avatar_url: data.avatar_url || '' }));
          } else {
            setProfileFirstName('');
            setProfile(prev => ({ ...prev, name: '', avatar_url: '' }));
          }
        };
        fetchProfile();
        const fetchQuotes = async () => {
          setLoading(true);
          setError(null);
          const { data, error } = await supabase
            .from('quotes')
            .select('id, file_url, file_name, material, color, infill, price, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          if (error) {
            setError('Failed to fetch quotes.');
            setQuotes([]);
          } else {
            setQuotes(data || []);
          }
          setLoading(false);
        };
        fetchQuotes();
      }, [user]);

      const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this quote?')) return;
        const { error } = await supabase.from('quotes').delete().eq('id', id);
        if (error) {
          setError('Failed to delete quote.');
        } else {
          setQuotes((prev) => prev.filter((q) => q.id !== id));
        }
      };

      const handleProfileChange = (e) => {
        const { name, value } = e.target;
        setProfile((prev) => ({ ...prev, [name]: value }));
      };

      const handleProfilePhotoChange = (e) => {
        if (e.target.files && e.target.files[0]) {
          setProfilePhotoFile(e.target.files[0]);
        }
      };

      const handleProfileSave = async () => {
        setProfileLoading(true);
        let avatar_url = profile.avatar_url;
        if (profilePhotoFile) {
          const fileExt = profilePhotoFile.name.split('.').pop();
          const fileName = `${user.id}_${Date.now()}.${fileExt}`;
          const { data, error } = await supabase.storage.from('avatars').upload(fileName, profilePhotoFile, { upsert: true });
          if (!error) {
            const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(fileName);
            avatar_url = publicUrl.publicUrl;
          }
        }
        await supabase.auth.updateUser({
          data: {
            name: profile.name,
            address: profile.address,
            avatar_url,
          },
        });
        setProfile((prev) => ({ ...prev, avatar_url }));
        setEditingProfile(false);
        setProfileLoading(false);
      };

      const handleQuoteSelect = (id) => {
        setSelectedQuotes((prev) =>
          prev.includes(id) ? prev.filter((q) => q !== id) : [...prev, id]
        );
      };

      const handleAddToCart = async () => {
        if (!user) return;
        const newItems = quotes.filter((q) => selectedQuotes.includes(q.id));
        for (const quote of newItems) {
          // Check if already in cart
          const { data: existing } = await supabase
            .from('cart_items')
            .select('id')
            .eq('user_id', user.id)
            .eq('quote_id', quote.id);
          if (!existing || existing.length === 0) {
            await supabase.from('cart_items').insert({
              user_id: user.id,
              quote_id: quote.id,
              quantity: 1,
            });
          }
        }
        setSelectedQuotes([]);
        // Notify listeners so header/cart counter updates immediately
        window.dispatchEvent(new Event('cart-updated'));
      };

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="container mx-auto px-2 sm:px-4 lg:px-6 py-0 min-h-[calc(100vh-6rem)] flex flex-col items-center"
        >
          <style>
            @media (max-width: 520px) {'{'}
              .dashboard-grid {'{'}
                grid-template-columns: 1fr !important;
                gap: 1.25rem !important;
                max-width: 100vw !important;
                padding-left: 0.5rem !important;
                padding-right: 0.5rem !important;
              {'}'}
              .dashboard-addcart {'{'}
                display: none !important;
              {'}'}
              .dashboard-mobilebar {'{'}
                display: flex !important;
              {'}'}
            {'}'}
            @media (min-width: 521px) {'{'}
              .dashboard-mobilebar {'{'}
                display: none !important;
              {'}'}
            {'}'}
          </style>
          <h1 className="text-4xl font-bold mb-4 gradient-text text-center">User Dashboard</h1>
          <p className="text-lg text-muted-foreground mb-10 text-center max-w-2xl">
            Welcome, {profileFirstName || user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email || 'User'}! Manage your account, quotes, wishlist, and more from your personalized dashboard.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-5xl dashboard-grid">
            {dashboardSections.map(section => (
              <motion.div
                key={section.key}
                whileHover={{ y: -6, scale: 1.03, boxShadow: '0 8px 32px 0 rgba(0,0,0,0.12)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="bg-card/90 rounded-2xl shadow-lg border border-border/30 p-7 flex flex-col items-center cursor-pointer hover:border-primary/60 group transition-all duration-200"
                onClick={() => section.onClick(navigate)}
                tabIndex={0}
                role="button"
                aria-label={section.title}
              >
                <div className="mb-4 group-hover:scale-110 transition-transform duration-200">
                  {section.icon}
                </div>
                <h2 className="text-xl font-semibold mb-2 text-center group-hover:text-primary transition-colors duration-200">{section.title}</h2>
                <p className="text-sm text-muted-foreground text-center">{section.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      );
    };

    export default DashboardPage;