import React, { useState, useEffect, useRef } from 'react';
    import { Link, useNavigate } from 'react-router-dom';
    import { Printer, User, LogOut, ShoppingCart, Search } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { motion, AnimatePresence } from 'framer-motion';
    import { useAuth } from '@/contexts/AuthContext';
    import { useToast } from '@/components/ui/use-toast';
    import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
    import { supabase } from '@/lib/supabaseClient';
    import { UserCircleIcon } from '@heroicons/react/24/solid';
    import Navbar from './Navbar'; // Import the Navbar component
    import logo from '@/assets/Axi.ico';
    import {
      DropdownMenu,
      DropdownMenuTrigger,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuCheckboxItem,
      DropdownMenuRadioItem,
      DropdownMenuLabel,
      DropdownMenuSeparator,
      DropdownMenuShortcut,
      DropdownMenuGroup,
      DropdownMenuPortal,
      DropdownMenuSub,
      DropdownMenuSubContent,
      DropdownMenuSubTrigger,
      DropdownMenuRadioGroup,
    } from '@/components/ui/dropdown-menu';
    import { MapPin, FileText, ClipboardList, Heart, CreditCard, Settings2 } from 'lucide-react';

    const Header = () => {
      const [isScrolled, setIsScrolled] = useState(false);
      const auth = useAuth() || {};
      const { user, logout } = auth;
      const [cartCount, setCartCount] = useState(0);
      const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
      const [profileFirstName, setProfileFirstName] = useState('');
      const [profileRole, setProfileRole] = useState(null);
      const [avatarSrc, setAvatarSrc] = useState('');
      const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
      const [mobileAllOpen, setMobileAllOpen] = useState(false);
      const [isAllProductsOpen, setIsAllProductsOpen] = useState(false);
      const allMenuRef = useRef(null);
      const allCloseTimeoutRef = useRef(null);
      // Gradient & accent styles for All Products button
      const defaultGradient = 'linear-gradient(90deg, #031428 0%, #254f6b 100%)';
      const hoverGradient = 'linear-gradient(90deg, #0b2a47 0%, #2a6580 100%)';
      const mobileSubtle = 'linear-gradient(90deg, rgba(11,42,71,0.06) 0%, rgba(47,182,172,0.03) 100%)';
      const accentColor = '#2fb6ac';
      const allBtnBase = 'px-3 py-2 rounded-md text-sm font-semibold text-white transition duration-200 ease-in-out';
      const [search, setSearch] = useState('');
      const [suggestions, setSuggestions] = useState([]);
      const [showSuggestions, setShowSuggestions] = useState(false);
      const [allProducts, setAllProducts] = useState([]);
      const [allCategories, setAllCategories] = useState([]); // Add this state for categories
      const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
      const [animatedIndex, setAnimatedIndex] = useState(0);
      const [showAnimated, setShowAnimated] = useState(true);
      const [activeNavMobile, setActiveNavMobile] = useState('Home');
      const mobileMenuRef = useRef(null);
      const searchInputRef = useRef(null);
      const animatedIntervalRef = useRef();
      const dropdownMenuRef = useRef(null);
      const navigate = useNavigate();
      const { toast } = useToast();

      // Define your mobile nav items (customize as needed)
      const navItemsForMobile = [
        { name: 'Home', path: '/', type: 'route' },
        { name: 'Services', path: '#fdm-section', type: 'scroll', targetId: 'fdm-section' },
        { name: 'Testimonials', path: '#testimonials-section', type: 'scroll', targetId: 'testimonials-section' },
        { name: 'About Us', path: '#about-us-section', type: 'scroll', targetId: 'about-us-section' },
        { name: 'FAQs', path: '#faqs-section', type: 'scroll', targetId: 'faqs-section' },
        { name: 'Contact', path: '#contact-section', type: 'scroll', targetId: 'contact-section' },
        // Add more as needed
      ];

      // Category suggestions for animated placeholder
      const categorySuggestions = [
        'Search Electronics',
        'Search Home & Decor',
        'Search Fashion',
        'Search Sports & Outdoors',
        'Search Beauty & Health',
        'Search Automotive',
        'Search Books',
        'Search Toys & Games',
        'Search Office Supplies',
        'Search Pet Supplies',
      ];

      useEffect(() => {
        const handleScroll = () => {
          setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
      }, []);

      useEffect(() => {
        if (!user) return;
        const fetchCartCount = async () => {
          const { data, error } = await supabase
            .from('cart_items')
            .select('quantity')
            .eq('user_id', user.id);
          if (!error && Array.isArray(data)) {
            const sum = data.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
            setCartCount(sum);
          }
        };
        fetchCartCount();
        // Listen for cart changes in this tab
        const updateCartCount = async () => {
          const { data, error } = await supabase
            .from('cart_items')
            .select('quantity')
            .eq('user_id', user.id);
          if (!error && Array.isArray(data)) {
            const sum = data.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
            setCartCount(sum);
          }
        };
        window.addEventListener('cart-updated', updateCartCount);
        return () => {
          window.removeEventListener('cart-updated', updateCartCount);
        };
      }, [user]);

      // Use profile/profileReady from AuthContext for current user's avatar and name
      const { profile: authProfile, profileReady } = auth;
      useEffect(() => {
        if (profileReady && authProfile) {
          setProfileAvatarUrl(authProfile.avatar_url || '');
          setAvatarSrc(authProfile.avatar_url || '');
          setProfileFirstName(authProfile.first_name || '');
        } else {
          setProfileAvatarUrl('');
          setAvatarSrc('');
          setProfileFirstName('');
        }
      }, [authProfile, profileReady]);

      // Keep avatarSrc in sync with profileAvatarUrl. Do NOT fallback to provider metadata
      // to avoid hotlinking external avatar URLs that may be rate-limited.
      useEffect(() => {
        if (profileAvatarUrl) setAvatarSrc(profileAvatarUrl);
        else setAvatarSrc('');
      }, [profileAvatarUrl]);

      // If an image fails to load (rate limit or hotlink), retry once via a proxy
      function handleAvatarImgError(e) {
        try {
          const img = e?.target;
          if (!img) return;
          const already = img.dataset?.proxied === '1';
          const current = img.src || avatarSrc || '';
          if (!already && current) {
            const prox = `https://images.weserv.nl/?url=${encodeURIComponent(current)}`;
            img.dataset.proxied = '1';
            setAvatarSrc(prox);
            img.src = prox;
            return;
          }
        } catch (err) { /* ignore */ }
        // final fallback: clear avatarSrc so AvatarFallback shows
        setAvatarSrc('');
      }

      // Fetch all products for autocomplete (assume supabase 'products' table with 'name')
      useEffect(() => {
        async function fetchProducts() {
          const { data, error } = await supabase.from('products').select('name');
          if (data) setAllProducts(data.map(p => p.name));
        }
        fetchProducts();
      }, []);

      // Add this effect to fetch all categories for search matching
      useEffect(() => {
        async function fetchCategories() {
          const { data } = await supabase.from('products').select('category');
          if (data) {
            const cats = Array.from(new Set(data.map(p => p.category).filter(Boolean)));
            setAllCategories(cats);
          }
        }
        fetchCategories();
      }, []);

      // Filter suggestions
      useEffect(() => {
        if (search.trim() === '') {
          setSuggestions([]);
          return;
        }
        const productMatches = allProducts.filter(name =>
          name.toLowerCase().includes(search.toLowerCase())
        );
        const categoryMatches = allCategories.filter(cat =>
          cat && cat.toLowerCase().includes(search.toLowerCase())
        );
        // Mark category suggestions for display
        const categorySuggestions = categoryMatches.map(cat => ({ label: cat, type: 'category' }));
        const productSuggestions = productMatches.slice(0, 5).map(name => ({ label: name, type: 'product' }));
        setSuggestions([...categorySuggestions, ...productSuggestions]);
      }, [search, allProducts, allCategories]);

      // Fetch user role
      useEffect(() => {
        if (!user) {
          setProfileRole(null);
          return;
        }
        const fetchRole = async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();
          if (!error && data && data.role) setProfileRole(data.role);
          else setProfileRole(null);
        };
        fetchRole();
      }, [user]);

      const handleLogout = async () => {
        try {
          await logout();
          toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
          navigate('/');
        } catch (error) {
          toast({ title: 'Logout Failed', description: error.message, variant: 'destructive' });
        }
      };

      const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);

      const handleMobileNavClick = (item) => {
        setIsMobileMenuOpen(false);
        setActiveNavMobile(item.name);
        if (item.type === 'scroll') {
          const sectionId = item.targetId;
          if (window.location.pathname === '/') {
            setTimeout(() => {
              const el = document.getElementById(sectionId);
              if (el) {
                const header = document.querySelector('header');
                const yOffset = header ? -header.offsetHeight : -72;
                const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                window.scrollTo({ top: y, behavior: 'smooth' });
              }
            }, 100);
          } else {
            navigate('/', { state: { scrollTo: sectionId } });
          }
        } else if (item.name === 'Home') {
          if (window.location.pathname === '/') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            navigate('/');
          }
        } else {
          navigate(item.path);
        }
      };

      // Handle search submit
      const handleSearch = (query) => {
        setShowSuggestions(false);
        setMobileSearchOpen(false);
        setSearch('');
        // Partial match for category
        const matchedCategory = allCategories.find(cat => cat && cat.toLowerCase().includes(query.toLowerCase()));
        if (matchedCategory) {
          navigate(`/products?category=${encodeURIComponent(matchedCategory)}`);
        } else {
          navigate(`/products?search=${encodeURIComponent(query)}`);
        }
      };

      // Handle Enter key
      const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter' && search.trim()) {
          handleSearch(search.trim());
        }
        if (e.key === 'Escape') {
          setShowSuggestions(false);
          setMobileSearchOpen(false);
        }
      };

      // Focus input when mobile search opens
      useEffect(() => {
        if (mobileSearchOpen && searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, [mobileSearchOpen]);

      // Close mobile menu when clicking outside or on scroll
      useEffect(() => {
        if (!isMobileMenuOpen) return;
        function handleClickOutside(event) {
          if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
            setIsMobileMenuOpen(false);
          }
        }
        function handleScroll() {
          setIsMobileMenuOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
          window.removeEventListener('scroll', handleScroll);
        };
      }, [isMobileMenuOpen]);

      // Animate placeholder cycling
      useEffect(() => {
        if (search) return; // Don't animate if user is typing
        setShowAnimated(true);
        animatedIntervalRef.current = setInterval(() => {
          setAnimatedIndex((prev) => (prev + 1) % categorySuggestions.length);
        }, 2000);
        return () => clearInterval(animatedIntervalRef.current);
      }, [search]);

      // Hide animated placeholder when input is focused/typed
      const handleInputFocus = () => setShowAnimated(false);
      const handleInputBlur = () => {
        if (!search) setShowAnimated(true);
      };

      // DropdownMenu close on scroll
      const [isDropdownOpen, setIsDropdownOpen] = useState(false);

      // Close dropdown on scroll or outside click (robust for all scroll containers)
      useEffect(() => {
        if (!isDropdownOpen) return;
        function handleClickOutside(event) {
          if (dropdownMenuRef.current && !dropdownMenuRef.current.contains(event.target)) {
            setIsDropdownOpen(false);
          }
        }
        function handleAnyScroll() {
          setIsDropdownOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleAnyScroll, { passive: true });
        document.addEventListener('scroll', handleAnyScroll, true); // true = capture phase, catches scroll on any element
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
          window.removeEventListener('scroll', handleAnyScroll, { passive: true });
          document.removeEventListener('scroll', handleAnyScroll, true);
        };
      }, [isDropdownOpen]);

      // Add a ref for the mobile search container
      const mobileSearchContainerRef = useRef(null);

      // Close mobile search on outside click, scroll, or when search is empty and not focused
      useEffect(() => {
        if (!mobileSearchOpen) return;
        function handleClickOutside(event) {
          // Only close if click is outside the overlay (not on the overlay background itself)
          if (
            mobileSearchContainerRef.current &&
            !mobileSearchContainerRef.current.contains(event.target) &&
            event.target.closest('.fixed.inset-0.z-50') // Only if click is on the overlay background
          ) {
            setMobileSearchOpen(false);
            setShowSuggestions(false);
            setSearch('');
          }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
      }, [mobileSearchOpen]);

      // Robust mobile search overlay close logic
      useEffect(() => {
        if (!mobileSearchOpen) return;
        function handleClickOutside(event) {
          // If click is outside the white search box, close overlay
          if (
            mobileSearchContainerRef.current &&
            !mobileSearchContainerRef.current.querySelector('.bg-white').contains(event.target)
          ) {
            setMobileSearchOpen(false);
            setShowSuggestions(false);
            setSearch('');
          }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
      }, [mobileSearchOpen]);

      // Remove scroll-to-top on mobile search open
      const handleMobileSearchOpen = (e) => {
        // Debug: log invocation so we can verify clicks reach this handler in tablet tests
        try {
          // eslint-disable-next-line no-console
          console.debug('handleMobileSearchOpen called', { type: e?.type, innerWidth: typeof window !== 'undefined' ? window.innerWidth : null });
        } catch (err) {}
        // Accept optional event; keep behavior identical to mobile button.
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        // Prevent scroll-to-top hack: do not focus or open overlay if a scroll is in progress
        setMobileSearchOpen(true);
        setTimeout(() => {
          if (searchInputRef.current) searchInputRef.current.focus();
        }, 100);
      };

      // Prevent background scroll when mobile search is open
      useEffect(() => {
        if (mobileSearchOpen) {
          document.body.style.overflow = 'hidden';
        } else {
          document.body.style.overflow = '';
        }
        return () => {
          document.body.style.overflow = '';
        };
      }, [mobileSearchOpen]);

      return (
        <motion.header 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`sticky top-0 z-50 w-full border-b border-border/40  ${isScrolled ? 'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg' : 'bg-transparent' } transition-all duration-300`}
        >
          <div className="container mx-auto flex h-20 items-center justify-between px-2 sm:px-4 lg:px-0 relative">
            {/* Brand/Logo section */}
            <button
              className="flex items-center focus:outline-none"
              onClick={e => {
                e.preventDefault();
                if (window.location.pathname === '/') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  navigate('/');
                }
              }}
              aria-label="Go to homepage"
              style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }}
            >
              {/* Use uploaded BrandLogo.png from public/assets. */}
              {/* Sizing controlled via responsive max-height classes so navbar height is preserved. */}
              <img src="/assets/BrandLogo.png" alt="Aximake" className="h-10 md:h-11 lg:h-12 w-auto object-contain" />
              {/* Keep accessible name for screen readers without adding visual text that could change layout */}
              <span className="sr-only">Aximake</span>
            </button>
            <div className="flex-1 flex items-center w-full min-w-0">
              {/* LEFT: All Products + small buffer */}
              <div className="flex items-center gap-6 flex-none">
                <div className="hidden md:block relative ml-6 mr-6" ref={allMenuRef} onMouseEnter={() => { if (allCloseTimeoutRef.current) { clearTimeout(allCloseTimeoutRef.current); allCloseTimeoutRef.current = null; } setIsAllProductsOpen(true); }} onMouseLeave={() => { if (allCloseTimeoutRef.current) clearTimeout(allCloseTimeoutRef.current); allCloseTimeoutRef.current = setTimeout(() => { setIsAllProductsOpen(false); allCloseTimeoutRef.current = null; }, 150); }}>
                  <DropdownMenu open={isAllProductsOpen} onOpenChange={setIsAllProductsOpen}>
                    <DropdownMenuTrigger asChild>
                      <button className={`${allBtnBase}`} aria-label="All Products" style={{ background: isAllProductsOpen ? hoverGradient : defaultGradient, boxShadow: isAllProductsOpen ? `0 6px 18px rgba(43,100,120,0.12), 0 0 0 4px ${accentColor}22` : undefined, border: isAllProductsOpen ? `1px solid ${accentColor}33` : '1px solid transparent' }}>All Products</button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64 p-2 z-50" style={{ pointerEvents: 'auto' }}>
                      <DropdownMenuItem asChild>
                        <Link to="/products" className="block px-2 py-1 rounded hover:bg-primary/5">All Products</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <div className="grid grid-cols-1 gap-1 max-h-64 overflow-auto">
                        {allCategories.map(cat => (
                          <DropdownMenuItem key={cat} asChild>
                            <Link to={`/products?category=${encodeURIComponent(cat)}`} className="block px-2 py-1 rounded hover:bg-primary/5">{cat}</Link>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* CENTER: Navbar - centered, no wrap */}
              <div className="flex-1 flex justify-start min-w-0 px-4">
                <div className="hidden md:flex items-center whitespace-nowrap overflow-hidden min-w-0">
                  <Navbar />
                </div>
              </div>

              {/* RIGHT (within header): Search - placed near actions cluster */}
              {/* Full search input only shown on xl and up; on md/lg we show icon near avatar */}
              <div className="flex-none ml-4 hidden xl:flex items-center">
                {/* Desktop search - render nothing at all if mobile search is open */}
                {!mobileSearchOpen && (
                  <div className="relative w-[16rem] max-w-[20rem]">
                    <input
                      type="text"
                      className="w-full rounded border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition-all placeholder:opacity-0"
                      placeholder={showAnimated ? categorySuggestions[animatedIndex] : ''}
                      value={search}
                      onChange={e => { setSearch(e.target.value); setShowSuggestions(true); setShowAnimated(false); }}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      onKeyDown={handleSearchKeyDown}
                      aria-label="Search products"
                      style={{ position: 'relative', zIndex: 2, background: 'transparent' }}
                    />
                    {showAnimated && !search && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none select-none transition-all animate-slide-up-text" style={{ zIndex: 1 }} aria-hidden="true">{categorySuggestions[animatedIndex]}</span>
                    )}
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 text-primary" onClick={() => search.trim() && handleSearch(search.trim())} tabIndex={-1} aria-label="Submit search"><Search className="h-5 w-5" /></button>
                    {showSuggestions && suggestions.length > 0 && window.innerWidth >= 768 && (
                      <ul className="absolute left-0 right-0 top-full bg-background border border-border rounded shadow z-30 mt-1">
                        {suggestions.map(s => (
                          <li key={s.label + s.type} className={`px-3 py-2 cursor-pointer hover:bg-primary/10 flex items-center gap-2 ${s.type === 'category' ? 'font-semibold text-indigo-700' : ''}`} onMouseDown={() => handleSearch(s.label)}>
                            {s.type === 'category' && <span className="inline-block w-2 h-2 rounded-full bg-indigo-400" />}
                            {s.label}
                            {s.type === 'category' && <span className="ml-1 text-xs text-indigo-400">(Category)</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              {/* Mobile search stays separately (rightmost) */}
              <div className="flex md:hidden items-center w-full justify-end pr-2">
                {!mobileSearchOpen && (
                  <button type="button" className="p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary ml-auto" aria-label="Open search" onClick={handleMobileSearchOpen}><Search className="h-6 w-6 text-primary" /></button>
                )}
              </div>
            </div>
            {/* Actions section */}
            <div className="flex items-center space-x-2 sm:space-x-3 ml-6">
              {/* Removed 'Get a Quote' primary action per design spec */}
              {user ? (
                <div className="flex items-center gap-2">
                  {/* Search icon for tablet and smaller-desktop (md/lg). Full bar appears on xl+. */}
                  <button
                    type="button"
                    className="hidden md:inline-flex xl:hidden ml-2 mr-2 z-50 relative p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary pointer-events-auto"
                    onClick={handleMobileSearchOpen}
                    onMouseDown={(e) => { if (e && typeof e.preventDefault === 'function') e.preventDefault(); handleMobileSearchOpen(e); }}
                    aria-label="Open search"
                  >
                    <Search className="h-5 w-5 text-primary" />
                  </button>
                  <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full">
                        <Avatar>
                          <AvatarImage src={avatarSrc || undefined} onError={handleAvatarImgError} alt={profileFirstName || user?.user_metadata?.name || user?.email} className="object-cover object-center" />
                          <AvatarFallback>
                            {profileFirstName?.[0] || user?.user_metadata?.name?.[0] || user?.email?.[0] || <UserCircleIcon className="h-6 w-6 text-muted-foreground" />}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent ref={dropdownMenuRef} align="end" className="w-56 z-50">
                      <DropdownMenuLabel className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={avatarSrc || undefined} onError={handleAvatarImgError} alt={profileFirstName || user?.user_metadata?.name || user?.email} className="object-cover object-center" />
                          <AvatarFallback>
                            {profileFirstName?.[0] || user?.user_metadata?.name?.[0] || user?.email?.[0] || <UserCircleIcon className="h-6 w-6 text-muted-foreground" />}
                          </AvatarFallback>
                        </Avatar>
                        <span>{profileFirstName || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'}</span>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                        <User className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                      </DropdownMenuItem>
                      {user && (
                        <DropdownMenuItem asChild>
                          <Link to="/dashboard/personal">
                            <UserCircleIcon className="mr-2 h-4 w-4" />
                            <span>Personal Information</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {user && (
                        <DropdownMenuItem asChild>
                          <Link to="/dashboard/addresses">
                            <MapPin className="mr-2 h-4 w-4" />
                            <span>Saved Address</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {user && (
                        <DropdownMenuItem asChild>
                          <Link to="/dashboard/quotes">
                            <FileText className="mr-2 h-4 w-4" />
                            <span>Your Quotes</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {user && (
                        <DropdownMenuItem asChild>
                          <Link to="/dashboard/orders">
                            <ClipboardList className="mr-2 h-4 w-4" />
                            <span>Your Orders</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {user && (
                        <DropdownMenuItem asChild>
                          <Link to="/dashboard/wishlist">
                            <Heart className="mr-2 h-4 w-4" />
                            <span>Wishlist</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {user && (
                        <DropdownMenuItem asChild>
                          <Link to="/dashboard/payments">
                            <CreditCard className="mr-2 h-4 w-4" />
                            <span>Payment & Cards</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {user && profileRole && profileRole.trim().toLowerCase() === 'admin' && (
                        <DropdownMenuItem onClick={() => navigate('/admin')}>
                          <Settings2 className="mr-2 h-4 w-4" />
                          <span>Admin Dashboard</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="icon" onClick={() => navigate('/cart')} aria-label="Cart" className="relative">
                    <ShoppingCart className="h-6 w-6 text-primary hover:text-white transition-colors" />
                    {cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center font-bold border border-white">
                        {cartCount}
                      </span>
                    )}
                  </Button>
                </div>
              ) : (
                <>
                  <Button variant="outline" asChild className="hidden md:inline-flex">
                    <Link to="/auth?mode=login">Login</Link>
                  </Button>
                  {/* Show search icon for logged-out users on md/lg as well */}
                  <button
                    type="button"
                    className="hidden md:inline-flex xl:hidden ml-2 mr-2 z-50 relative p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary pointer-events-auto"
                    onClick={handleMobileSearchOpen}
                    onMouseDown={(e) => { if (e && typeof e.preventDefault === 'function') e.preventDefault(); handleMobileSearchOpen(e); }}
                    aria-label="Open search"
                  >
                    <Search className="h-5 w-5 text-primary" />
                  </button>
                  <Button variant="ghost" size="icon" asChild className="md:hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                    <Link
                      to="/auth?mode=login"
                      aria-label="Login"
                      tabIndex={0}
                      className="flex items-center justify-center w-full h-full focus:outline-none"
                      style={{ outline: 'none' }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.currentTarget.click();
                        }
                      }}
                    >
                      <User className="h-6 w-6 text-primary" />
                    </Link>
                  </Button>
                </>
              )}
            </div>
            {/* Hamburger for mobile - stick to right, do not overlap actions */}
            <button
              className="md:hidden flex items-center justify-center p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary ml-2"
              aria-label="Open menu"
              onClick={toggleMobileMenu}
              style={{ position: 'static' }}
            >
              <svg className="h-7 w-7 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          {/* Mobile Menu Drawer */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                ref={mobileMenuRef}
                initial={{ opacity: 0, y: "-100%" }}
                animate={{ opacity: 1, y: "0%" }}
                exit={{ opacity: 0, y: "-100%" }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="absolute top-20 left-0 w-full bg-background/95 backdrop-blur md:hidden shadow-lg py-4 border-t border-border/40 z-50"
              >
                <nav className="flex flex-col items-center space-y-3 px-4">
                  {/* Mobile All Products expandable section */}
                  <div className="w-full">
                    <button
                      className="w-full text-left py-3 px-3 rounded-md font-semibold text-base transition-colors"
                      onClick={() => setMobileAllOpen(v => !v)}
                      aria-expanded={mobileAllOpen}
                      style={{
                        background: mobileAllOpen ? mobileSubtle : 'transparent',
                        color: '#0b3b58'
                      }}
                    >
                      <span className="inline-block mr-2 w-2 h-2 rounded-full" style={{ background: accentColor, opacity: 0.85 }} />
                      All Products
                    </button>
                    {mobileAllOpen && (
                      <div className="mt-1 mb-2 space-y-1 pl-3">
                        <button onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); setMobileAllOpen(false); navigate('/products'); }} className="block w-full text-left px-3 py-2 rounded hover:bg-primary/5">All Products</button>
                        {allCategories.map(cat => (
                          <button key={cat} onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); setMobileAllOpen(false); navigate(`/products?category=${encodeURIComponent(cat)}`); }} className="block w-full text-left px-3 py-2 rounded hover:bg-primary/5">{cat}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  {navItemsForMobile.map((item) => {
                    const isActive = activeNavMobile === item.name;
                    return (
                      <a
                        key={item.name}
                        href={item.path}
                        onClick={e => {
                          e.preventDefault();
                          handleMobileNavClick(item);
                        }}
                        className={`text-lg transition-colors py-2 w-full text-center rounded ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-primary hover:bg-primary/5'}`}
                      >
                        {item.name}
                      </a>
                    );
                  })}
                  {!user && (
                    <Button variant="outline" asChild className="w-11/12 mt-4" onClick={toggleMobileMenu}>
                      <Link to="/auth?mode=login">Login / Signup</Link>
                    </Button>
                  )}
                  {/* Removed mobile 'Get a Quote' link */}
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Mobile search overlay */}
            {mobileSearchOpen && (
              <div ref={mobileSearchContainerRef} className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/30 xl:hidden" style={{ minHeight: '100vh' }}>
              <div className="w-full max-w-full bg-white p-3 pt-6 shadow-lg rounded-none relative flex flex-col items-center">
                <div className="w-full flex items-center relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="w-full rounded border border-border px-3 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all placeholder:opacity-0"
                    placeholder={showAnimated ? categorySuggestions[animatedIndex] : ''}
                    value={search}
                    onChange={e => { setSearch(e.target.value); setShowSuggestions(true); setShowAnimated(false); }}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    onKeyDown={handleSearchKeyDown}
                    aria-label="Search products"
                    style={{ minWidth: 0, background: 'transparent' }}
                  />
                  {showAnimated && !search && (
                    <span
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none select-none transition-all animate-slide-up-text"
                      style={{ zIndex: 1 }}
                      aria-hidden="true"
                    >
                      {categorySuggestions[animatedIndex]}
                    </span>
                  )}
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-primary"
                    onClick={() => search.trim() && handleSearch(search.trim())}
                    tabIndex={-1}
                    aria-label="Submit search"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full bg-background border border-border rounded shadow z-30 mt-1 w-full max-w-full">
                    {suggestions.map(s => (
                      <li
                        key={s.label + s.type}
                        className={`px-3 py-3 cursor-pointer hover:bg-primary/10 flex items-center gap-2 ${s.type === 'category' ? 'font-semibold text-indigo-700' : ''}`}
                        onMouseDown={() => handleSearch(s.label)}
                      >
                        {s.type === 'category' && <span className="inline-block w-2 h-2 rounded-full bg-indigo-400" />}
                        {s.label}
                        {s.type === 'category' && <span className="ml-1 text-xs text-indigo-400">(Category)</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </motion.header>
      );
    };

    export default Header;

    // Add animation for slide-up-text in your CSS (e.g., in index.css):
    // .animate-slide-up-text { animation: slideUpText 0.5s cubic-bezier(0.4,0,0.2,1); }
    // @keyframes slideUpText { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
