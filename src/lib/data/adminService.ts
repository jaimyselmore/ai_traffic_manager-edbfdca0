// ===========================================
// ADMIN SERVICE - CRUD operations for reference data
// ===========================================

import { supabase } from '@/integrations/supabase/client';

// ===========================================
// WERKNEMERS CRUD
// ===========================================

export async function getWerknemers() {
  const { data, error } = await supabase
    .from('werknemers')
    .select('*')
    .order('naam_werknemer');
  
  if (error) throw error;
  return data || [];
}

export async function createWerknemer(werknemer: {
  naam_werknemer: string;
  email?: string;
  primaire_rol?: string;
  tweede_rol?: string;
  derde_rol?: string;
  discipline?: string;
  werkuren?: number;
  parttime_dag?: string;
  duo_team?: string;
  vaardigheden?: string;
  notities?: string;
  beschikbaar?: boolean;
  is_planner?: boolean;
}) {
  // Get next werknemer_id
  const { data: maxData } = await supabase
    .from('werknemers')
    .select('werknemer_id')
    .order('werknemer_id', { ascending: false })
    .limit(1);
  
  const nextId = (maxData?.[0]?.werknemer_id || 0) + 1;
  
  const { data, error } = await supabase
    .from('werknemers')
    .insert({ ...werknemer, werknemer_id: nextId })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateWerknemer(werknemer_id: number, updates: Partial<{
  naam_werknemer: string;
  email: string;
  primaire_rol: string;
  tweede_rol: string;
  derde_rol: string;
  discipline: string;
  werkuren: number;
  parttime_dag: string;
  duo_team: string;
  vaardigheden: string;
  notities: string;
  beschikbaar: boolean;
  is_planner: boolean;
}>) {
  const { data, error } = await supabase
    .from('werknemers')
    .update(updates)
    .eq('werknemer_id', werknemer_id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteWerknemer(werknemer_id: number) {
  const { error } = await supabase
    .from('werknemers')
    .delete()
    .eq('werknemer_id', werknemer_id);
  
  if (error) throw error;
}

// ===========================================
// ROLPROFIELEN CRUD
// ===========================================

export async function getRolprofielen() {
  const { data, error } = await supabase
    .from('rolprofielen')
    .select('*')
    .order('rol_nummer');
  
  if (error) throw error;
  return data || [];
}

export async function createRolprofiel(rol: {
  rol_naam: string;
  beschrijving_rol?: string;
  taken_rol?: string;
}) {
  // Get next rol_nummer
  const { data: maxData } = await supabase
    .from('rolprofielen')
    .select('rol_nummer')
    .order('rol_nummer', { ascending: false })
    .limit(1);
  
  const nextNummer = (maxData?.[0]?.rol_nummer || 0) + 1;
  
  const { data, error } = await supabase
    .from('rolprofielen')
    .insert({ ...rol, rol_nummer: nextNummer })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateRolprofiel(rol_nummer: number, updates: Partial<{
  rol_naam: string;
  beschrijving_rol: string;
  taken_rol: string;
}>) {
  const { data, error } = await supabase
    .from('rolprofielen')
    .update(updates)
    .eq('rol_nummer', rol_nummer)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteRolprofiel(rol_nummer: number) {
  const { error } = await supabase
    .from('rolprofielen')
    .delete()
    .eq('rol_nummer', rol_nummer);
  
  if (error) throw error;
}

// ===========================================
// DISCIPLINES CRUD
// ===========================================

export async function getDisciplines() {
  const { data, error } = await supabase
    .from('disciplines')
    .select('*')
    .order('discipline_naam');
  
  if (error) throw error;
  return data || [];
}

export async function createDiscipline(discipline: {
  discipline_naam: string;
  beschrijving?: string;
  kleur_hex?: string;
}) {
  const { data, error } = await supabase
    .from('disciplines')
    .insert(discipline)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateDiscipline(id: number, updates: Partial<{
  discipline_naam: string;
  beschrijving: string;
  kleur_hex: string;
}>) {
  const { data, error } = await supabase
    .from('disciplines')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteDiscipline(id: number) {
  const { error } = await supabase
    .from('disciplines')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ===========================================
// KLANTEN CRUD
// ===========================================

export async function getKlanten() {
  const { data, error } = await supabase
    .from('klanten')
    .select('*')
    .order('naam');
  
  if (error) throw error;
  return data || [];
}

export async function createKlant(klant: {
  naam: string;
  contactpersoon?: string;
  email?: string;
  telefoon?: string;
  adres?: string;
  notities?: string;
}) {
  // Generate next klantnummer
  const { data: maxData } = await supabase
    .from('klanten')
    .select('klantnummer')
    .order('klantnummer', { ascending: false })
    .limit(1);
  
  let nextNum = 1001;
  if (maxData?.[0]?.klantnummer) {
    const num = parseInt(maxData[0].klantnummer.replace('K', ''), 10);
    if (!isNaN(num)) nextNum = num + 1;
  }
  
  const { data, error } = await supabase
    .from('klanten')
    .insert({ ...klant, klantnummer: `K${nextNum}` })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateKlant(id: string, updates: Partial<{
  naam: string;
  contactpersoon: string;
  email: string;
  telefoon: string;
  adres: string;
  notities: string;
}>) {
  const { data, error } = await supabase
    .from('klanten')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteKlant(id: string) {
  const { error } = await supabase
    .from('klanten')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}
