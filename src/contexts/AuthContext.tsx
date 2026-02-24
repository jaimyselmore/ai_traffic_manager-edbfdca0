import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuthUser {
  id: string;
  email: string;
  naam: string;
  isPlanner: boolean;
  rol?: string;
}

interface AuthSession {
  user: AuthUser;
  sessionToken: string;
  expiresAt: number;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  sessionToken: string | null;
  isLoading: boolean;
  mustChangePassword: boolean;
  signIn: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  verifySession: () => Promise<boolean>;
  clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'ellen_auth_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  // Verify session token with server
  const verifySession = useCallback(async (): Promise<boolean> => {
    const storedSession = localStorage.getItem(STORAGE_KEY);
    if (!storedSession) {
      return false;
    }

    try {
      const session: AuthSession = JSON.parse(storedSession);
      
      // Check if session is expired locally first
      if (session.expiresAt < Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setSessionToken(null);
        return false;
      }

      // Verify session with server
      const { data, error } = await supabase.functions.invoke('verify-session', {
        headers: {
          Authorization: `Bearer ${session.sessionToken}`,
        },
      });

      if (error || data?.error) {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setSessionToken(null);
        return false;
      }

      // Session is valid - update state
      setUser(data.user);
      setSessionToken(session.sessionToken);
      setMustChangePassword(session.mustChangePassword ?? false);
      return true;
    } catch (error) {
      console.error('Session verification failed:', error);
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      setSessionToken(null);
      return false;
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      setIsLoading(true);
      await verifySession();
      setIsLoading(false);
    };
    
    checkSession();
  }, [verifySession]);

  // Periodically verify session (every 5 minutes)
  useEffect(() => {
    if (!sessionToken) return;

    const interval = setInterval(() => {
      verifySession();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]); // verifySession is stable via useCallback, exclude to prevent interval recreation

  const signIn = async (username: string, password: string): Promise<{ error: Error | null }> => {
    try {
      // Call custom login edge function with username
      const { data, error } = await supabase.functions.invoke('custom-login', {
        body: { username, password },
      });

      if (error) {
        return { error: new Error(error.message || 'Login mislukt') };
      }

      if (data?.error) {
        return { error: new Error(data.error) };
      }

      if (!data?.user || !data?.sessionToken) {
        return { error: new Error('Geen sessie data ontvangen') };
      }

      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        naam: data.user.naam,
        isPlanner: data.user.isPlanner,
        rol: data.user.rol,
      };

      const session: AuthSession = {
        user: authUser,
        sessionToken: data.sessionToken,
        expiresAt: data.expiresAt,
        mustChangePassword: data.mustChangePassword ?? false,
      };

      // Store session securely
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      setUser(authUser);
      setSessionToken(data.sessionToken);
      setMustChangePassword(data.mustChangePassword ?? false);

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Login mislukt') };
    }
  };

  const signOut = async () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setSessionToken(null);
    setMustChangePassword(false);
  };

  const clearMustChangePassword = useCallback(() => {
    setMustChangePassword(false);
    // Update stored session
    const storedSession = localStorage.getItem(STORAGE_KEY);
    if (storedSession) {
      try {
        const session: AuthSession = JSON.parse(storedSession);
        session.mustChangePassword = false;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } catch (error) {
        console.warn('Failed to update stored session:', error);
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, sessionToken, isLoading, mustChangePassword, signIn, signOut, verifySession, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
