// Ellen AI Chat - Supabase Edge Function (Claude Sonnet 4)
// Verwerkt chatberichten, zoekt data op via Claude tool use, retourneert antwoorden
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { verify } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---- JWT VERIFICATION ----

interface SessionPayload {
  sub: string;
  email: string;
  naam: string;
  isPlanner: boolean;
  rol: string;
  iat: number;
  exp: number;
}

async function getJwtKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const jwtSecret = Deno.env.get('JWT_SECRET') ?? serviceRoleKey;
  if (!jwtSecret) return null;
  try {
    const key = await getJwtKey(jwtSecret);
    const payload = await verify(token, key) as unknown as SessionPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---- TYPES ----

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

interface PlanningConfig {
  werkdag_start: number;
  werkdag_eind: number;
  lunch_start: number;
  lunch_eind: number;
  meeting_start: number;
  meeting_eind: number;
  standaard_uren_per_dag: number;
  min_buffer_tussen_fases: number;
  fase_templates: Array<{ naam: string; min_dagen: number; max_dagen: number; omschrijving?: string }>;
  extra_instructies?: string;
}

interface EllenRegel {
  categorie: 'hard' | 'soft' | 'voorkeur';
  prioriteit: number;
  regel: string;
  rationale: string | null;
}

interface TimeSlot {
  startUur: number;
  duurUren: number;
}

// ---- DEFAULT CONFIG ----

const DEFAULT_CONFIG: PlanningConfig = {
  werkdag_start: 9,
  werkdag_eind: 18,
  lunch_start: 12.5,
  lunch_eind: 13.5,
  meeting_start: 10,
  meeting_eind: 17,
  standaard_uren_per_dag: 8,
  min_buffer_tussen_fases: 0,
  fase_templates: [
    { naam: 'Concept/Strategie', min_dagen: 1, max_dagen: 2 },
    { naam: 'Pre-productie', min_dagen: 1, max_dagen: 3 },
    { naam: 'Shoot/Productie', min_dagen: 1, max_dagen: 5 },
    { naam: 'Edit/Post-productie', min_dagen: 2, max_dagen: 10 },
    { naam: 'Review/Afronding', min_dagen: 1, max_dagen: 2 },
  ],
};

// ---- DATA LOADERS ----

async function loadPlanningConfig(supabase: SupabaseClient): Promise<PlanningConfig> {
  try {
    const { data, error } = await supabase
      .from('planning_configuratie')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.log('Planning configuratie niet gevonden, gebruik defaults');
      return DEFAULT_CONFIG;
    }

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
  } catch (e) {
    console.error('Fout bij laden planning configuratie:', e);
    return DEFAULT_CONFIG;
  }
}

async function loadEllenRegels(supabase: SupabaseClient): Promise<EllenRegel[]> {
  try {
    const { data, error } = await supabase
      .from('ellen_regels')
      .select('categorie, prioriteit, regel, rationale')
      .eq('actief', true)
      .order('prioriteit', { ascending: true });

    if (error || !data) {
      console.log('Geen ellen_regels gevonden');
      return [];
    }
    return data;
  } catch (e) {
    console.error('Fout bij laden ellen_regels:', e);
    return [];
  }
}

async function loadRecentFeedback(supabase: SupabaseClient): Promise<string[]> {
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

// ---- SYSTEM PROMPT BUILDER (XML-structured for Claude) ----

function formatTime(decimal: number): string {
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function buildSystemPrompt(
  config: PlanningConfig,
  regels: EllenRegel[],
  feedback: string[],
  plannerNaam: string,
  plannerInfo: string
): string {
  // Groepeer regels per categorie
  const hardRegels = regels.filter(r => r.categorie === 'hard');
  const softRegels = regels.filter(r => r.categorie === 'soft');
  const voorkeurRegels = regels.filter(r => r.categorie === 'voorkeur');

  const faseList = config.fase_templates
    .map(f => `  - ${f.naam}: ${f.min_dagen}-${f.max_dagen} dagen${f.omschrijving ? ` (${f.omschrijving})` : ''}`)
    .join('\n');

  return `<role>
Je bent Ellen, Traffic Manager AI voor Selmore - een creatief productiebedrijf gespecialiseerd in video content.
Je denkt als een ervaren planner: proactief, kritisch, en je ziet dingen die anderen missen.
Je praat als een collega - informeel, direct, oplossingsgericht.
</role>

<tone>
- Kort en krachtig, geen wollige taal
- Informeel Nederlands ("Even kijken...", "Top!", "Momentje...")
- Bij problemen: oplossingsgericht, alternatieven bieden
- Geen emoji's tenzij echt nodig
</tone>

<redeneer_protocol>
Bij ELKE planning doorloop je deze stappen IN VOLGORDE:

STAP 1: TOELICHTINGEN ANALYSEREN
- Lees ALLE toelichtingen per fase zorgvuldig
- "1 dag per week" = verdeling per_week met dagen_per_week=1
- "elke week een uurtje" = verdeling per_week met uren_per_dag=1
- "laatste week" of "finishing touches" = verdeling laatste_week
- "aaneengesloten" of niets specifiek = verdeling aaneengesloten

STAP 2: CONSTRAINTS CHECKEN
- Check beschikbaarheid van ALLE medewerkers (verlof, parttime, bestaande taken)
- Noteer de deadline en reken TERUG vanaf de deadline
- Check klant-specifieke instructies

STAP 3: REGELS TOEPASSEN
- Hard rules MOETEN gerespecteerd worden - geen uitzonderingen
- Soft rules zijn belangrijk maar mogen wijken met uitleg
- Voorkeuren zijn nice-to-have

STAP 4: SLIM PLANNEN
- Plan PARALLEL: alle medewerkers kunnen tegelijk starten
- Verdeel werk exact volgens de toelichting
- Feedback/review = donderdag of vrijdag (niet maandag!)
- Finishing touches = laatste week voor deadline

STAP 5: RISICO'S IDENTIFICEREN
- Te veel werk voor beschikbare tijd?
- Deadline te krap?
- Medewerker overbelast (>40u/week)?
- MELD dit expliciet!

STAP 6: VOORSTEL PRESENTEREN
- Gebruik ALTIJD de plan_project tool
- Leg uit WAAROM je deze verdeling kiest
- Noem welke regels je hebt toegepast
- Noem risico's en alternatieven
</redeneer_protocol>

<werktijden>
- Werkdag: ${formatTime(config.werkdag_start)} - ${formatTime(config.werkdag_eind)}
- Lunch: ${formatTime(config.lunch_start)} - ${formatTime(config.lunch_eind)} (GEEN werk plannen)
- Meetings: bij voorkeur tussen ${formatTime(config.meeting_start)} en ${formatTime(config.meeting_eind)}
- Standaard uren per dag: ${config.standaard_uren_per_dag}
</werktijden>

<fase_richtlijnen>
${faseList}
</fase_richtlijnen>

<regels_hard categorie="MOET - geen uitzonderingen">
${hardRegels.length > 0 ? hardRegels.map(r => `- ${r.regel}${r.rationale ? ` (${r.rationale})` : ''}`).join('\n') : '- Geen hard rules geconfigureerd'}
</regels_hard>

<regels_soft categorie="BELANGRIJK - mag wijken met uitleg">
${softRegels.length > 0 ? softRegels.map(r => `- ${r.regel}${r.rationale ? ` (${r.rationale})` : ''}`).join('\n') : '- Geen soft rules geconfigureerd'}
</regels_soft>

<regels_voorkeur categorie="NICE TO HAVE">
${voorkeurRegels.length > 0 ? voorkeurRegels.map(r => `- ${r.regel}`).join('\n') : '- Geen voorkeuren geconfigureerd'}
</regels_voorkeur>

${feedback.length > 0 ? `<eerdere_feedback>
Recente feedback van planners - leer hiervan:
${feedback.map(f => `- "${f}"`).join('\n')}
</eerdere_feedback>` : ''}

${config.extra_instructies ? `<extra_instructies>
${config.extra_instructies}
</extra_instructies>` : ''}

<huidige_gebruiker>
Je praat met: ${plannerNaam}
${plannerInfo}
</huidige_gebruiker>

<kritieke_regels>
1. Gebruik ALTIJD tools om data op te zoeken - je hebt GEEN eigen kennis over Selmore data
2. Bij plannen: gebruik ALTIJD de plan_project tool, beschrijf NIET in tekst
3. NOOIT de echte planning aanpassen zonder goedkeuring
4. Vermeld ALTIJD wat je niet hebt kunnen checken
</kritieke_regels>`;
}

// ---- CLAUDE TOOLS (andere format dan OpenAI) ----

const CLAUDE_TOOLS = [
  {
    name: 'zoek_klanten',
    description: 'Zoek klanten op naam of klantnummer. Geeft klantgegevens terug inclusief planning_instructies.',
    input_schema: {
      type: 'object',
      properties: {
        zoekterm: { type: 'string', description: 'Zoekterm voor naam of klantnummer' },
      },
      required: ['zoekterm'],
    },
  },
  {
    name: 'zoek_projecten',
    description: 'Zoek projecten op projectnummer, omschrijving of status.',
    input_schema: {
      type: 'object',
      properties: {
        zoekterm: { type: 'string', description: 'Zoekterm voor projectnummer of omschrijving' },
        status: { type: 'string', description: 'Filter op status', enum: ['concept', 'vast', 'afgerond'] },
      },
    },
  },
  {
    name: 'zoek_medewerkers',
    description: 'Zoek medewerkers op naam, rol of discipline. Geeft info terug over werkuren, beschikbaarheid, rollen.',
    input_schema: {
      type: 'object',
      properties: {
        zoekterm: { type: 'string', description: 'Naam van de medewerker' },
        discipline: { type: 'string', description: 'Filter op discipline' },
      },
    },
  },
  {
    name: 'zoek_taken',
    description: 'Zoek ingeplande taken/blokken in de planning. Filter op medewerker, project of week.',
    input_schema: {
      type: 'object',
      properties: {
        werknemer_naam: { type: 'string', description: 'Naam van de medewerker' },
        project_nummer: { type: 'string', description: 'Projectnummer' },
        week_start: { type: 'string', description: 'Maandag van de week (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'zoek_meetings',
    description: 'Zoek meetings en presentaties. Filter op datumbereik.',
    input_schema: {
      type: 'object',
      properties: {
        datum_van: { type: 'string', description: 'Startdatum (YYYY-MM-DD)' },
        datum_tot: { type: 'string', description: 'Einddatum (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'zoek_verlof',
    description: 'Zoek verlof en afwezigheden van medewerkers.',
    input_schema: {
      type: 'object',
      properties: {
        werknemer_naam: { type: 'string', description: 'Naam van de medewerker' },
        datum_van: { type: 'string', description: 'Startdatum (YYYY-MM-DD)' },
        datum_tot: { type: 'string', description: 'Einddatum (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'check_beschikbaarheid',
    description: 'Check de beschikbaarheid van medewerkers voor een periode. Geeft terug hoeveel uur ze vrij hebben per dag. Gebruik dit VOORDAT je een planning maakt.',
    input_schema: {
      type: 'object',
      properties: {
        medewerkers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Namen van de medewerkers om te checken'
        },
        start_datum: { type: 'string', description: 'Startdatum (YYYY-MM-DD)' },
        eind_datum: { type: 'string', description: 'Einddatum (YYYY-MM-DD)' },
      },
      required: ['medewerkers', 'start_datum', 'eind_datum'],
    },
  },
  {
    name: 'plan_project',
    description: 'Maak een planning voorstel. VERPLICHT bij elke planning request. Analyseer eerst de toelichtingen om de juiste verdeling te bepalen.',
    input_schema: {
      type: 'object',
      properties: {
        klant_naam: { type: 'string', description: 'Naam van de klant' },
        project_naam: { type: 'string', description: 'Naam/omschrijving van het project' },
        projecttype: { type: 'string', description: 'Type project', enum: ['commercial', 'corporate', 'social', 'branded', 'internal', 'algemeen'] },
        fases: {
          type: 'array',
          description: 'Lijst van fases met medewerkers en planning. ANALYSEER de toelichting om verdeling te bepalen!',
          items: {
            type: 'object',
            properties: {
              fase_naam: { type: 'string', description: 'Naam van de fase' },
              medewerkers: { type: 'array', items: { type: 'string' }, description: 'Namen van medewerkers' },
              start_datum: { type: 'string', description: 'Startdatum (YYYY-MM-DD)' },
              duur_dagen: { type: 'number', description: 'Totaal aantal werkdagen' },
              uren_per_dag: { type: 'number', description: 'Uren per dag (default 8)' },
              verdeling: {
                type: 'string',
                description: 'Bepaal dit uit de toelichting: aaneengesloten (default), per_week (X dagen per week), laatste_week (alleen laatste week voor deadline)',
                enum: ['aaneengesloten', 'per_week', 'laatste_week']
              },
              dagen_per_week: { type: 'number', description: 'Bij per_week: hoeveel dagen per week' },
            },
            required: ['fase_naam', 'medewerkers', 'start_datum', 'duur_dagen'],
          },
        },
        deadline: { type: 'string', description: 'Deadline (YYYY-MM-DD)' },
        reasoning: { type: 'string', description: 'Leg uit WAAROM je deze verdeling kiest en welke regels je hebt toegepast' },
      },
      required: ['klant_naam', 'project_naam', 'fases', 'reasoning'],
    },
  },
  {
    name: 'stel_wijziging_voor',
    description: 'Stel een wijziging voor aan bestaande data. De gebruiker moet dit bevestigen.',
    input_schema: {
      type: 'object',
      properties: {
        tabel: {
          type: 'string',
          enum: ['klanten', 'projecten', 'medewerkers', 'taken', 'rolprofielen', 'disciplines', 'projecttypes', 'project_fases', 'beschikbaarheid_medewerkers']
        },
        id: { type: 'string', description: 'UUID of nummer van het record' },
        veld: { type: 'string', description: 'Welk veld aanpassen' },
        nieuwe_waarde: { type: 'string', description: 'De nieuwe waarde' },
        beschrijving: { type: 'string', description: 'Uitleg voor de gebruiker' },
      },
      required: ['tabel', 'id', 'veld', 'nieuwe_waarde', 'beschrijving'],
    },
  },
];

// ---- DATE HELPERS ----

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDayOfWeekNumber(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function bepaalDiscipline(faseNaam: string): string {
  const lowerNaam = faseNaam.toLowerCase();
  if (lowerNaam.includes('concept')) return 'Conceptontwikkeling';
  if (lowerNaam.includes('strateg')) return 'Strategy';
  if (lowerNaam.includes('creati')) return 'Creative team';
  if (lowerNaam.includes('product') || lowerNaam.includes('shoot')) return 'Productie';
  if (lowerNaam.includes('edit') || lowerNaam.includes('montage')) return 'Studio';
  if (lowerNaam.includes('vfx') || lowerNaam.includes('online')) return 'Studio';
  if (lowerNaam.includes('review') || lowerNaam.includes('meeting')) return 'Intern/Review';
  return 'Algemeen';
}

function isMeetingFase(faseNaam: string): boolean {
  const lowerNaam = faseNaam.toLowerCase();
  return lowerNaam.includes('presentatie') ||
         lowerNaam.includes('meeting') ||
         lowerNaam.includes('kick-off') ||
         lowerNaam.includes('kick off') ||
         lowerNaam.includes('klantmeeting') ||
         lowerNaam.includes('eindpresentatie');
}

function isFeedbackFase(faseNaam: string, urenPerDag?: number): boolean {
  const lowerNaam = faseNaam.toLowerCase();
  return lowerNaam.includes('feedback') ||
         lowerNaam.includes('review') ||
         (urenPerDag !== undefined && urenPerDag <= 2);
}

// ---- SLOT FINDER (uses config, not hardcoded!) ----

async function getBestaandeBlokken(
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

  if (error) {
    console.error('Error fetching existing blocks:', error);
    return [];
  }

  return (data || []).sort((a, b) => a.start_uur - b.start_uur);
}

function heeftConflict(
  bezet: Array<{ start_uur: number; duur_uren: number }>,
  startUur: number,
  duur: number
): boolean {
  const eindUur = startUur + duur;
  return bezet.some((blok) => {
    const blokEind = blok.start_uur + blok.duur_uren;
    return startUur < blokEind && eindUur > blok.start_uur;
  });
}

function overlapLunch(startUur: number, eindUur: number, config: PlanningConfig): boolean {
  return startUur < config.lunch_eind && eindUur > config.lunch_start;
}

async function vindEersteVrijeSlot(
  supabase: SupabaseClient,
  config: PlanningConfig,
  medewerkernaam: string,
  datum: Date,
  benodigdeUren: number
): Promise<TimeSlot | null> {
  const bezet = await getBestaandeBlokken(supabase, medewerkernaam, datum);

  // Full day block
  if (benodigdeUren >= 8) {
    const ochtendVrij = !heeftConflict(bezet, config.werkdag_start, 3.5);
    const middagVrij = !heeftConflict(bezet, 14, 4);
    if (ochtendVrij && middagVrij) {
      return { startUur: config.werkdag_start, duurUren: 9 };
    }
    return null;
  }

  // Smaller blocks
  for (let uur = config.werkdag_start; uur <= config.werkdag_eind - benodigdeUren; uur++) {
    const eindUur = uur + benodigdeUren;
    if (overlapLunch(uur, eindUur, config)) continue;
    if (!heeftConflict(bezet, uur, benodigdeUren)) {
      return { startUur: uur, duurUren: benodigdeUren };
    }
  }

  return null;
}

async function vindMeetingSlot(
  supabase: SupabaseClient,
  config: PlanningConfig,
  medewerkernaam: string,
  datum: Date,
  benodigdeUren: number
): Promise<TimeSlot | null> {
  const bezet = await getBestaandeBlokken(supabase, medewerkernaam, datum);

  for (let uur = config.meeting_start; uur <= config.meeting_eind - benodigdeUren; uur++) {
    const eindUur = uur + benodigdeUren;
    if (overlapLunch(uur, eindUur, config)) continue;
    if (!heeftConflict(bezet, uur, benodigdeUren)) {
      return { startUur: uur, duurUren: benodigdeUren };
    }
  }

  return null;
}

async function heeftVerlof(
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

async function isParttimeDag(
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
  const parttimeDag = medewerker.parttime_dag?.toLowerCase();
  return parttimeDag === dagNaam;
}

// ---- FUZZY MATCHING ----

function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  if (aLower === bLower) return 0;
  if (aLower.length === 0) return bLower.length;
  if (bLower.length === 0) return aLower.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= bLower.length; i++) matrix[i] = [i];
  for (let j = 0; j <= aLower.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      if (bLower.charAt(i - 1) === aLower.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[bLower.length][aLower.length];
}

function similarityScore(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - (distance / maxLength);
}

// deno-lint-ignore no-explicit-any
function findBestNameMatch(searchTerm: string, medewerkers: any[], threshold = 0.6): any | null {
  let bestMatch = null;
  let bestScore = 0;

  for (const m of medewerkers) {
    const naam = m.naam_werknemer || '';
    const voornaam = naam.split(' ')[0];
    const score = Math.max(similarityScore(searchTerm, naam), similarityScore(searchTerm, voornaam));
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = m;
    }
  }
  return bestMatch;
}

// ---- TOOL EXECUTION ----

function sanitize(term: string): string {
  return term.replace(/[,().\\]/g, '').substring(0, 100);
}

async function executeTool(
  supabase: SupabaseClient,
  config: PlanningConfig,
  toolName: string,
  // deno-lint-ignore no-explicit-any
  args: Record<string, any>
): Promise<string> {
  try {
    switch (toolName) {
      case 'zoek_klanten': {
        const term = sanitize(args.zoekterm || '');
        const { data, error } = await supabase
          .from('klanten')
          .select('id, klantnummer, naam, contactpersoon, email, telefoon, adres, beschikbaarheid, interne_notities, planning_instructies')
          .or(`naam.ilike.%${term}%,klantnummer.ilike.%${term}%`)
          .limit(10);
        if (error) return `Fout: ${error.message}`;
        if (!data?.length) return 'Geen klanten gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'zoek_projecten': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase
          .from('projecten')
          .select('id, projectnummer, omschrijving, projecttype, deadline, status, datum_aanvraag, opmerkingen');
        if (args.zoekterm) {
          const term = sanitize(args.zoekterm);
          query = query.or(`projectnummer.ilike.%${term}%,omschrijving.ilike.%${term}%`);
        }
        if (args.status) query = query.eq('status', args.status);
        const { data, error } = await query.order('deadline', { ascending: true }).limit(10);
        if (error) return `Fout: ${error.message}`;
        if (!data?.length) return 'Geen projecten gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'zoek_medewerkers': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase
          .from('medewerkers')
          .select('werknemer_id, naam_werknemer, primaire_rol, tweede_rol, discipline, werkuren, parttime_dag, duo_team, beschikbaar, notities');
        const zoekterm = args.zoekterm ? sanitize(args.zoekterm) : '';
        if (zoekterm) query = query.ilike('naam_werknemer', `%${zoekterm}%`);
        if (args.discipline) query = query.ilike('discipline', `%${sanitize(args.discipline)}%`);

        const { data, error } = await query.order('naam_werknemer').limit(20);
        if (error) return `Fout: ${error.message}`;

        // Fuzzy matching als geen exacte match
        if ((!data || data.length === 0) && zoekterm) {
          const { data: alleMedewerkers } = await supabase
            .from('medewerkers')
            .select('werknemer_id, naam_werknemer, primaire_rol, tweede_rol, discipline, werkuren, parttime_dag, duo_team, beschikbaar, notities')
            .order('naam_werknemer');

          if (alleMedewerkers?.length) {
            const fuzzyMatch = findBestNameMatch(zoekterm, alleMedewerkers, 0.5);
            if (fuzzyMatch) {
              return JSON.stringify({ fuzzy_match: true, bedoelde_je: fuzzyMatch.naam_werknemer, resultaat: [fuzzyMatch] }, null, 2);
            }
          }
          return `Geen medewerker gevonden met naam "${zoekterm}".`;
        }

        if (!data?.length) return 'Geen medewerkers gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'zoek_taken': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase
          .from('taken')
          .select('id, werknemer_naam, klant_naam, project_nummer, fase_naam, werktype, discipline, week_start, dag_van_week, start_uur, duur_uren, plan_status');
        if (args.werknemer_naam) query = query.ilike('werknemer_naam', `%${sanitize(args.werknemer_naam)}%`);
        if (args.project_nummer) query = query.ilike('project_nummer', `%${sanitize(args.project_nummer)}%`);
        if (args.week_start) query = query.eq('week_start', args.week_start);
        const { data, error } = await query.order('week_start', { ascending: true }).limit(20);
        if (error) return `Fout: ${error.message}`;
        if (!data?.length) return 'Geen taken gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'zoek_meetings': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase
          .from('meetings & presentaties')
          .select('datum, start_tijd, eind_tijd, onderwerp, type, locatie, deelnemers, status');
        if (args.datum_van) query = query.gte('datum', args.datum_van);
        if (args.datum_tot) query = query.lte('datum', args.datum_tot);
        const { data, error } = await query.order('datum', { ascending: true }).limit(15);
        if (error) return `Fout: ${error.message}`;
        if (!data?.length) return 'Geen meetings gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'zoek_verlof': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase
          .from('beschikbaarheid_medewerkers')
          .select('id, werknemer_naam, type, start_datum, eind_datum, reden, status');
        if (args.werknemer_naam) query = query.ilike('werknemer_naam', `%${sanitize(args.werknemer_naam)}%`);
        if (args.datum_van) query = query.gte('start_datum', args.datum_van);
        if (args.datum_tot) query = query.lte('eind_datum', args.datum_tot);
        const { data, error } = await query.order('start_datum', { ascending: true }).limit(15);
        if (error) return `Fout: ${error.message}`;
        if (!data?.length) return 'Geen verlof gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'check_beschikbaarheid': {
        const medewerkers = args.medewerkers as string[];
        const startDatum = args.start_datum;
        const eindDatum = args.eind_datum;

        if (!medewerkers?.length || !startDatum || !eindDatum) {
          return 'Ongeldige parameters: medewerkers, start_datum en eind_datum zijn verplicht.';
        }

        const resultaten: Record<string, unknown> = {};

        for (const medewerker of medewerkers) {
          const { data: blokken } = await supabase
            .from('taken')
            .select('week_start, dag_van_week, start_uur, duur_uren')
            .eq('werknemer_naam', medewerker)
            .gte('week_start', startDatum)
            .lte('week_start', eindDatum);

          const { data: verlof } = await supabase
            .from('beschikbaarheid_medewerkers')
            .select('start_datum, eind_datum, type, reden')
            .eq('werknemer_naam', medewerker)
            .eq('status', 'goedgekeurd')
            .or(`start_datum.lte.${eindDatum},eind_datum.gte.${startDatum}`);

          const totaalIngepland = (blokken || []).reduce((sum, b) => sum + b.duur_uren, 0);

          resultaten[medewerker] = {
            ingeplande_uren: totaalIngepland,
            verlof_periodes: verlof || [],
            beschikbaar: (verlof?.length || 0) === 0 ? 'Ja, geen verlof' : `Let op: ${verlof?.length} verlofperiode(s)`,
          };
        }

        return JSON.stringify({ periode: `${startDatum} t/m ${eindDatum}`, medewerkers: resultaten }, null, 2);
      }

      case 'plan_project': {
        const klantNaam = args.klant_naam;
        const projectNaam = args.project_naam;
        const projecttype = args.projecttype || 'algemeen';
        const reasoning = args.reasoning || '';
        const fases = args.fases as Array<{
          fase_naam: string;
          medewerkers: string[];
          start_datum: string;
          duur_dagen: number;
          uren_per_dag?: number;
          verdeling?: 'aaneengesloten' | 'per_week' | 'laatste_week';
          dagen_per_week?: number;
        }>;
        const deadline = args.deadline;

        if (!klantNaam || !projectNaam || !fases?.length) {
          return 'Ongeldige parameters: klant_naam, project_naam en fases zijn verplicht.';
        }

        // Zoek klant
        const { data: klant, error: klantErr } = await supabase
          .from('klanten')
          .select('id, naam, planning_instructies')
          .ilike('naam', `%${klantNaam}%`)
          .limit(1)
          .maybeSingle();

        if (klantErr || !klant) {
          return `Kon klant "${klantNaam}" niet vinden.`;
        }

        const projectNummer = `P-${Date.now().toString().slice(-6)}`;
        const taken: Array<{
          werknemer_naam: string;
          fase_naam: string;
          discipline: string;
          werktype: string;
          week_start: string;
          dag_van_week: number;
          start_uur: number;
          duur_uren: number;
        }> = [];

        const samenvattingParts: string[] = [];
        const warnings: string[] = [];
        const firstStartDate = new Date(fases[0].start_datum + 'T00:00:00');

        // Helper: plan een blok
        async function planBlok(
          medewerker: string,
          datum: Date,
          fase: typeof fases[0],
          isMeeting: boolean
        ): Promise<boolean> {
          const urenPerDag = fase.uren_per_dag || 8;
          const discipline = bepaalDiscipline(fase.fase_naam);

          const hasVerlof = await heeftVerlof(supabase, medewerker, datum);
          if (hasVerlof) {
            warnings.push(`${medewerker} heeft verlof op ${datum.toISOString().split('T')[0]}`);
            return false;
          }

          const isParttime = await isParttimeDag(supabase, medewerker, datum);
          if (isParttime) {
            warnings.push(`${medewerker} werkt niet op ${datum.toISOString().split('T')[0]} (parttime)`);
            return false;
          }

          const slot = isMeeting
            ? await vindMeetingSlot(supabase, config, medewerker, datum, urenPerDag)
            : await vindEersteVrijeSlot(supabase, config, medewerker, datum, urenPerDag);

          if (slot) {
            const weekStart = getMonday(datum);
            const dagVanWeek = getDayOfWeekNumber(datum);
            const dagNamen = ['ma', 'di', 'wo', 'do', 'vr'];
            const weekNum = Math.ceil((datum.getTime() - firstStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

            taken.push({
              werknemer_naam: medewerker,
              fase_naam: fase.fase_naam,
              discipline,
              werktype: fase.fase_naam,
              week_start: weekStart,
              dag_van_week: dagVanWeek,
              start_uur: slot.startUur,
              duur_uren: slot.duurUren,
            });

            samenvattingParts.push(`  ${medewerker}: wk${weekNum} ${dagNamen[dagVanWeek]} ${slot.startUur}:00-${slot.startUur + slot.duurUren}:00`);
            return true;
          } else {
            warnings.push(`Geen slot voor ${medewerker} op ${datum.toISOString().split('T')[0]}`);
            return false;
          }
        }

        // Process elke fase
        for (const fase of fases) {
          const verdeling = fase.verdeling || 'aaneengesloten';
          const dagenPerWeek = fase.dagen_per_week || 1;
          const isMeeting = isMeetingFase(fase.fase_naam);
          const isFeedback = isFeedbackFase(fase.fase_naam, fase.uren_per_dag);

          const faseStart = new Date(fase.start_datum + 'T00:00:00');
          samenvattingParts.push(`\n${fase.fase_naam} (${verdeling}):`);

          if (verdeling === 'laatste_week' && deadline) {
            // Plan in laatste week voor deadline
            const deadlineDate = new Date(deadline + 'T00:00:00');
            const startDate = new Date(deadlineDate);
            startDate.setDate(startDate.getDate() - 7);
            while (isWeekend(startDate) || getDayOfWeekNumber(startDate) !== 0) {
              startDate.setDate(startDate.getDate() + 1);
            }

            let dagenGepland = 0;
            let huidigeDatum = new Date(startDate);

            while (dagenGepland < fase.duur_dagen && huidigeDatum < deadlineDate) {
              while (isWeekend(huidigeDatum)) huidigeDatum.setDate(huidigeDatum.getDate() + 1);
              if (huidigeDatum >= deadlineDate) break;

              for (const medewerker of fase.medewerkers) {
                await planBlok(medewerker, huidigeDatum, fase, isMeeting);
              }
              dagenGepland++;
              huidigeDatum.setDate(huidigeDatum.getDate() + 1);
            }

          } else if (verdeling === 'per_week') {
            // Verspreid over weken
            const totaalWeken = Math.ceil(fase.duur_dagen / dagenPerWeek);
            let huidigeDatum = new Date(faseStart);
            let dagenGepland = 0;

            for (let week = 0; week < totaalWeken && dagenGepland < fase.duur_dagen; week++) {
              let dagenDezeWeek = 0;
              const weekStart = new Date(huidigeDatum);

              // Feedback: spring naar donderdag
              if (isFeedback && getDayOfWeekNumber(huidigeDatum) < 3) {
                while (getDayOfWeekNumber(huidigeDatum) !== 3) {
                  huidigeDatum.setDate(huidigeDatum.getDate() + 1);
                }
              }

              while (dagenDezeWeek < dagenPerWeek && dagenGepland < fase.duur_dagen) {
                while (isWeekend(huidigeDatum)) huidigeDatum.setDate(huidigeDatum.getDate() + 1);

                if (deadline) {
                  const deadlineDate = new Date(deadline + 'T00:00:00');
                  if (huidigeDatum >= deadlineDate) break;
                }

                for (const medewerker of fase.medewerkers) {
                  await planBlok(medewerker, huidigeDatum, fase, isMeeting);
                }

                dagenGepland++;
                dagenDezeWeek++;
                huidigeDatum.setDate(huidigeDatum.getDate() + 1);
              }

              // Volgende week
              huidigeDatum = new Date(weekStart);
              huidigeDatum.setDate(huidigeDatum.getDate() + 7);
              if (isFeedback) {
                while (isWeekend(huidigeDatum) || getDayOfWeekNumber(huidigeDatum) !== 3) {
                  huidigeDatum.setDate(huidigeDatum.getDate() + 1);
                }
              } else {
                while (isWeekend(huidigeDatum) || getDayOfWeekNumber(huidigeDatum) !== 0) {
                  huidigeDatum.setDate(huidigeDatum.getDate() + 1);
                }
              }
            }

          } else {
            // Aaneengesloten
            let huidigeDatum = new Date(faseStart);
            let dagenGepland = 0;

            while (dagenGepland < fase.duur_dagen) {
              while (isWeekend(huidigeDatum)) huidigeDatum.setDate(huidigeDatum.getDate() + 1);

              if (deadline) {
                const deadlineDate = new Date(deadline + 'T00:00:00');
                if (huidigeDatum >= deadlineDate) {
                  warnings.push(`${fase.fase_naam}: Niet alle dagen passen voor deadline`);
                  break;
                }
              }

              for (const medewerker of fase.medewerkers) {
                await planBlok(medewerker, huidigeDatum, fase, isMeeting);
              }

              dagenGepland++;
              huidigeDatum.setDate(huidigeDatum.getDate() + 1);
            }
          }
        }

        // Build samenvatting
        let samenvatting = samenvattingParts.join('\n');
        if (reasoning) {
          samenvatting = `Ellen's redenering:\n${reasoning}\n\nPlanning:${samenvatting}`;
        }
        if (warnings.length > 0) {
          samenvatting += '\n\nLet op:\n' + warnings.map(w => `- ${w}`).join('\n');
        }
        if (klant.planning_instructies) {
          samenvatting += `\n\nKlant instructies (${klant.naam}):\n${klant.planning_instructies}`;
        }

        return JSON.stringify({
          type: 'planning_voorstel',
          klant_naam: klant.naam,
          klant_id: klant.id,
          project_nummer: projectNummer,
          project_omschrijving: projectNaam,
          projecttype,
          deadline: deadline || null,
          aantal_taken: taken.length,
          taken,
          samenvatting,
          planning_instructies: klant.planning_instructies || null,
          fases: fases.map(f => ({
            fase_naam: f.fase_naam,
            medewerkers: f.medewerkers,
            start_datum: f.start_datum,
            duur_dagen: f.duur_dagen,
            uren_per_dag: f.uren_per_dag || 8,
            verdeling: f.verdeling || 'aaneengesloten',
          })),
        });
      }

      case 'stel_wijziging_voor': {
        return JSON.stringify({
          type: 'voorstel',
          tabel: args.tabel,
          id: args.id,
          veld: args.veld,
          nieuwe_waarde: args.nieuwe_waarde,
          beschrijving: args.beschrijving,
        });
      }

      default:
        return `Onbekende tool: ${toolName}`;
    }
  } catch (err) {
    return `Fout bij ${toolName}: ${(err as Error).message}`;
  }
}

// ---- WIJZIGING UITVOEREN ----

const WIJZIG_VELDEN: Record<string, string[]> = {
  klanten: ['naam', 'contactpersoon', 'email', 'telefoon', 'adres', 'beschikbaarheid', 'interne_notities', 'planning_instructies'],
  projecten: ['omschrijving', 'deadline', 'status', 'opmerkingen', 'projecttype'],
  medewerkers: ['naam_werknemer', 'primaire_rol', 'tweede_rol', 'discipline', 'werkuren', 'parttime_dag', 'notities', 'beschikbaar'],
  taken: ['werknemer_naam', 'week_start', 'dag_van_week', 'start_uur', 'duur_uren', 'plan_status'],
  rolprofielen: ['rol_naam', 'beschrijving_rol', 'taken_rol', 'standaard_discipline'],
  disciplines: ['discipline_naam', 'beschrijving', 'kleur_hex'],
  projecttypes: ['code', 'naam', 'omschrijving'],
  project_fases: ['fase_naam', 'fase_type', 'volgorde', 'start_datum', 'eind_datum', 'datum_tijd', 'locatie', 'medewerkers', 'inspanning_dagen', 'opmerkingen', 'is_hard_lock'],
  beschikbaarheid_medewerkers: ['werknemer_naam', 'type', 'start_datum', 'eind_datum', 'reden', 'status'],
};

const ID_KOLOM: Record<string, string> = {
  klanten: 'id',
  projecten: 'id',
  medewerkers: 'werknemer_id',
  taken: 'id',
  rolprofielen: 'rol_nummer',
  disciplines: 'id',
  projecttypes: 'id',
  project_fases: 'id',
  beschikbaarheid_medewerkers: 'id',
};

async function executeWijziging(
  supabase: SupabaseClient,
  tabel: string,
  id: string,
  veld: string,
  waarde: string
): Promise<{ success: boolean; message: string }> {
  if (!WIJZIG_VELDEN[tabel]) return { success: false, message: `Onbekende tabel: ${tabel}` };
  if (!WIJZIG_VELDEN[tabel].includes(veld)) return { success: false, message: `Veld '${veld}' mag niet worden aangepast` };

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const isNumber = /^\d+$/.test(id);
  if (!isUuid && !isNumber) return { success: false, message: 'Ongeldig ID formaat' };

  const idKolom = ID_KOLOM[tabel];
  const idValue = isNumber ? parseInt(id, 10) : id;

  try {
    const { error } = await supabase.from(tabel).update({ [veld]: waarde }).eq(idKolom, idValue);
    if (error) return { success: false, message: `Database fout: ${error.message}` };
    return { success: true, message: `${veld} is bijgewerkt.` };
  } catch (err) {
    return { success: false, message: `Fout: ${(err as Error).message}` };
  }
}

// ---- MAIN HANDLER ----

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify session
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Niet geautoriseerd' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const session = await verifySessionToken(authHeader.replace('Bearer ', ''));
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Ongeldige of verlopen sessie' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse request
    const body = await req.json();
    const { sessie_id, bericht, actie, tabel, id, veld, nieuwe_waarde, project_data } = body;
    if (!sessie_id) {
      return new Response(
        JSON.stringify({ error: 'sessie_id is verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 2b. Laad-modus
    if (actie === 'laden') {
      const { data: berichten } = await supabase
        .from('chat_gesprekken')
        .select('rol, inhoud, created_at')
        .eq('sessie_id', sessie_id)
        .order('created_at', { ascending: true })
        .limit(50);
      return new Response(
        JSON.stringify({ berichten: berichten || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2b2. Feedback opslaan
    if (actie === 'feedback_opslaan') {
      const { feedback, context } = body;
      if (feedback) {
        try {
          await supabase.from('ellen_feedback').insert({
            gebruiker_naam: session.naam,
            feedback_tekst: feedback,
            context_data: context ? JSON.stringify(context) : null,
          });
        } catch { /* ignore */ }
      }
      return new Response(
        JSON.stringify({ success: true, message: 'Feedback opgeslagen' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2c. Uitvoeren wijziging
    if (actie === 'uitvoeren') {
      if (!tabel || !id || !veld || nieuwe_waarde === undefined) {
        return new Response(
          JSON.stringify({ error: 'Ontbrekende velden' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const result = await executeWijziging(supabase, tabel, id, veld, nieuwe_waarde);
      return new Response(
        JSON.stringify(result),
        { status: result.success ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2d. Plannen
    if (actie === 'plannen') {
      const planning = body.planning;
      const gekozenWerktype = body.werktype;

      if (!planning || !planning.taken?.length) {
        return new Response(
          JSON.stringify({ success: false, message: 'Geen planning data' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Zoek klant
      const { data: klant } = await supabase
        .from('klanten')
        .select('id')
        .ilike('naam', `%${planning.klant_naam}%`)
        .limit(1)
        .maybeSingle();

      if (!klant) {
        return new Response(
          JSON.stringify({ success: false, message: `Klant "${planning.klant_naam}" niet gevonden` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Maak project
      const projectNummer = planning.project_nummer || `P-${Date.now().toString().slice(-6)}`;
      const { data: project, error: projectErr } = await supabase
        .from('projecten')
        .insert({
          klant_id: klant.id,
          projectnummer: projectNummer,
          omschrijving: planning.project_omschrijving || planning.klant_naam,
          projecttype: planning.projecttype || 'algemeen',
          deadline: planning.deadline,
          status: 'concept',
          datum_aanvraag: new Date().toISOString().split('T')[0],
          volgnummer: Date.now() % 10000,
        })
        .select('id, projectnummer')
        .single();

      if (projectErr || !project) {
        return new Response(
          JSON.stringify({ success: false, message: `Kon project niet aanmaken` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Maak taken
      let aantalGeplaatst = 0;
      const werktype = gekozenWerktype || 'concept';
      const werktypeLabels: Record<string, string> = {
        concept: 'Conceptontwikkeling',
        uitwerking: 'Conceptuitwerking',
        productie: 'Productie',
        extern: 'Meeting met klant',
        review: 'Interne review',
      };
      const faseLabel = werktypeLabels[werktype] || werktype;
      const projectTitel = planning.project_omschrijving || planning.klant_naam;

      for (const taak of planning.taken) {
        const { error } = await supabase.from('taken').insert({
          project_id: project.id,
          werknemer_naam: taak.werknemer_naam,
          klant_naam: planning.klant_naam,
          project_nummer: project.projectnummer,
          project_titel: projectTitel,
          fase_naam: faseLabel,
          werktype,
          discipline: taak.discipline || 'Algemeen',
          week_start: taak.week_start,
          dag_van_week: taak.dag_van_week,
          start_uur: taak.start_uur,
          duur_uren: taak.duur_uren,
          plan_status: 'concept',
          is_hard_lock: false,
        });
        if (!error) aantalGeplaatst++;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Planning "${project.projectnummer}" aangemaakt met ${aantalGeplaatst} blokken`,
          project_id: project.id,
          project_nummer: project.projectnummer,
          aantal_blokken: aantalGeplaatst,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Chat modus
    if (!bericht) {
      return new Response(
        JSON.stringify({ error: 'bericht is verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Laad alles parallel
    const [planningConfig, ellenRegels, recentFeedback, plannerInfo] = await Promise.all([
      loadPlanningConfig(supabase),
      loadEllenRegels(supabase),
      loadRecentFeedback(supabase),
      supabase
        .from('medewerkers')
        .select('naam_werknemer, primaire_rol, tweede_rol, discipline, werkuren, parttime_dag')
        .ilike('naam_werknemer', `%${session.naam}%`)
        .limit(1)
        .maybeSingle(),
    ]);

    // Bouw planner context
    let plannerInfoStr = '';
    const medewerker = plannerInfo.data;
    if (medewerker) {
      const parts = [`Rol: ${medewerker.primaire_rol}`];
      if (medewerker.tweede_rol) parts.push(`Tweede rol: ${medewerker.tweede_rol}`);
      if (medewerker.discipline) parts.push(`Discipline: ${medewerker.discipline}`);
      if (medewerker.werkuren) parts.push(`Werkuren: ${medewerker.werkuren}u/week`);
      if (medewerker.parttime_dag) parts.push(`Parttime: ${medewerker.parttime_dag}`);
      plannerInfoStr = parts.join('. ');
    }

    // Bouw system prompt
    const systemPrompt = buildSystemPrompt(
      planningConfig,
      ellenRegels,
      recentFeedback,
      session.naam,
      plannerInfoStr
    );

    // 5. Load chat history
    let historyMessages: Array<{ rol: string; inhoud: string }> = [];
    try {
      const { data: history } = await supabase
        .from('chat_gesprekken')
        .select('rol, inhoud')
        .eq('sessie_id', sessie_id)
        .order('created_at', { ascending: true })
        .limit(30);
      if (history) historyMessages = history;
    } catch { /* ignore */ }

    // 6. Save user message
    try {
      await supabase.from('chat_gesprekken').insert({
        sessie_id,
        rol: 'user',
        inhoud: bericht,
      });
    } catch { /* ignore */ }

    // 7. Build Claude messages
    // deno-lint-ignore no-explicit-any
    const claudeMessages: any[] = [];
    for (const msg of historyMessages) {
      const cleanContent = msg.inhoud.replace(/\n*\[VOORSTEL:\{.*?\}\]/gs, '').trim();
      if (cleanContent) {
        claudeMessages.push({
          role: msg.rol === 'user' ? 'user' : 'assistant',
          content: cleanContent,
        });
      }
    }
    // Pre-fetch data for project planning to avoid tool-call timeouts
    let prefetchedContext = '';
    if (project_data) {
      console.log('Pre-fetching data for project planning...');
      const { medewerkers: mwNames, klant_naam, start_datum, eind_datum } = project_data;
      
      const prefetchParts: string[] = [];
      
      // Fetch klant info
      if (klant_naam) {
        const { data: klantData } = await supabase
          .from('klanten')
          .select('id, klantnummer, naam, contactpersoon, planning_instructies')
          .ilike('naam', `%${klant_naam}%`)
          .limit(1)
          .maybeSingle();
        if (klantData) {
          prefetchParts.push(`\n--- PRE-LOADED: KLANT INFO ---\n${JSON.stringify(klantData, null, 2)}`);
        }
      }

      // Fetch medewerker info
      if (mwNames?.length) {
        const { data: mwData } = await supabase
          .from('medewerkers')
          .select('werknemer_id, naam_werknemer, primaire_rol, tweede_rol, discipline, werkuren, parttime_dag, duo_team, beschikbaar, notities')
          .in('naam_werknemer', mwNames);
        if (mwData?.length) {
          prefetchParts.push(`\n--- PRE-LOADED: MEDEWERKER INFO ---\n${JSON.stringify(mwData, null, 2)}`);
        }

        // Fetch beschikbaarheid (taken + verlof) for each medewerker
        if (start_datum && eind_datum) {
          const beschikbaarheid: Record<string, unknown> = {};
          for (const mw of mwNames) {
            const [takenRes, verlofRes] = await Promise.all([
              supabase.from('taken')
                .select('week_start, dag_van_week, start_uur, duur_uren, klant_naam, project_nummer')
                .eq('werknemer_naam', mw)
                .gte('week_start', start_datum)
                .lte('week_start', eind_datum),
              supabase.from('beschikbaarheid_medewerkers')
                .select('start_datum, eind_datum, type, reden')
                .eq('werknemer_naam', mw)
                .eq('status', 'goedgekeurd')
                .or(`start_datum.lte.${eind_datum},eind_datum.gte.${start_datum}`),
            ]);
            
            const totaalIngepland = (takenRes.data || []).reduce((sum: number, b: { duur_uren: number }) => sum + b.duur_uren, 0);
            beschikbaarheid[mw] = {
              ingeplande_uren: totaalIngepland,
              bestaande_taken: takenRes.data || [],
              verlof_periodes: verlofRes.data || [],
            };
          }
          prefetchParts.push(`\n--- PRE-LOADED: BESCHIKBAARHEID (${start_datum} t/m ${eind_datum}) ---\n${JSON.stringify(beschikbaarheid, null, 2)}`);
        }
      }

      if (prefetchParts.length > 0) {
        prefetchedContext = '\n\n=== DATA IS AL OPGEHAALD - GEBRUIK GEEN zoek_taken, check_beschikbaarheid of zoek_klanten TOOLS ===\n' +
          'Alle benodigde data staat hieronder. Ga DIRECT naar plan_project.\n' +
          prefetchParts.join('\n');
      }
    }

    claudeMessages.push({ role: 'user', content: bericht + prefetchedContext });

    // 8. Check API key
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY niet geconfigureerd. Stel dit in als Supabase secret.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 9. Call Claude with tool loop
    let assistantMessage = '';
    // deno-lint-ignore no-explicit-any
    let pendingVoorstel: any = null;
    // deno-lint-ignore no-explicit-any
    let currentMessages = [...claudeMessages];

    const maxIterations = project_data ? 3 : 5;
    for (let i = 0; i < maxIterations; i++) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: currentMessages,
          tools: CLAUDE_TOOLS,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Claude API error:', errText);
        return new Response(
          JSON.stringify({ error: 'Fout bij communicatie met AI' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();

      // Check stop reason
      if (data.stop_reason === 'end_turn') {
        // Extract text from content blocks
        for (const block of data.content || []) {
          if (block.type === 'text') {
            assistantMessage = block.text;
          }
        }
        break;
      }

      // Check for tool use
      if (data.stop_reason === 'tool_use') {
        // Add assistant message to context
        currentMessages.push({ role: 'assistant', content: data.content });

        // Execute each tool
        const toolResults = [];
        for (const block of data.content || []) {
          if (block.type === 'tool_use') {
            const result = await executeTool(supabase, planningConfig, block.name, block.input);

            // Check for voorstel
            if (block.name === 'stel_wijziging_voor' || block.name === 'plan_project') {
              try {
                const parsed = JSON.parse(result);
                if (parsed.type === 'voorstel' || parsed.type === 'planning_voorstel') {
                  pendingVoorstel = parsed;
                }
              } catch { /* ignore */ }
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        // Add tool results to context
        currentMessages.push({ role: 'user', content: toolResults });
      } else {
        // Unknown stop reason, extract any text and break
        for (const block of data.content || []) {
          if (block.type === 'text') {
            assistantMessage = block.text;
          }
        }
        break;
      }
    }

    // 10. Save assistant response
    const opslaan = pendingVoorstel
      ? `${assistantMessage}\n\n[VOORSTEL:${JSON.stringify(pendingVoorstel)}]`
      : assistantMessage;
    try {
      await supabase.from('chat_gesprekken').insert({
        sessie_id,
        rol: 'assistant',
        inhoud: opslaan,
      });
    } catch { /* ignore */ }

    // 11. Return response
    const cleanAntwoord = assistantMessage.replace(/\n*\[VOORSTEL:\{.*?\}\]/gs, '').trim();
    return new Response(
      JSON.stringify({ antwoord: cleanAntwoord, voorstel: pendingVoorstel }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Ellen chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Er is een fout opgetreden bij Ellen' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
