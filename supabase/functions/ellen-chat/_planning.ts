// ===== PLANNING ENGINE =====
// Alle datumlogica, slot-finder en fuzzy matching.
// Dit draait in TypeScript — niet in de LLM. Zo worden rekenfouten voorkomen.

import { PlanningConfig, TimeSlot, SupabaseClient } from './_types.ts';

// ── DATUM HELPERS ─────────────────────────────────────────────────────────────

export function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getDayOfWeekNumber(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function bepaalDiscipline(faseNaam: string): string {
  const n = faseNaam.toLowerCase();
  if (n.includes('concept')) return 'Conceptontwikkeling';
  if (n.includes('strateg')) return 'Strategy';
  if (n.includes('creati')) return 'Creative team';
  if (n.includes('product') || n.includes('shoot')) return 'Productie';
  if (n.includes('edit') || n.includes('montage') || n.includes('vfx') || n.includes('online')) return 'Studio';
  if (n.includes('review') || n.includes('meeting')) return 'Intern/Review';
  return 'Algemeen';
}

export function isMeetingFase(faseNaam: string): boolean {
  const n = faseNaam.toLowerCase();
  return n.includes('presentatie') || n.includes('meeting') || n.includes('kick-off') ||
    n.includes('kick off') || n.includes('klantmeeting') || n.includes('eindpresentatie');
}

export function isFeedbackFase(faseNaam: string, urenPerDag?: number): boolean {
  const n = faseNaam.toLowerCase();
  return n.includes('feedback') || n.includes('review') || (urenPerDag !== undefined && urenPerDag <= 2);
}

// ── CONFLICT DETECTIE ─────────────────────────────────────────────────────────

export async function getBestaandeBlokken(
  supabase: SupabaseClient,
  medewerkernaam: string,
  datum: Date
): Promise<Array<{ start_uur: number; duur_uren: number }>> {
  const weekStart = getMonday(datum);
  const dagVanWeek = getDayOfWeekNumber(datum);
  const { data, error } = await supabase
    .from('taken')
    .select('start_uur, duur_uren')
    .eq('werknemer_naam', medewerkernaam)
    .eq('week_start', weekStart)
    .eq('dag_van_week', dagVanWeek);
  if (error) return [];
  return (data || []).sort((a: { start_uur: number }, b: { start_uur: number }) => a.start_uur - b.start_uur);
}

export function heeftConflict(
  bezet: Array<{ start_uur: number; duur_uren: number }>,
  startUur: number,
  duur: number
): boolean {
  const eindUur = startUur + duur;
  return bezet.some(blok => startUur < blok.start_uur + blok.duur_uren && eindUur > blok.start_uur);
}

export function overlapLunch(startUur: number, eindUur: number, config: PlanningConfig): boolean {
  return startUur < config.lunch_eind && eindUur > config.lunch_start;
}

// ── SLOT FINDER ───────────────────────────────────────────────────────────────

export async function vindEersteVrijeSlot(
  supabase: SupabaseClient,
  config: PlanningConfig,
  medewerkernaam: string,
  datum: Date,
  benodigdeUren: number
): Promise<TimeSlot | null> {
  const bezet = await getBestaandeBlokken(supabase, medewerkernaam, datum);
  const werkdagDuur = config.werkdag_eind - config.werkdag_start;
  const lunchDuur = config.lunch_eind - config.lunch_start;
  const maxWerkUren = werkdagDuur - lunchDuur;

  if (benodigdeUren >= maxWerkUren) {
    const ochtendVrij = !heeftConflict(bezet, config.werkdag_start, config.lunch_start - config.werkdag_start);
    const middagVrij = !heeftConflict(bezet, config.lunch_eind, config.werkdag_eind - config.lunch_eind);
    if (ochtendVrij && middagVrij) return { startUur: config.werkdag_start, duurUren: werkdagDuur };
    return null;
  }

  for (let uur = config.werkdag_start; uur <= config.werkdag_eind - benodigdeUren; uur++) {
    if (overlapLunch(uur, uur + benodigdeUren, config)) continue;
    if (!heeftConflict(bezet, uur, benodigdeUren)) return { startUur: uur, duurUren: benodigdeUren };
  }
  return null;
}

export async function vindMeetingSlot(
  supabase: SupabaseClient,
  config: PlanningConfig,
  medewerkernaam: string,
  datum: Date,
  benodigdeUren: number
): Promise<TimeSlot | null> {
  const bezet = await getBestaandeBlokken(supabase, medewerkernaam, datum);
  for (let uur = config.meeting_start; uur <= config.meeting_eind - benodigdeUren; uur++) {
    if (overlapLunch(uur, uur + benodigdeUren, config)) continue;
    if (!heeftConflict(bezet, uur, benodigdeUren)) return { startUur: uur, duurUren: benodigdeUren };
  }
  return null;
}

// ── VERLOF & PARTTIME ─────────────────────────────────────────────────────────

export async function heeftVerlof(
  supabase: SupabaseClient,
  medewerkernaam: string,
  datum: Date
): Promise<boolean> {
  const dateStr = datum.toISOString().split('T')[0];
  const { data: verlof, error } = await supabase
    .from('beschikbaarheid_medewerkers')
    .select('start_datum, eind_datum')
    .eq('werknemer_naam', medewerkernaam)
    .eq('status', 'goedgekeurd')
    .lte('start_datum', dateStr)
    .gte('eind_datum', dateStr);
  if (error) return false;
  return (verlof?.length || 0) > 0;
}

export async function isParttimeDag(
  supabase: SupabaseClient,
  medewerkernaam: string,
  datum: Date
): Promise<boolean> {
  const dagNamen = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  const dagNaam = dagNamen[datum.getDay()];
  const { data: medewerker, error } = await supabase
    .from('medewerkers')
    .select('parttime_dag')
    .ilike('naam_werknemer', `%${medewerkernaam}%`)
    .limit(1)
    .maybeSingle();
  if (error || !medewerker) return false;
  return medewerker.parttime_dag?.toLowerCase() === dagNaam;
}

// ── FUZZY MATCHING ────────────────────────────────────────────────────────────

function levenshteinDistance(a: string, b: string): number {
  const aL = a.toLowerCase(), bL = b.toLowerCase();
  if (aL === bL) return 0;
  const matrix: number[][] = [];
  for (let i = 0; i <= bL.length; i++) matrix[i] = [i];
  for (let j = 0; j <= aL.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= bL.length; i++) {
    for (let j = 1; j <= aL.length; j++) {
      matrix[i][j] = bL[i - 1] === aL[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[bL.length][aL.length];
}

function similarityScore(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - levenshteinDistance(a, b) / maxLen;
}

// deno-lint-ignore no-explicit-any
export function findBestNameMatch(searchTerm: string, medewerkers: any[], threshold = 0.6): any | null {
  let bestMatch = null, bestScore = 0;
  for (const m of medewerkers) {
    const naam = m.naam_werknemer || '';
    const score = Math.max(similarityScore(searchTerm, naam), similarityScore(searchTerm, naam.split(' ')[0]));
    if (score > bestScore && score >= threshold) { bestScore = score; bestMatch = m; }
  }
  return bestMatch;
}
