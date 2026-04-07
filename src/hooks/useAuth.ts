// Authentication Hook for COMUNIDAD EX SOS

import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getCachedAuthSession, cacheAuthSession, clearAuthSessionCache } from '@/lib/offlineDataCache';

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
  opt_out_drills: boolean;
  zello_username: string | null;
  zello_transmitting_until: string | null;
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

  // Load cached auth immediately on mount (sync from localStorage for instant display)
  // NOTE: Cache is only used for faster initial render, but we ALWAYS validate from DB
  useEffect(() => {
    const loadCachedAuth = async () => {
      try {
        const cached = await getCachedAuthSession();
        if (cached && cached.profile) {
          console.log('[useAuth] Loaded from cache for instant display');
          setState(prev => ({
            ...prev,
            profile: cached.profile as Profile,
            role: cached.role as 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR' | null,
            // Keep loading true - we'll validate from DB
          }));
        }
      } catch (e) {
        console.error('[useAuth] Cache load error:', e);
      }
    };
    loadCachedAuth();
  }, []);

  // Fetch user profile with retry logic for transient network errors
  const fetchProfile = useCallback(async (userId: string, retries = 2): Promise<Profile | null> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
          
        if (error) {
          // On network errors, retry
          if (error.message?.includes('fetch') || error.message?.includes('network') || error.code === 'PGRST000') {
            console.warn(`[useAuth] Profile fetch attempt ${attempt + 1} failed, retrying...`, error);
            if (attempt < retries) {
              await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
              continue;
            }
          }
          console.error('[useAuth] Error fetching profile:', error);
          return null;
        }
        
        return data as Profile | null;
      } catch (e) {
        console.error(`[useAuth] Profile fetch exception on attempt ${attempt + 1}:`, e);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        return null;
      }
    }
    return null;
  }, []);

  // Fetch user role with retry logic for transient network errors
  const fetchRole = useCallback(async (userId: string, retries = 2): Promise<'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR' | null> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();
          
        if (error) {
          // On network errors, retry
          if (error.message?.includes('fetch') || error.message?.includes('network') || error.code === 'PGRST000') {
            console.warn(`[useAuth] Role fetch attempt ${attempt + 1} failed, retrying...`, error);
            if (attempt < retries) {
              await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
              continue;
            }
          }
          console.error('[useAuth] Error fetching role:', error);
          return null;
        }
        
        return data?.role as 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR' | null;
      } catch (e) {
        console.error(`[useAuth] Role fetch exception on attempt ${attempt + 1}:`, e);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        return null;
      }
    }
    return null;
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
            // IMPORTANT: Only update if we got a valid profile
            // Prevents showing AuthGate on transient network errors
            if (profile) {
              setState(prev => ({ ...prev, profile, role }));
              cacheAuthSession(session.user.id, profile, role);
            } else {
              // Profile fetch failed - check if we have cached data
              console.warn('[useAuth] Profile fetch returned null, keeping existing state');
              // Only clear profile if we're sure user doesn't have one (new user)
              // Keep cached/current state on network failures
            }
          }, 0);
        } else {
          setState(prev => ({ ...prev, profile: null, role: null }));
          clearAuthSessionCache();
        }
      }
    );

    // THEN check for existing session - ALWAYS fetch profile from DB to validate
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setState(prev => ({
          ...prev,
          session,
          user: session.user,
        }));

        // If token is close to expiry, refresh it first
        const expiresAt = session.expires_at || 0;
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt - now < 300) {
          console.log('[useAuth] Token expiring soon, refreshing...');
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData.session) {
            setState(prev => ({ ...prev, session: refreshData.session, user: refreshData.session!.user }));
          }
        }

        console.log('[useAuth] Validating profile from database for user:', session.user.id);
        const [profile, role] = await Promise.all([
          fetchProfile(session.user.id),
          fetchRole(session.user.id),
        ]);
        
        if (profile) {
          console.log('[useAuth] Profile validated from DB:', profile.nickname);
          setState(prev => ({ ...prev, profile, role, loading: false }));
          cacheAuthSession(session.user.id, profile, role);
        } else {
          // Profile fetch returned null - could be network error or genuinely missing
          // Check if we have cached data to avoid kicking user to AuthGate on transient errors
          const cached = await getCachedAuthSession();
          if (cached?.profile) {
            console.warn('[useAuth] Profile fetch failed but cache exists - keeping cached state');
            setState(prev => ({
              ...prev,
              profile: cached.profile as Profile,
              role: cached.role as 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR' | null,
              loading: false,
            }));
          } else {
            console.log('[useAuth] No profile found in DB and no cache - user needs to complete registration');
            setState(prev => ({ ...prev, profile: null, role: null, loading: false }));
            clearAuthSessionCache();
          }
        }
      } else {
        setState(prev => ({ ...prev, session: null, user: null, loading: false }));
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

    // Send welcome email (fire and forget - don't block registration)
    supabase.functions.invoke('send-welcome-email', {
      body: {
        user_id: state.user.id,
        email: state.user.email,
        nickname: profileData.nickname,
        full_name: profileData.full_name,
      },
    }).then(({ error }) => {
      if (error) {
        console.warn('[useAuth] Failed to send welcome email:', error);
      } else {
        console.log('[useAuth] Welcome email sent to', state.user?.email);
      }
    }).catch(e => console.warn('[useAuth] Welcome email error:', e));

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

    try {
      // Delete from profiles_public first (no cascade, manual cleanup)
      await supabase
        .from('profiles_public')
        .delete()
        .eq('user_id', state.user.id);

      // Delete user locations
      await supabase
        .from('user_locations')
        .delete()
        .eq('user_id', state.user.id);

      // Delete user roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', state.user.id);

      // Delete emergency contacts
      await supabase
        .from('emergency_contacts')
        .delete()
        .eq('user_id', state.user.id);

      // Delete profile last
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', state.user.id);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
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
    } catch (err) {
      console.error('Error during account deletion:', err);
      return { error: new Error('Error al eliminar la cuenta') };
    }
  };

  // Sign out
  const signOut = async () => {
    await clearAuthSessionCache();
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

  // Manual refetch of profile (useful after profile creation)
  const refetchProfile = useCallback(async () => {
    if (!state.user) return;
    console.log('[useAuth] Manually refetching profile...');
    const [profile, role] = await Promise.all([
      fetchProfile(state.user.id),
      fetchRole(state.user.id),
    ]);
    setState(prev => ({ ...prev, profile, role }));
    if (profile) {
      cacheAuthSession(state.user.id, profile, role);
    }
    console.log('[useAuth] Profile refetched:', !!profile);
  }, [state.user, fetchProfile, fetchRole]);

  // Check if user needs to complete their profile (has account but no profile)
  const needsProfileCompletion = !!state.user && !state.profile && !state.loading;

  return {
    ...state,
    isAuthenticated: !!state.user,
    isProfileComplete: !!state.profile,
    needsProfileCompletion,
    signUp,
    signIn,
    createProfile,
    updateProfile,
    updateRole,
    deleteAccount,
    signOut,
    refetchProfile,
  };
}
