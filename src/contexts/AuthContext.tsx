import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuthUser {
  id: string;
  email: string;
  naam: string;
  isPlanner: boolean;
  rol?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'ellen_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEY);
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      // Call custom login edge function
      const { data, error } = await supabase.functions.invoke('custom-login', {
        body: { email, password },
      });

      if (error) {
        return { error: new Error(error.message || 'Login mislukt') };
      }

      if (data?.error) {
        return { error: new Error(data.error) };
      }

      if (!data?.user) {
        return { error: new Error('Geen gebruiker data ontvangen') };
      }

      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        naam: data.user.naam,
        isPlanner: data.user.isPlanner,
        rol: data.user.rol,
      };

      // Store in localStorage for persistence
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
      setUser(authUser);

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Login mislukt') };
    }
  };

  const signOut = async () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
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

