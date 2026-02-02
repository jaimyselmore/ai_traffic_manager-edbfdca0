// ===========================================
// SECURE DATA CLIENT
// All database operations go through authenticated edge functions
// ===========================================

import { supabase } from '@/integrations/supabase/client';

interface Filter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is';
  value: unknown;
}

interface Order {
  column: string;
  ascending?: boolean;
}

interface DataRequest {
  operation: 'select' | 'insert' | 'update' | 'delete';
  table: string;
  data?: Record<string, unknown>;
  filters?: Filter[];
  columns?: string;
  order?: Order;
  limit?: number;
}

interface DataResponse<T> {
  data: T | null;
  error: Error | null;
}

// Get session token from localStorage
export function getSessionToken(): string | null {
  const storedSession = localStorage.getItem('ellen_auth_session');
  if (!storedSession) return null;

  try {
    const session = JSON.parse(storedSession);
    if (session.expiresAt < Date.now()) {
      localStorage.removeItem('ellen_auth_session');
      return null;
    }
    return session.sessionToken;
  } catch {
    return null;
  }
}

// Main data access function
export async function secureDataAccess<T>(request: DataRequest): Promise<DataResponse<T>> {
  const sessionToken = getSessionToken();
  
  if (!sessionToken) {
    return { data: null, error: new Error('Geen actieve sessie - log opnieuw in') };
  }

  try {
    const { data, error } = await supabase.functions.invoke('data-access', {
      body: request,
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    if (error) {
      // Check for session errors
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        localStorage.removeItem('ellen_auth_session');
        window.location.href = '/login';
        return { data: null, error: new Error('Sessie verlopen - log opnieuw in') };
      }
      return { data: null, error: new Error(error.message || 'Database fout') };
    }

    if (data?.error) {
      if (data.code === 'INVALID_SESSION' || data.code === 'NO_SESSION') {
        localStorage.removeItem('ellen_auth_session');
        window.location.href = '/login';
        return { data: null, error: new Error('Sessie verlopen - log opnieuw in') };
      }
      return { data: null, error: new Error(data.error) };
    }

    return { data: data?.data as T, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Onbekende fout') };
  }
}

// Convenience functions for common operations

export async function secureSelect<T>(
  table: string,
  options?: {
    columns?: string;
    filters?: Filter[];
    order?: Order;
    limit?: number;
  }
): Promise<DataResponse<T[]>> {
  return secureDataAccess<T[]>({
    operation: 'select',
    table,
    ...options,
  });
}

export async function secureInsert<T>(
  table: string,
  data: Record<string, unknown>
): Promise<DataResponse<T[]>> {
  return secureDataAccess<T[]>({
    operation: 'insert',
    table,
    data,
  });
}

export async function secureUpdate<T>(
  table: string,
  data: Record<string, unknown>,
  filters: Filter[]
): Promise<DataResponse<T[]>> {
  return secureDataAccess<T[]>({
    operation: 'update',
    table,
    data,
    filters,
  });
}

export async function secureDelete<T>(
  table: string,
  filters: Filter[]
): Promise<DataResponse<T[]>> {
  return secureDataAccess<T[]>({
    operation: 'delete',
    table,
    filters,
  });
}
