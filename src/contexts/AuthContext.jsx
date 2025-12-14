import React, { createContext, useState, useContext, useEffect } from 'react';
    import { supabase } from '@/lib/supabaseClient';

    const AuthContext = createContext(null);

    export const useAuth = () => useContext(AuthContext);

    export const AuthProvider = ({ children }) => {
      const [user, setUser] = useState(null);
      const [loading, setLoading] = useState(true);

      useEffect(() => {
        const getSession = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          setUser(session?.user ?? null);
          setLoading(false);
        };

        getSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
          }
        );

        return () => {
          authListener?.subscription.unsubscribe();
        };
      }, []);

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
        const { error } = await supabase.auth.signOut();
        setUser(null); // Always clear user state
        setLoading(false);
        // Ignore session_not_found error, throw others
        if (error && error.message !== 'Session from session_id claim in JWT does not exist') {
          throw error;
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
        login,
        signup,
        logout,
        loginWithProvider,
        changePassword,
        forgotPassword,
        resetPassword,
      };

      return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
    };
