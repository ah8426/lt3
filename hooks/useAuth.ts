'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthActions {
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export function useAuth(): AuthState & AuthActions {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          setUser(null);
          setSession(null);
        } else {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
        }
      } catch (error) {
        console.error('Unexpected error getting session:', error);
        setUser(null);
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);

      // Handle sign out
      if (_event === 'SIGNED_OUT') {
        router.push('/login');
      }

      // Handle token refresh
      if (_event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
      }

      // Handle sign in
      if (_event === 'SIGNED_IN') {
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  const signOut = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }

      setUser(null);
      setSession(null);
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('Error refreshing session:', error);
        throw error;
      }

      setSession(refreshedSession);
      setUser(refreshedSession?.user ?? null);
    } catch (error) {
      console.error('Refresh session error:', error);
      throw error;
    }
  };

  return {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    signOut,
    refreshSession,
  };
}

// Hook to require authentication - redirects to login if not authenticated
export function useRequireAuth(): AuthState & AuthActions {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.push('/login');
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  return auth;
}

// Hook to get user profile data
export function useUserProfile() {
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (fetchError) {
          console.error('Error fetching profile:', fetchError);
          setError(fetchError);
        } else {
          setProfile(data);
        }
      } catch (err) {
        console.error('Unexpected error fetching profile:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      fetchProfile();
    }
  }, [user, authLoading, supabase]);

  return {
    profile,
    isLoading: authLoading || isLoading,
    error,
  };
}
