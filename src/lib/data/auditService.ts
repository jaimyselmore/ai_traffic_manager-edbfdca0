// ===========================================
// AUDIT SERVICE - Logging functions and utilities
// Audit logging is now handled server-side in data-access edge function
// ===========================================

import { secureSelect } from './secureDataClient';
import type { Json } from '@/integrations/supabase/types';

export type AuditActie = 'create' | 'update' | 'delete';

export interface AuditLogEntry {
  user_id: string;
  entiteit_type: string;
  entiteit_id: string;
  actie: AuditActie;
  oude_waarde?: Json;
  nieuwe_waarde?: Json;
}

/**
 * NOTE: Direct audit logging is now handled server-side in the data-access edge function.
 * These functions are kept for backward compatibility but are no-ops.
 */

export async function logAuditEntry(_entry: AuditLogEntry): Promise<void> {
  // Audit logging is now handled server-side in data-access edge function
  // This function is kept for backward compatibility
}

export async function logCreate(
  _userId: string,
  _entiteitType: string,
  _entiteitId: string,
  _nieuweWaarde: Record<string, unknown>
): Promise<void> {
  // Audit logging is now handled server-side
}

export async function logUpdate(
  _userId: string,
  _entiteitType: string,
  _entiteitId: string,
  _oudeWaarde: Record<string, unknown>,
  _nieuweWaarde: Record<string, unknown>
): Promise<void> {
  // Audit logging is now handled server-side
}

export async function logDelete(
  _userId: string,
  _entiteitType: string,
  _entiteitId: string,
  _oudeWaarde: Record<string, unknown>
): Promise<void> {
  // Audit logging is now handled server-side
}

/**
 * Check if the current user can modify a hard-locked item
 * Returns error message if not allowed, null if allowed
 * NOTE: This is now primarily for client-side UI display.
 * Actual enforcement is done server-side in data-access edge function.
 */
export function checkHardLockPermission(
  itemCreatedBy: string | null | undefined,
  itemIsHardLock: boolean | null | undefined,
  currentUserNaam: string
): string | null {
  if (!itemIsHardLock) return null;
  if (!itemCreatedBy) return null;

  if (itemCreatedBy !== currentUserNaam) {
    return `Alleen ${itemCreatedBy} kan dit aanpassen (hard lock)`;
  }

  return null;
}

/**
 * Get audit log entries for an entity
 */
export async function getAuditLogs(entiteitType?: string, entiteitId?: string) {
  const filters = [];
  
  if (entiteitType) {
    filters.push({ column: 'entiteit_type', operator: 'eq' as const, value: entiteitType });
  }
  if (entiteitId) {
    filters.push({ column: 'entiteit_id', operator: 'eq' as const, value: entiteitId });
  }

  const { data, error } = await secureSelect('audit_log', {
    filters: filters.length > 0 ? filters : undefined,
    order: { column: 'created_at', ascending: false },
    limit: 100,
  });

  if (error) {
    console.error('Error fetching audit logs:', error.message);
    return [];
  }

  return data || [];
}
