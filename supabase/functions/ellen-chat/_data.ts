// ===== DATA LOADERS =====
// Haalt configuratie, regels en feedback op uit Supabase

import { PlanningConfig, EllenRegel, SupabaseClient, DEFAULT_CONFIG } from './_types.ts';

export async function loadPlanningConfig(supabase: SupabaseClient): Promise<PlanningConfig> {
  try {
    const { data, error } = await supabase
      .from('planning_configuratie')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error || !data) return DEFAULT_CONFIG;
    return {
      werkdag_start: data.werkdag_start ?? DEFAULT_CONFIG.werkdag_start,
      werkdag_eind: data.werkdag_eind ?? DEFAULT_CONFIG.werkdag_eind,
      lunch_start: data.lunch_start ?? DEFAULT_CONFIG.lunch_start,
      lunch_eind: data.lunch_eind ?? DEFAULT_CONFIG.lunch_eind,
      meeting_start: data.meeting_start ?? DEFAULT_CONFIG.meeting_start,
      meeting_eind: data.meeting_eind ?? DEFAULT_CONFIG.meeting_eind,
      standaard_uren_per_dag: data.standaard_uren_per_dag ?? DEFAULT_CONFIG.standaard_uren_per_dag,
      min_buffer_tussen_fases: data.min_buffer_tussen_fases ?? DEFAULT_CONFIG.min_buffer_tussen_fases,
      fase_templates: data.fase_templates ?? DEFAULT_CONFIG.fase_templates,
      extra_instructies: data.extra_instructies,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function loadEllenRegels(supabase: SupabaseClient): Promise<EllenRegel[]> {
  try {
    const { data, error } = await supabase
      .from('ellen_regels')
      .select('categorie, prioriteit, regel, rationale')
      .eq('actief', true)
      .order('prioriteit', { ascending: true });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export async function loadRecentFeedback(supabase: SupabaseClient): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('ellen_feedback')
      .select('feedback_tekst')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error || !data) return [];
    return data.map((f: { feedback_tekst: string }) => f.feedback_tekst).filter(Boolean);
  } catch {
    return [];
  }
}
