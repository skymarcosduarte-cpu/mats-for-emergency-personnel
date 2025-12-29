// Authentication Hook for COMUNIDAD EX SOS

import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  full_name: string;
  nickname: string;
  specialty: string[] | null;
  phone: string;
  birthday: string | null;
  can_provide_medical_assistance: boolean;
  has_first_aid_kit: boolean;
  has_ambulance: boolean;
  has_rescue_unit: boolean;
  has_k9_unit: boolean;
  blood_type: string | null;
  allergies: string | null;
  medical_conditions: string | null;
  current_medications: string | null;
  emergency_medical_notes: string | null;
  show_name_on_map: boolean;
  share_location: boolean;
  share_medical_info: boolean;
  privacy_consent_at: string | null;
  terms_accepted_at: string | null;
  tutorial_disclaimer_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR' | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    role: null,
    loading: true,
    error: null,
  });

  // Fetch user profile
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    
    return data as Profile | null;
  }, []);

  // Fetch user role
  const fetchRole = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching role:', error);
      return null;
    }
    
    return data?.role as 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR' | null;
  }, []);

  // Initialize auth state
  useEffect(() => {
    // Check if we should clear session (user chose not to remember)
    const shouldClearSession = sessionStorage.getItem('clear-session-on-close');
    
    // Handle page unload for "don't remember me" sessions
    const handleBeforeUnload = () => {
      if (sessionStorage.getItem('clear-session-on-close')) {
        supabase.auth.signOut();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
        }));

        // Fetch profile and role on auth change (deferred)
        if (session?.user) {
          setTimeout(async () => {
            const [profile, role] = await Promise.all([
              fetchProfile(session.user.id),
              fetchRole(session.user.id),
            ]);
            setState(prev => ({ ...prev, profile, role }));
          }, 0);
        } else {
          setState(prev => ({ ...prev, profile: null, role: null }));
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
        loading: false,
      }));

      if (session?.user) {
        const [profile, role] = await Promise.all([
          fetchProfile(session.user.id),
          fetchRole(session.user.id),
        ]);
        setState(prev => ({ ...prev, profile, role }));
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [fetchProfile, fetchRole]);

  // Sign up with email
  const signUp = async (email: string, password: string) => {
    setState(prev => ({ ...prev, error: null }));

    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      setState(prev => ({ ...prev, error: error.message }));
    }

    return { error };
  };

  // Sign in with email
  const signIn = async (email: string, password: string, rememberMe: boolean = true) => {
    setState(prev => ({ ...prev, error: null }));

    // Set session persistence based on rememberMe
    // When rememberMe is false, we'll clear the session on browser close
    if (!rememberMe) {
      // Store a flag to clear session on page unload
      sessionStorage.setItem('clear-session-on-close', 'true');
    } else {
      sessionStorage.removeItem('clear-session-on-close');
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setState(prev => ({ ...prev, error: error.message }));
    }

    return { error };
  };

  // Create profile after registration
  const createProfile = async (profileData: {
    full_name: string;
    nickname: string;
    specialty: string[] | null;
    phone: string;
    birthday?: string;
    role: 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR';
    can_provide_medical_assistance?: boolean;
    has_first_aid_kit?: boolean;
    has_ambulance?: boolean;
    has_rescue_unit?: boolean;
    has_k9_unit?: boolean;
  }) => {
    if (!state.user) {
      return { error: new Error('Not authenticated') };
    }

    // Insert profile (trigger will create FAMILIAR role by default)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: state.user.id,
        full_name: profileData.full_name,
        nickname: profileData.nickname,
        specialty: profileData.specialty,
        phone: profileData.phone,
        birthday: profileData.birthday || null,
        can_provide_medical_assistance: profileData.can_provide_medical_assistance ?? false,
        has_first_aid_kit: profileData.has_first_aid_kit ?? false,
        has_ambulance: profileData.has_ambulance ?? false,
        has_rescue_unit: profileData.has_rescue_unit ?? false,
        has_k9_unit: profileData.has_k9_unit ?? false,
      });

    if (profileError) {
      return { error: new Error(profileError.message) };
    }

    // Update role if not FAMILIAR (default)
    if (profileData.role !== 'FAMILIAR') {
      await supabase
        .from('user_roles')
        .update({ role: profileData.role })
        .eq('user_id', state.user.id);
    }

    // Refetch profile and role
    const [profile, role] = await Promise.all([
      fetchProfile(state.user.id),
      fetchRole(state.user.id),
    ]);
    setState(prev => ({ ...prev, profile, role }));

    return { error: null };
  };

  // Update profile
  const updateProfile = async (updates: Partial<Profile>) => {
    if (!state.user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', state.user.id);

    if (error) {
      return { error: new Error(error.message) };
    }

    const profile = await fetchProfile(state.user.id);
    setState(prev => ({ ...prev, profile }));

    return { error: null };
  };

  // Update user role
  const updateRole = async (newRole: 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR') => {
    if (!state.user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', state.user.id);

    if (error) {
      return { error: new Error(error.message) };
    }

    setState(prev => ({ ...prev, role: newRole }));
    return { error: null };
  };

  // Delete user account
  const deleteAccount = async () => {
    if (!state.user) {
      return { error: new Error('Not authenticated') };
    }

    // Delete profile first (will cascade to user_roles via trigger or we handle it)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', state.user.id);

    if (profileError) {
      return { error: new Error(profileError.message) };
    }

    // Sign out the user
    await supabase.auth.signOut();
    setState({
      user: null,
      session: null,
      profile: null,
      role: null,
      loading: false,
      error: null,
    });

    return { error: null };
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    setState({
      user: null,
      session: null,
      profile: null,
      role: null,
      loading: false,
      error: null,
    });
  };

  return {
    ...state,
    isAuthenticated: !!state.user,
    isProfileComplete: !!state.profile,
    signUp,
    signIn,
    createProfile,
    updateProfile,
    updateRole,
    deleteAccount,
    signOut,
  };
}
