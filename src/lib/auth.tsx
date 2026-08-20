'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile, UserRole } from '@/types/database';
import { User as SupabaseAuthUser } from '@supabase/supabase-js';

interface AuthContextType {
  user: SupabaseAuthUser | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchRole: (newRole: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  switchRole: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseAuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchUserProfile(authUser: SupabaseAuthUser | null) {
    if (!authUser) {
      setProfile(null);
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (data && !error) {
        setProfile(data);
      } else {
        // Fallback to auth metadata if profile row not yet created
        const meta = authUser.user_metadata || {};
        const isMasterAdmin = authUser.email === 'admin@gm-school.ma';
        setProfile({
          id: authUser.id,
          email: authUser.email || '',
          first_name: meta.first_name || authUser.email?.split('@')[0] || 'Utilisateur',
          last_name: meta.last_name || '',
          role: (meta.role as Profile['role']) || (isMasterAdmin ? 'SUPER_ADMIN' : 'TEACHER'),
          is_active: isMasterAdmin ? true : false,
          created_at: authUser.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('Error fetching user profile:', err);
    }
  }

  useEffect(() => {
    const supabase = createClient();

    // 1. Initial session fetch
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser);
      fetchUserProfile(currentUser).finally(() => setLoading(false));
    });

    // 2. Auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      fetchUserProfile(currentUser);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    setProfile(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  async function refreshProfile() {
    if (user) {
      await fetchUserProfile(user);
    }
  }

  async function switchRole(newRole: UserRole) {
    if (profile) {
      setProfile({ ...profile, role: newRole });
      try {
        const supabase = createClient();
        await supabase.from('profiles').update({ role: newRole }).eq('id', profile.id);
      } catch {
        // ignore
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut,
        refreshProfile,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
