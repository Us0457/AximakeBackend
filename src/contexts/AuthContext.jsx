import React, { createContext, useState, useContext, useEffect } from 'react';
    import { supabase } from '@/lib/supabaseClient';

    // Download an external avatar URL and upload to Supabase storage 'avatars' bucket.
    async function uploadAvatarFromUrl(supabaseClient, userId, url) {
      if (!url || !userId) return null;
      try {
        // small timeout/fetch guard
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        let res = null;
        try {
          res = await fetch(url, { signal: controller.signal, mode: 'cors' });
        } catch (e) {
          res = null;
        }
        clearTimeout(timeout);
        // if direct fetch failed, try images.weserv.nl proxy
        if (!res || !res.ok) {
          try {
            const proxy = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&w=512&h=512&fit=cover`;
            const ctrl2 = new AbortController();
            const t2 = setTimeout(() => ctrl2.abort(), 10000);
            const pres = await fetch(proxy, { signal: ctrl2.signal });
            clearTimeout(t2);
            if (pres && pres.ok) res = pres;
          } catch (e) {
            res = null;
          }
        }
        if (!res || !res.ok) return null;
        const blob = await res.blob();
        if (!blob || blob.size === 0) return null;
        const ext = (blob.type && blob.type.split('/')[1]) || 'jpg';
        const path = `avatars/${userId}/avatar.${ext}`;
        const file = new File([blob], `avatar.${ext}`, { type: blob.type || 'image/jpeg' });
        // Upload to avatar bucket; allow overwrite
        try {
          const { error: uploadErr } = await supabaseClient.storage.from('avatars').upload(path, file, { upsert: true });
          if (uploadErr) {
            console.warn('Avatar upload error', uploadErr);
            return null;
          }
        } catch (e) {
          console.warn('Avatar upload exception', e);
          return null;
        }
        const { data } = supabaseClient.storage.from('avatars').getPublicUrl(path);
        return data?.publicUrl || null;
      } catch (e) {
        // fetch aborted or other network error
        return null;
      }
    }

    // Split a full name into first and last components.
    function splitFullName(name) {
      if (!name || typeof name !== 'string') return { first: null, last: null };
      const parts = name.trim().split(/\s+/);
      if (parts.length === 0) return { first: null, last: null };
      if (parts.length === 1) return { first: parts[0], last: null };
      return { first: parts[0], last: parts.slice(1).join(' ') };
    }

    // Extract common profile fields from a Supabase auth user object.
    function extractFromAuth(u) {
      if (!u) return { first: null, last: null, avatar: null, email: null };
      const email = u.email || null;
      let parsedRaw = null;
      try { if (u.raw_user_meta_data) parsedRaw = typeof u.raw_user_meta_data === 'string' ? JSON.parse(u.raw_user_meta_data) : u.raw_user_meta_data; } catch (e) { parsedRaw = null; }
      const meta = u.user_metadata || parsedRaw || {};
      let first = meta?.first_name || meta?.firstName || meta?.given_name || null;
      let last = meta?.last_name || meta?.lastName || meta?.family_name || null;
      if ((!first || first === '') && meta?.name) {
        const parts = splitFullName(meta.name);
        first = parts.first;
        last = parts.last;
      }
      if (first && !last && first.includes(' ')) {
        const parts = splitFullName(first);
        first = parts.first;
        last = parts.last;
      }
      const avatar = meta?.avatar_url || meta?.picture || meta?.photoURL || meta?.image || meta?.profile_image_url || meta?.avatar || null;
      return { first, last, avatar, email };
    }

    // Sanitize auth user metadata to avoid immediate hotlinking of provider images.
    function sanitizeAuthUser(u) {
      if (!u) return null;
      const meta = u.user_metadata ? { ...u.user_metadata } : {};
      if (meta.avatar_url) meta.avatar_url = '';
      if (meta.picture) meta.picture = '';
      if (meta.photoURL) meta.photoURL = '';
      if (meta.image) meta.image = '';
      return { ...u, user_metadata: meta };
    }

    const AuthContext = createContext(null);

    export function useAuth() {
      return useContext(AuthContext);
    }

    export function AuthProvider({ children }) {
      const [user, setUser] = useState(null);
      const [loading, setLoading] = useState(true);
      const [profile, setProfile] = useState(null);
      const [profileReady, setProfileReady] = useState(false);

      // Ensure profile exists and that avatar_url in profiles is a final storage URL (if possible).
      const ensureProfileAndAvatar = async (u) => {
        if (!u) return;
        setProfileReady(false);
        try {
          const { first, last, avatar: remoteAvatar, email } = extractFromAuth(u);
          const { data: existing } = await supabase.from('profiles').select('id,first_name,last_name,avatar_url').eq('id', u.id).maybeSingle();
          if (existing && existing.avatar_url && !String(existing.avatar_url).includes('googleusercontent.com') && !String(existing.avatar_url).includes('images.weserv.nl')) {
            setProfile(existing);
            setProfileReady(true);
            return;
          }
          let finalAvatar = null;
          if (remoteAvatar) {
            try {
              const uploaded = await uploadAvatarFromUrl(supabase, u.id, remoteAvatar);
              if (uploaded) finalAvatar = uploaded;
            } catch (e) {
              finalAvatar = null;
            }
          }
          const toUpsert = { id: u.id };
          if (email) toUpsert.email = email;
          if (first) toUpsert.first_name = first;
          if (last) toUpsert.last_name = last;
          if (finalAvatar) toUpsert.avatar_url = finalAvatar;
          try {
            await supabase.from('profiles').upsert(toUpsert, { returning: 'representation' });
          } catch (e) {
            // ignore upsert errors
          }
          try {
            const { data: p } = await supabase.from('profiles').select('id,first_name,last_name,avatar_url,role').eq('id', u.id).maybeSingle();
            setProfile(p || null);
          } catch (e) {
            setProfile(null);
          }
          setProfileReady(true);
        } catch (e) {
          console.warn('Failed to ensure profile', e);
          setProfile(null);
          setProfileReady(true);
        }
      };

      useEffect(() => {
        const getSession = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          const authUser = session?.user ?? null;
          setUser(sanitizeAuthUser(authUser));
          if (authUser) await ensureProfileAndAvatar(authUser);
          setLoading(false);
        };

        getSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            const authUser = session?.user ?? null;
            setUser(sanitizeAuthUser(authUser));
            setLoading(false);
            // on sign-in, populate profile from provider metadata if missing
            try {
              if (event === 'SIGNED_IN' && authUser) {
                // extract similarly to initial load
                const email = authUser.email || null;
                let parsedRaw = null;
                try { parsedRaw = authUser.raw_user_meta_data && typeof authUser.raw_user_meta_data === 'string' ? JSON.parse(authUser.raw_user_meta_data) : (authUser.raw_user_meta_data || null); } catch (e) { parsedRaw = null; }
                const meta = authUser.user_metadata || parsedRaw || {};
                const first = meta?.first_name || meta?.firstName || meta?.given_name || meta?.name || null;
                const last = meta?.last_name || meta?.lastName || meta?.family_name || null;
                const remoteAvatar = meta?.avatar_url || meta?.picture || meta?.photoURL || meta?.image || meta?.profile_image_url || meta?.avatar || null;
                // Ensure profile and final avatar (blocking upload) via shared helper
                (async () => {
                  try { await ensureProfileAndAvatar(authUser); } catch (e) { /* ignore */ }
                })();
              }
            } catch (e) {
              console.warn('Error ensuring profile on sign-in', e);
            }
          }
        );

        return () => {
          authListener?.subscription.unsubscribe();
        };
      }, []);

      // Prevent immediate hotlinking of provider-hosted avatars (e.g., googleusercontent.com)
      // while we are ensuring the canonical `profiles.avatar_url` (profileReady === false).
      useEffect(() => {
        if (!user) return;
        // If profile isn't ready yet, find images pointing at known provider hosts and proxy or blank them.
        const providerHosts = ['googleusercontent.com', 'lh3.googleusercontent.com'];
        function proxifySrc(src) {
          try {
            return `https://images.weserv.nl/?url=${encodeURIComponent(src)}&output=jpg&w=256&h=256&fit=cover`;
          } catch (e) { return '' }
        }
        const imgs = Array.from(document.querySelectorAll('img')).filter(img => img && img.src && providerHosts.some(h => img.src.includes(h)));
        if (!profileReady) {
          imgs.forEach(img => {
            try {
              if (!img.dataset._origSrc) img.dataset._origSrc = img.src;
              const prox = proxifySrc(img.dataset._origSrc);
              if (prox) img.src = prox;
              else img.src = '';
              img.dataset._proxied = '1';
            } catch (e) { /* ignore DOM errors */ }
          });
        } else {
          // profileReady true: restore to canonical profile avatar if available, otherwise restore original
          imgs.forEach(img => {
            try {
              const orig = img.dataset._origSrc;
              if (profile && profile.avatar_url) {
                img.src = profile.avatar_url;
              } else if (orig) {
                img.src = orig;
              }
              delete img.dataset._proxied;
            } catch (e) { /* ignore DOM errors */ }
          });
        }
        return () => {
          // on unmount or deps change, attempt to restore original sources
          imgs.forEach(img => {
            try {
              const orig = img.dataset._origSrc;
              if (orig) img.src = orig;
              delete img.dataset._proxied;
            } catch (e) {}
          });
        };
      }, [user, profileReady, profile]);

      const login = async (email, password) => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) throw error;
      };

      const signup = async (email, password, { first_name, last_name, phone } = {}) => {
        setLoading(true);
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setLoading(false);
          throw error;
        }
        // Insert profile data if registration succeeded
        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: data.user.id,
            email,
            first_name,
            last_name,
            phone
          });
          if (profileError) {
            setLoading(false);
            throw profileError;
          }
        }
        setLoading(false);
      };

      const logout = async () => {
        setLoading(true);
        // Clear user immediately so the UI can update, then perform the network sign-out.
        setUser(null);
        setProfile(null);
        setProfileReady(false);
        try {
          const { error } = await supabase.auth.signOut();
          if (error) {
            const code = error.code || '';
            const msg = (error.message || '').toString();
            if (code !== 'session_not_found' && msg !== 'Session from session_id claim in JWT does not exist') {
              throw error;
            }
          }
        } finally {
          setLoading(false);
        }
      };
      
      const loginWithProvider = async (provider) => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
          provider: provider,
        });
        setLoading(false);
        if (error) throw error;
      };

      const changePassword = async (currentPassword, newPassword) => {
        // Re-authenticate user
        const { data: { user: currentUser }, error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
        if (signInError) throw signInError;
        // Update password
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      };

      const forgotPassword = async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/auth?mode=reset-password',
        });
        if (error) throw error;
      };

      const resetPassword = async (newPassword) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      };

      const value = {
        user,
        loading,
        profile,
        profileReady,
        login,
        signup,
        logout,
        loginWithProvider,
        changePassword,
        forgotPassword,
        resetPassword,
      };

      // Always render children; expose `loading` so consumers can show spinners if desired.
      return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
    }
