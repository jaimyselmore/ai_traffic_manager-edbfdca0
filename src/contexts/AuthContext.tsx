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
}

interface AuthContextType {
  user: AuthUser | null;
  sessionToken: string | null;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  verifySession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'ellen_auth_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      return true;
    } catch {
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
  }, [sessionToken, verifySession]);

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
      };

      // Store session securely
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      setUser(authUser);
      setSessionToken(data.sessionToken);

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Login mislukt') };
    }
  };

  const signOut = async () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setSessionToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, sessionToken, isLoading, signIn, signOut, verifySession }}>
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
