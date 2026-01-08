import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Fixed password for all planners
const PLANNER_PASSWORD = 'selmore2026';

interface AuthUser {
  id: string;
  email: string;
  naam: string;
  isPlanner: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage key for persisted login
const STORAGE_KEY = 'ellen_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEY);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    // Check password first
    if (password !== PLANNER_PASSWORD) {
      return { error: new Error('Ongeldig wachtwoord') };
    }

    // Look up user in users table
    const { data, error } = await supabase
      .from('users')
      .select('id, naam, email, is_planner')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !data) {
      return { error: new Error('Gebruiker niet gevonden') };
    }

    if (!data.is_planner) {
      return { error: new Error('Geen planner rechten') };
    }

    const authUser: AuthUser = {
      id: data.id,
      email: data.email,
      naam: data.naam,
      isPlanner: data.is_planner || false,
    };

    // Store in localStorage for persistence
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    setUser(authUser);

    return { error: null };
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
