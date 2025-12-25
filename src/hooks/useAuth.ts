// Authentication Hook for COMUNIDAD EX SOS

import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Profile } from '@/types';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    error: null,
  });

  // Fetch user profile
  const fetchProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured()) return null;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    
    return data as Profile;
  }, []);

  // Initialize auth state
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
        }));

        // Fetch profile on auth change (deferred)
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id).then(profile => {
              setState(prev => ({ ...prev, profile }));
            });
          }, 0);
        } else {
          setState(prev => ({ ...prev, profile: null }));
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
        loading: false,
      }));

      if (session?.user) {
        fetchProfile(session.user.id).then(profile => {
          setState(prev => ({ ...prev, profile }));
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Sign in with OTP
  const signInWithOTP = async (phone: string) => {
    if (!isSupabaseConfigured()) {
      return { error: new Error('Backend not configured') };
    }

    setState(prev => ({ ...prev, error: null }));

    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (error) {
      setState(prev => ({ ...prev, error: error.message }));
    }

    return { error };
  };

  // Verify OTP
  const verifyOTP = async (phone: string, token: string) => {
    if (!isSupabaseConfigured()) {
      return { error: new Error('Backend not configured') };
    }

    setState(prev => ({ ...prev, error: null }));

    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (error) {
      setState(prev => ({ ...prev, error: error.message }));
    }

    return { error };
  };

  // Create profile after registration
  const createProfile = async (profileData: Omit<Profile, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseConfigured() || !state.user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('profiles')
      .insert({
        id: state.user.id,
        ...profileData,
      });

    if (error) {
      return { error: new Error(error.message) };
    }

    // Refetch profile
    const profile = await fetchProfile(state.user.id);
    setState(prev => ({ ...prev, profile }));

    return { error: null };
  };

  // Update profile
  const updateProfile = async (updates: Partial<Profile>) => {
    if (!isSupabaseConfigured() || !state.user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', state.user.id);

    if (error) {
      return { error: new Error(error.message) };
    }

    // Refetch profile
    const profile = await fetchProfile(state.user.id);
    setState(prev => ({ ...prev, profile }));

    return { error: null };
  };

  // Sign out
  const signOut = async () => {
    if (!isSupabaseConfigured()) return;

    await supabase.auth.signOut();
    setState({
      user: null,
      session: null,
      profile: null,
      loading: false,
      error: null,
    });
  };

  return {
    ...state,
    isAuthenticated: !!state.user,
    isProfileComplete: !!state.profile,
    signInWithOTP,
    verifyOTP,
    createProfile,
    updateProfile,
    signOut,
  };
}
