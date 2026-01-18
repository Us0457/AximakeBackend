import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Header = () => {
  const { user, profile, profileReady } = useAuth();
  const [profileRole, setProfileRole] = useState(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [avatarSrc, setAvatarSrc] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  // Use profile and profileReady from AuthContext (no direct DB queries in header)
  useEffect(() => {
    if (profileReady && profile) {
      setProfileRole(profile.role || null);
      setProfileAvatarUrl(profile.avatar_url || '');
      setAvatarSrc(profile.avatar_url || '');
    } else {
      setProfileRole(null);
      setProfileAvatarUrl('');
      setAvatarSrc('');
    }
  }, [profile, profileReady]);

  function handleImgError(e) {
    const img = e?.target;
    if (!img) return;
    const already = img.dataset?.proxied === '1';
    const current = img.src || avatarSrc || '';
    if (!already && current) {
      const prox = `https://images.weserv.nl/?url=${encodeURIComponent(current)}&output=jpg&w=256&h=256&fit=cover`;
      img.dataset.proxied = '1';
      setAvatarSrc(prox);
      img.src = prox;
      return;
    }
    // final fallback
    setAvatarSrc('');
  }

  return (
    <header className="bg-white shadow">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            {/* Logo and branding */}
            <div className="flex-shrink-0">
              <a href="/" className="text-xl font-bold text-primary">
                MyApp
              </a>
            </div>
          </div>
          <div className="hidden md:flex md:items-center md:gap-6">
            {/* Desktop navigation links */}
            <a href="/" className="text-sm font-medium text-gray-700 hover:text-gray-900">
              Home
            </a>
            <a href="/about" className="text-sm font-medium text-gray-700 hover:text-gray-900">
              About
            </a>
            <a href="/services" className="text-sm font-medium text-gray-700 hover:text-gray-900">
              Services
            </a>
            <a href="/contact" className="text-sm font-medium text-gray-700 hover:text-gray-900">
              Contact
            </a>
          </div>
          <div className="flex items-center gap-4">
            {/* User account menu */}
            {user ? (
              <div className="relative">
                <button
                  className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                  onClick={() => setDropdownOpen((open) => !open)}
                  type="button"
                >
                  <span className="sr-only">Open user menu</span>
                  <img
                    src={avatarSrc || '/default-avatar.png'}
                    alt="User Avatar"
                    onError={handleImgError}
                    className="w-8 h-8 rounded-full"
                  />
                </button>
                {/* Dropdown menu for user account */}
                {dropdownOpen && (
                  <div className="absolute right-0 z-10 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                    <div className="py-1" role="none">
                      <a
                        href="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Your Profile
                      </a>
                      <a
                        href="/settings"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Settings
                      </a>
                      {/* Debug line to display current profileRole value */}
                      {profileRole && (
                        <div className="block px-4 py-2 text-xs text-gray-400">
                          Debug: role = {profileRole}
                        </div>
                      )}
                      {/* Admin Dashboard link, visible only to admins */}
                      {profileRole && profileRole.trim().toLowerCase() === 'admin' && (
                        <div
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                          onClick={() => navigate('/admin')}
                        >
                          Admin Dashboard
                        </div>
                      )}
                      <div className="border-t border-gray-100"></div>
                      <a
                        href="/logout"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Sign out
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <a
                  href="/login"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Log in
                </a>
                <a
                  href="/signup"
                  className="inline-block px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark"
                >
                  Sign up
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;