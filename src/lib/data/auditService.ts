// ===========================================
// AUDIT SERVICE - Logging for all CRUD actions
// ===========================================

import { supabase } from '@/integrations/supabase/client';
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
 * Log an action to the audit_log table
 */
export async function logAuditEntry(entry: AuditLogEntry): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    user_id: entry.user_id,
    entiteit_type: entry.entiteit_type,
    entiteit_id: entry.entiteit_id,
    actie: entry.actie,
    oude_waarde: entry.oude_waarde ?? null,
    nieuwe_waarde: entry.nieuwe_waarde ?? null,
  });

  if (error) {
    console.error('Error logging audit entry:', error);
    // Don't throw - audit logging should not block the main action
  }
}

/**
 * Helper to create audit log for a CREATE action
 */
export async function logCreate(
  userId: string,
  entiteitType: string,
  entiteitId: string,
  nieuweWaarde: Record<string, unknown>
): Promise<void> {
  await logAuditEntry({
    user_id: userId,
    entiteit_type: entiteitType,
    entiteit_id: entiteitId,
    actie: 'create',
    nieuwe_waarde: nieuweWaarde as Json,
  });
}

/**
 * Helper to create audit log for an UPDATE action
 */
export async function logUpdate(
  userId: string,
  entiteitType: string,
  entiteitId: string,
  oudeWaarde: Record<string, unknown>,
  nieuweWaarde: Record<string, unknown>
): Promise<void> {
  await logAuditEntry({
    user_id: userId,
    entiteit_type: entiteitType,
    entiteit_id: entiteitId,
    actie: 'update',
    oude_waarde: oudeWaarde as Json,
    nieuwe_waarde: nieuweWaarde as Json,
  });
}

/**
 * Helper to create audit log for a DELETE action
 */
export async function logDelete(
  userId: string,
  entiteitType: string,
  entiteitId: string,
  oudeWaarde: Record<string, unknown>
): Promise<void> {
  await logAuditEntry({
    user_id: userId,
    entiteit_type: entiteitType,
    entiteit_id: entiteitId,
    actie: 'delete',
    oude_waarde: oudeWaarde as Json,
  });
}

/**
 * Check if the current user can modify a hard-locked item
 * Returns error message if not allowed, null if allowed
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
  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (entiteitType) {
    query = query.eq('entiteit_type', entiteitType);
  }
  if (entiteitId) {
    query = query.eq('entiteit_id', entiteitId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }

  return data || [];
}
