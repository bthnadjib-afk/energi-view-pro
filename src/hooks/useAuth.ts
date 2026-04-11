import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'secretaire' | 'technicien';

export interface Profile {
  id: string;
  nom: string;
  email: string;
  actif: boolean;
  created_at: string;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndRole = useCallback(async (userId: string) => {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data as Profile);
    }
    if (roleRes.data) {
      setRole(roleRes.data.role as UserRole);
    } else {
      setRole(null);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Defer profile fetch to avoid deadlocks
          setTimeout(() => fetchProfileAndRole(newSession.user.id), 0);
        } else {
          setProfile(null);
          setRole(null);
        }
        setLoading(false);
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        fetchProfileAndRole(existing.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfileAndRole]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole(null);
  }, []);

  const canAccess = useCallback((feature: string): boolean => {
    if (!role) return false;
    const permissions: Record<string, UserRole[]> = {
      dashboard_ca: ['admin'],
      configuration: ['admin'],
      factures: ['admin', 'secretaire'],
      clients: ['admin', 'secretaire'],
      devis: ['admin', 'secretaire'],
      agenda: ['admin', 'secretaire'],
      interventions: ['admin', 'secretaire', 'technicien'],
      upload: ['admin', 'secretaire', 'technicien'],
      utilisateurs: ['admin'],
    };
    return permissions[feature]?.includes(role) ?? false;
  }, [role]);

  return { session, user, profile, role, loading, signOut, canAccess };
}
