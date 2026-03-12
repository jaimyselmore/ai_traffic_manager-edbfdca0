// Ellen AI Chat - Supabase Edge Function
// Architectuur: OpenRouter API (OpenAI-compatible) + Haiku router + tool-gating per modus
// VEREISTE SUPABASE SECRET: OPENROUTER_API_KEY (vervang ANTHROPIC_API_KEY)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { verify } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAIN_MODEL = 'anthropic/claude-sonnet-4-5';
const ROUTER_MODEL = 'anthropic/claude-haiku-4-5';

// ===== SECTION 1: JWT VERIFICATION =====

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

// ===== SECTION 2: TYPES & CONFIG =====

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

type Intent = 'CHAT' | 'PLAN' | 'QUERY';

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

// ===== SECTION 3: DATA LOADERS =====

async function loadPlanningConfig(supabase: SupabaseClient): Promise<PlanningConfig> {
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

async function loadEllenRegels(supabase: SupabaseClient): Promise<EllenRegel[]> {
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

// ===== SECTION 4: PROMPT BUILDERS =====

function formatTime(decimal: number): string {
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Vaste kern — altijd geladen, kort en scherp
const CORE_PROMPT = `Je bent Ellen, Traffic Manager AI bij Selmore (creatief video productiebedrijf).
Spreek informeel, direct en oplossingsgericht. Geen wollige taal, geen emoji's tenzij gevraagd.

HARDE GEDRAGSREGELS (altijd, geen uitzonderingen):
1. Geen claim of aanname zonder tool-output of meegeleverde data
2. Mutaties uitsluitend via tools — nooit gissen of verzinnen
3. Hard-locked taken: alleen eigenaar mag wijzigen
4. Bij onduidelijkheid: één gerichte vraag stellen, niet raden
5. Vermeld altijd wat je NIET hebt kunnen checken (bijv. Microsoft agenda's)`;

// CHAT modus — snelle wijzigingen aan bestaande planning
function buildChatPrompt(config: PlanningConfig, regels: EllenRegel[], plannerNaam: string): string {
  const hardRegels = regels.filter(r => r.categorie === 'hard');
  return `${CORE_PROMPT}

MODUS: DIRECTE CHAT WIJZIGINGEN
Je helpt met snelle aanpassingen aan de bestaande planning.

Werkwijze (volg exact):
1. Zoek de taak op met zoek_taken
2. Voer de wijziging direct uit (wijzig_taak / verwijder_taak / voeg_taak_toe)
3. Bevestig bondig wat je gedaan hebt

Werkuren: ${formatTime(config.werkdag_start)}-${formatTime(config.werkdag_eind)}, lunch ${formatTime(config.lunch_start)}-${formatTime(config.lunch_eind)}
${hardRegels.length > 0 ? `\nProject-specifieke regels:\n${hardRegels.map(r => `- ${r.regel}`).join('\n')}` : ''}

Je praat met: ${plannerNaam}`;
}

// PLAN modus — nieuw project inplannen
function buildPlanPrompt(
  config: PlanningConfig,
  regels: EllenRegel[],
  feedback: string[],
  plannerNaam: string,
  plannerInfo: string
): string {
  const hardRegels = regels.filter(r => r.categorie === 'hard');
  const softRegels = regels.filter(r => r.categorie === 'soft');
  const voorkeurRegels = regels.filter(r => r.categorie === 'voorkeur');
  const faseList = config.fase_templates
    .map(f => `  - ${f.naam}: ${f.min_dagen}-${f.max_dagen} dagen${f.omschrijving ? ` (${f.omschrijving})` : ''}`)
    .join('\n');

  return `${CORE_PROMPT}

MODUS: PROJECT PLANNING
Je maakt een planning voorstel voor een nieuw project.

STAPPENPLAN (volg exact in deze volgorde):

Stap 1 — Toelichtingen analyseren
Citeer elke toelichting letterlijk en bepaal de verdeling:
- "1 dag per week" / "wekelijks" / "doorlopend" → verdeling=per_week
- "laatste week" / "finishing touches" / "afronding" / "vlak voor deadline" → verdeling=laatste_week
- Leeg / "fulltime" / geen timing → verdeling=aaneengesloten
Schrijf per fase op: "Fase X: toelichting 'Y' → verdeling=Z, want [reden]"

Stap 2 — PRE-LOADED data gebruiken
Bekijk de meegeleverde data. Noteer:
- Welke projecten medewerkers al hebben (deadline-vergelijking)
- Project met EERDERE deadline heeft voorrang
- Conflicten: medewerker al vol gepland?

Stap 3 — plan_project aanroepen
Gebruik ALTIJD plan_project met de correcte verdeling per fase.
In 'reasoning': leg uit welke keuzes je gemaakt hebt en waarom.
Feedback/review-fases: plan bij voorkeur op donderdag of vrijdag.

Stap 4 — Risico's melden
Noem expliciet: deadline te krap? medewerker overbelast? Microsoft agenda niet gekoppeld?

WERKTIJDEN:
- Werkdag: ${formatTime(config.werkdag_start)}-${formatTime(config.werkdag_eind)}
- Lunch: ${formatTime(config.lunch_start)}-${formatTime(config.lunch_eind)} (geen werk)
- Meetings: bij voorkeur ${formatTime(config.meeting_start)}-${formatTime(config.meeting_eind)}

FASE-RICHTLIJNEN:
${faseList}

REGELS:
Hard (geen uitzonderingen): ${hardRegels.length > 0 ? hardRegels.map(r => `${r.regel}${r.rationale ? ` (${r.rationale})` : ''}`).join(' | ') : 'geen geconfigureerd'}
Soft (uitleg bij afwijking): ${softRegels.length > 0 ? softRegels.map(r => r.regel).join(' | ') : 'geen geconfigureerd'}
Voorkeur: ${voorkeurRegels.length > 0 ? voorkeurRegels.map(r => r.regel).join(' | ') : 'geen geconfigureerd'}
${feedback.length > 0 ? `\nEerdere feedback van planners:\n${feedback.map(f => `- "${f}"`).join('\n')}` : ''}
${config.extra_instructies ? `\nExtra instructies:\n${config.extra_instructies}` : ''}

Je praat met: ${plannerNaam}${plannerInfo ? `\n${plannerInfo}` : ''}`;
}

// QUERY modus — informatie opvragen
function buildQueryPrompt(plannerNaam: string): string {
  return `${CORE_PROMPT}

MODUS: INFORMATIE OPVRAGEN
Je helpt met het zoeken en samenvatten van planningsinformatie.

Werkwijze:
1. Gebruik de beschikbare zoek-tools om de gevraagde info op te halen
2. Presenteer het resultaat duidelijk en beknopt
3. Zie je iets opvallends (conflict, risico, overbelasting)? Meld het proactief.

Je praat met: ${plannerNaam}`;
}

// ===== SECTION 5: TOOL DEFINITIONS (OpenAI-compatible format) =====

// deno-lint-ignore no-explicit-any
const ALL_TOOLS: any[] = [
  {
    type: 'function',
    function: {
      name: 'zoek_klanten',
      description: 'Zoek klanten op naam of klantnummer. Geeft klantgegevens terug inclusief planning_instructies.',
      parameters: {
        type: 'object',
        properties: {
          zoekterm: { type: 'string', description: 'Zoekterm voor naam of klantnummer' },
        },
        required: ['zoekterm'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'zoek_projecten',
      description: 'Zoek projecten op projectnummer, omschrijving of status.',
      parameters: {
        type: 'object',
        properties: {
          zoekterm: { type: 'string', description: 'Zoekterm voor projectnummer of omschrijving' },
          status: { type: 'string', description: 'Filter op status', enum: ['concept', 'vast', 'afgerond'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'zoek_medewerkers',
      description: 'Zoek medewerkers op naam, rol of discipline. Geeft info over werkuren, rollen en beschikbaarheid.',
      parameters: {
        type: 'object',
        properties: {
          zoekterm: { type: 'string', description: 'Naam van de medewerker' },
          discipline: { type: 'string', description: 'Filter op discipline' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'zoek_taken',
      description: 'Zoek ingeplande taken in de planning. Filter op medewerker, project of week.',
      parameters: {
        type: 'object',
        properties: {
          werknemer_naam: { type: 'string', description: 'Naam van de medewerker' },
          project_nummer: { type: 'string', description: 'Projectnummer' },
          week_start: { type: 'string', description: 'Maandag van de week (YYYY-MM-DD)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'zoek_meetings',
      description: 'Zoek meetings en presentaties. Filter op datumbereik.',
      parameters: {
        type: 'object',
        properties: {
          datum_van: { type: 'string', description: 'Startdatum (YYYY-MM-DD)' },
          datum_tot: { type: 'string', description: 'Einddatum (YYYY-MM-DD)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'zoek_verlof',
      description: 'Zoek verlof en afwezigheden van medewerkers.',
      parameters: {
        type: 'object',
        properties: {
          werknemer_naam: { type: 'string', description: 'Naam van de medewerker' },
          datum_van: { type: 'string', description: 'Startdatum (YYYY-MM-DD)' },
          datum_tot: { type: 'string', description: 'Einddatum (YYYY-MM-DD)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_beschikbaarheid',
      description: 'Check de beschikbaarheid van medewerkers voor een periode. Geeft ingeplande uren en verlofperiodes terug.',
      parameters: {
        type: 'object',
        properties: {
          medewerkers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Namen van de medewerkers om te checken',
          },
          start_datum: { type: 'string', description: 'Startdatum (YYYY-MM-DD)' },
          eind_datum: { type: 'string', description: 'Einddatum (YYYY-MM-DD)' },
        },
        required: ['medewerkers', 'start_datum', 'eind_datum'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'plan_project',
      description: 'Maak een planning voorstel. VERPLICHT bij elke planning request. Analyseer eerst de toelichtingen voor de juiste verdeling.',
      parameters: {
        type: 'object',
        properties: {
          klant_naam: { type: 'string', description: 'Naam van de klant' },
          project_naam: { type: 'string', description: 'Naam/omschrijving van het project' },
          projecttype: { type: 'string', description: 'Type project', enum: ['commercial', 'corporate', 'social', 'branded', 'internal', 'algemeen'] },
          fases: {
            type: 'array',
            description: 'Lijst van fases. Bepaal verdeling uit de toelichting!',
            items: {
              type: 'object',
              properties: {
                fase_naam: { type: 'string' },
                medewerkers: { type: 'array', items: { type: 'string' } },
                start_datum: { type: 'string', description: 'YYYY-MM-DD' },
                duur_dagen: { type: 'number' },
                uren_per_dag: { type: 'number', description: 'Uren per dag (default 8)' },
                verdeling: {
                  type: 'string',
                  description: 'Bepaal uit toelichting: aaneengesloten (default), per_week, laatste_week',
                  enum: ['aaneengesloten', 'per_week', 'laatste_week'],
                },
                dagen_per_week: { type: 'number', description: 'Bij per_week: aantal dagen per week' },
              },
              required: ['fase_naam', 'medewerkers', 'start_datum', 'duur_dagen'],
            },
          },
          deadline: { type: 'string', description: 'Deadline (YYYY-MM-DD)' },
          reasoning: { type: 'string', description: 'Leg uit WAAROM je deze keuzes maakt (toelichtingen, conflicten, regels)' },
        },
        required: ['klant_naam', 'project_naam', 'fases', 'reasoning'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stel_wijziging_voor',
      description: 'Stel een wijziging voor aan bestaande data. De gebruiker moet dit bevestigen.',
      parameters: {
        type: 'object',
        properties: {
          tabel: {
            type: 'string',
            enum: ['klanten', 'projecten', 'medewerkers', 'taken', 'rolprofielen', 'disciplines', 'projecttypes', 'project_fases', 'beschikbaarheid_medewerkers'],
          },
          id: { type: 'string', description: 'UUID of nummer van het record' },
          veld: { type: 'string', description: 'Welk veld aanpassen' },
          nieuwe_waarde: { type: 'string', description: 'De nieuwe waarde' },
          beschrijving: { type: 'string', description: 'Uitleg voor de gebruiker' },
        },
        required: ['tabel', 'id', 'veld', 'nieuwe_waarde', 'beschrijving'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'wijzig_taak',
      description: 'Wijzig een bestaande taak in de planning DIRECT (geen voorstel). Gebruik vanuit chat om taken te verplaatsen of aan te passen.',
      parameters: {
        type: 'object',
        properties: {
          taak_id: { type: 'string', description: 'UUID van de taak' },
          nieuwe_waarden: {
            type: 'object',
            description: 'De velden die je wilt wijzigen',
            properties: {
              werknemer_naam: { type: 'string' },
              week_start: { type: 'string', description: 'YYYY-MM-DD (maandag)' },
              dag_van_week: { type: 'number', description: '0=ma, 1=di, 2=wo, 3=do, 4=vr' },
              start_uur: { type: 'number', description: 'Startuur (9-18)' },
              duur_uren: { type: 'number' },
              fase_naam: { type: 'string' },
              plan_status: { type: 'string', enum: ['concept', 'vast', 'wacht_klant'] },
            },
          },
          reden: { type: 'string', description: 'Korte uitleg waarom' },
        },
        required: ['taak_id', 'nieuwe_waarden', 'reden'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verwijder_taak',
      description: 'Verwijder een taak uit de planning DIRECT (geen voorstel).',
      parameters: {
        type: 'object',
        properties: {
          taak_id: { type: 'string', description: 'UUID van de taak' },
          reden: { type: 'string', description: 'Korte uitleg waarom' },
        },
        required: ['taak_id', 'reden'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'voeg_taak_toe',
      description: 'Voeg een nieuwe taak toe aan de planning DIRECT (geen voorstel).',
      parameters: {
        type: 'object',
        properties: {
          werknemer_naam: { type: 'string' },
          klant_naam: { type: 'string' },
          project_nummer: { type: 'string', description: 'Optioneel, wordt gegenereerd als leeg' },
          project_titel: { type: 'string' },
          fase_naam: { type: 'string' },
          werktype: { type: 'string', enum: ['concept', 'uitwerking', 'productie', 'extern', 'review'] },
          week_start: { type: 'string', description: 'YYYY-MM-DD (maandag)' },
          dag_van_week: { type: 'number', description: '0=ma, 1=di, 2=wo, 3=do, 4=vr' },
          start_uur: { type: 'number', description: 'Startuur (9-18)' },
          duur_uren: { type: 'number' },
          plan_status: { type: 'string', enum: ['concept', 'vast', 'wacht_klant'] },
          reden: { type: 'string' },
        },
        required: ['werknemer_naam', 'klant_naam', 'project_titel', 'fase_naam', 'week_start', 'dag_van_week', 'start_uur', 'duur_uren', 'reden'],
      },
    },
  },
];

// Tool-sets per modus (gating)
const TOOL_NAMES: Record<Intent, string[]> = {
  CHAT: ['zoek_klanten', 'zoek_taken', 'wijzig_taak', 'verwijder_taak', 'voeg_taak_toe'],
  PLAN: ['zoek_klanten', 'zoek_projecten', 'zoek_medewerkers', 'check_beschikbaarheid', 'plan_project', 'stel_wijziging_voor'],
  QUERY: ['zoek_klanten', 'zoek_projecten', 'zoek_medewerkers', 'zoek_taken', 'zoek_meetings', 'zoek_verlof'],
};

// deno-lint-ignore no-explicit-any
function getToolsForIntent(intent: Intent): any[] {
  const names = TOOL_NAMES[intent];
  return ALL_TOOLS.filter(t => names.includes(t.function.name));
}

// ===== SECTION 6: PLANNING ENGINE =====

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
  const n = faseNaam.toLowerCase();
  if (n.includes('concept')) return 'Conceptontwikkeling';
  if (n.includes('strateg')) return 'Strategy';
  if (n.includes('creati')) return 'Creative team';
  if (n.includes('product') || n.includes('shoot')) return 'Productie';
  if (n.includes('edit') || n.includes('montage') || n.includes('vfx') || n.includes('online')) return 'Studio';
  if (n.includes('review') || n.includes('meeting')) return 'Intern/Review';
  return 'Algemeen';
}

function isMeetingFase(faseNaam: string): boolean {
  const n = faseNaam.toLowerCase();
  return n.includes('presentatie') || n.includes('meeting') || n.includes('kick-off') ||
    n.includes('kick off') || n.includes('klantmeeting') || n.includes('eindpresentatie');
}

function isFeedbackFase(faseNaam: string, urenPerDag?: number): boolean {
  const n = faseNaam.toLowerCase();
  return n.includes('feedback') || n.includes('review') || (urenPerDag !== undefined && urenPerDag <= 2);
}

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
  if (error) return [];
  return (data || []).sort((a: { start_uur: number }, b: { start_uur: number }) => a.start_uur - b.start_uur);
}

function heeftConflict(bezet: Array<{ start_uur: number; duur_uren: number }>, startUur: number, duur: number): boolean {
  const eindUur = startUur + duur;
  return bezet.some(blok => startUur < blok.start_uur + blok.duur_uren && eindUur > blok.start_uur);
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
    const eindUur = uur + benodigdeUren;
    if (overlapLunch(uur, eindUur, config)) continue;
    if (!heeftConflict(bezet, uur, benodigdeUren)) return { startUur: uur, duurUren: benodigdeUren };
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
    if (!heeftConflict(bezet, uur, benodigdeUren)) return { startUur: uur, duurUren: benodigdeUren };
  }
  return null;
}

async function heeftVerlof(supabase: SupabaseClient, medewerkernaam: string, datum: Date): Promise<boolean> {
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

async function isParttimeDag(supabase: SupabaseClient, medewerkernaam: string, datum: Date): Promise<boolean> {
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

// Fuzzy matching
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
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

// deno-lint-ignore no-explicit-any
function findBestNameMatch(searchTerm: string, medewerkers: any[], threshold = 0.6): any | null {
  let bestMatch = null, bestScore = 0;
  for (const m of medewerkers) {
    const naam = m.naam_werknemer || '';
    const voornaam = naam.split(' ')[0];
    const score = Math.max(similarityScore(searchTerm, naam), similarityScore(searchTerm, voornaam));
    if (score > bestScore && score >= threshold) { bestScore = score; bestMatch = m; }
  }
  return bestMatch;
}

// ===== SECTION 7: TOOL EXECUTION =====

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
        if (args.zoekterm) query = query.or(`projectnummer.ilike.%${sanitize(args.zoekterm)}%,omschrijving.ilike.%${sanitize(args.zoekterm)}%`);
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

        if ((!data || data.length === 0) && zoekterm) {
          const { data: allen } = await supabase
            .from('medewerkers')
            .select('werknemer_id, naam_werknemer, primaire_rol, tweede_rol, discipline, werkuren, parttime_dag, duo_team, beschikbaar, notities')
            .order('naam_werknemer');
          if (allen?.length) {
            const fuzzy = findBestNameMatch(zoekterm, allen, 0.5);
            if (fuzzy) return JSON.stringify({ fuzzy_match: true, bedoelde_je: fuzzy.naam_werknemer, resultaat: [fuzzy] }, null, 2);
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
          const { data: blokken } = await supabase.from('taken').select('week_start, dag_van_week, start_uur, duur_uren')
            .eq('werknemer_naam', medewerker).gte('week_start', startDatum).lte('week_start', eindDatum);
          const { data: verlof } = await supabase.from('beschikbaarheid_medewerkers')
            .select('start_datum, eind_datum, type, reden').eq('werknemer_naam', medewerker)
            .eq('status', 'goedgekeurd').or(`start_datum.lte.${eindDatum},eind_datum.gte.${startDatum}`);
          const totaalIngepland = (blokken || []).reduce((sum: number, b: { duur_uren: number }) => sum + b.duur_uren, 0);
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

        const { data: klant, error: klantErr } = await supabase
          .from('klanten').select('id, naam, planning_instructies')
          .ilike('naam', `%${klantNaam}%`).limit(1).maybeSingle();

        if (klantErr || !klant) return `Kon klant "${klantNaam}" niet vinden.`;

        const projectNummer = `P-${Date.now().toString().slice(-6)}`;
        const taken: Array<{
          werknemer_naam: string; fase_naam: string; discipline: string; werktype: string;
          week_start: string; dag_van_week: number; start_uur: number; duur_uren: number;
        }> = [];
        const samenvattingParts: string[] = [];
        const warnings: string[] = [];
        const firstStartDate = new Date(fases[0].start_datum + 'T00:00:00');

        async function planBlok(medewerker: string, datum: Date, fase: typeof fases[0], isMeeting: boolean): Promise<boolean> {
          const urenPerDag = fase.uren_per_dag || 8;
          const discipline = bepaalDiscipline(fase.fase_naam);
          if (await heeftVerlof(supabase, medewerker, datum)) {
            warnings.push(`${medewerker} heeft verlof op ${datum.toISOString().split('T')[0]}`);
            return false;
          }
          if (await isParttimeDag(supabase, medewerker, datum)) {
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
            taken.push({ werknemer_naam: medewerker, fase_naam: fase.fase_naam, discipline, werktype: fase.fase_naam, week_start: weekStart, dag_van_week: dagVanWeek, start_uur: slot.startUur, duur_uren: slot.duurUren });
            samenvattingParts.push(`  ${medewerker}: wk${weekNum} ${dagNamen[dagVanWeek]} ${slot.startUur}:00-${slot.startUur + slot.duurUren}:00`);
            return true;
          } else {
            warnings.push(`Geen slot voor ${medewerker} op ${datum.toISOString().split('T')[0]}`);
            return false;
          }
        }

        for (const fase of fases) {
          const verdeling = fase.verdeling || 'aaneengesloten';
          const dagenPerWeek = fase.dagen_per_week || 1;
          const isMeeting = isMeetingFase(fase.fase_naam);
          const isFeedback = isFeedbackFase(fase.fase_naam, fase.uren_per_dag);
          const faseStart = new Date(fase.start_datum + 'T00:00:00');
          samenvattingParts.push(`\n${fase.fase_naam} (${verdeling}):`);

          if (verdeling === 'laatste_week' && deadline) {
            const deadlineDate = new Date(deadline + 'T00:00:00');
            const startDate = new Date(deadlineDate);
            startDate.setDate(startDate.getDate() - 7);
            while (isWeekend(startDate) || getDayOfWeekNumber(startDate) !== 0) startDate.setDate(startDate.getDate() + 1);
            let dagenGepland = 0;
            let huidigeDatum = new Date(startDate);
            while (dagenGepland < fase.duur_dagen && huidigeDatum < deadlineDate) {
              while (isWeekend(huidigeDatum)) huidigeDatum.setDate(huidigeDatum.getDate() + 1);
              if (huidigeDatum >= deadlineDate) break;
              for (const medewerker of fase.medewerkers) await planBlok(medewerker, huidigeDatum, fase, isMeeting);
              dagenGepland++;
              huidigeDatum.setDate(huidigeDatum.getDate() + 1);
            }
          } else if (verdeling === 'per_week') {
            const totaalWeken = Math.ceil(fase.duur_dagen / dagenPerWeek);
            let huidigeDatum = new Date(faseStart);
            let dagenGepland = 0;
            for (let week = 0; week < totaalWeken && dagenGepland < fase.duur_dagen; week++) {
              let dagenDezeWeek = 0;
              const weekStart = new Date(huidigeDatum);
              if (isFeedback && getDayOfWeekNumber(huidigeDatum) < 3) {
                while (getDayOfWeekNumber(huidigeDatum) !== 3) huidigeDatum.setDate(huidigeDatum.getDate() + 1);
              }
              while (dagenDezeWeek < dagenPerWeek && dagenGepland < fase.duur_dagen) {
                while (isWeekend(huidigeDatum)) huidigeDatum.setDate(huidigeDatum.getDate() + 1);
                if (deadline && huidigeDatum >= new Date(deadline + 'T00:00:00')) break;
                for (const medewerker of fase.medewerkers) await planBlok(medewerker, huidigeDatum, fase, isMeeting);
                dagenGepland++; dagenDezeWeek++;
                huidigeDatum.setDate(huidigeDatum.getDate() + 1);
              }
              huidigeDatum = new Date(weekStart);
              huidigeDatum.setDate(huidigeDatum.getDate() + 7);
              if (isFeedback) {
                while (isWeekend(huidigeDatum) || getDayOfWeekNumber(huidigeDatum) !== 3) huidigeDatum.setDate(huidigeDatum.getDate() + 1);
              } else {
                while (isWeekend(huidigeDatum) || getDayOfWeekNumber(huidigeDatum) !== 0) huidigeDatum.setDate(huidigeDatum.getDate() + 1);
              }
            }
          } else {
            // aaneengesloten
            let huidigeDatum = new Date(faseStart);
            let dagenGepland = 0;
            while (dagenGepland < fase.duur_dagen) {
              while (isWeekend(huidigeDatum)) huidigeDatum.setDate(huidigeDatum.getDate() + 1);
              if (deadline && huidigeDatum >= new Date(deadline + 'T00:00:00')) {
                warnings.push(`${fase.fase_naam}: Niet alle dagen passen voor deadline`);
                break;
              }
              for (const medewerker of fase.medewerkers) await planBlok(medewerker, huidigeDatum, fase, isMeeting);
              dagenGepland++;
              huidigeDatum.setDate(huidigeDatum.getDate() + 1);
            }
          }
        }

        let samenvatting = samenvattingParts.join('\n');
        if (reasoning) samenvatting = `Ellen's redenering:\n${reasoning}\n\nPlanning:${samenvatting}`;
        if (warnings.length > 0) samenvatting += '\n\nLet op:\n' + warnings.map(w => `- ${w}`).join('\n');
        if (klant.planning_instructies) samenvatting += `\n\nKlant instructies (${klant.naam}):\n${klant.planning_instructies}`;

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

      case 'wijzig_taak': {
        const taakId = args.taak_id;
        const nieuweWaarden = args.nieuwe_waarden || {};
        const reden = args.reden || '';
        if (!taakId) return 'Fout: taak_id is verplicht';

        const { data: huidige, error: fetchErr } = await supabase.from('taken')
          .select('id, werknemer_naam, klant_naam, project_nummer, fase_naam, is_hard_lock, created_by')
          .eq('id', taakId).maybeSingle();
        if (fetchErr || !huidige) return `Taak met ID "${taakId}" niet gevonden.`;
        if (huidige.is_hard_lock) return `Deze taak is vergrendeld en kan alleen worden aangepast door ${huidige.created_by || 'de eigenaar'}.`;

        const toegestaneVelden = ['werknemer_naam', 'week_start', 'dag_van_week', 'start_uur', 'duur_uren', 'fase_naam', 'plan_status', 'werktype'];
        const updateData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(nieuweWaarden)) {
          if (toegestaneVelden.includes(key) && value !== undefined) updateData[key] = value;
        }
        if (Object.keys(updateData).length === 0) return 'Geen geldige velden om te wijzigen.';

        const { error: updateErr } = await supabase.from('taken').update(updateData).eq('id', taakId);
        if (updateErr) return `Fout bij wijzigen: ${updateErr.message}`;

        return JSON.stringify({
          type: 'wijziging_uitgevoerd',
          taak_id: taakId,
          gewijzigd: updateData,
          oude_waarden: { medewerker: huidige.werknemer_naam, klant: huidige.klant_naam, project: huidige.project_nummer },
          reden,
          bericht: `Taak succesvol gewijzigd (${Object.keys(updateData).join(', ')}). De planning is direct bijgewerkt.`,
        });
      }

      case 'verwijder_taak': {
        const taakId = args.taak_id;
        const reden = args.reden || '';
        if (!taakId) return 'Fout: taak_id is verplicht';

        const { data: taak, error: fetchErr } = await supabase.from('taken')
          .select('id, werknemer_naam, klant_naam, project_nummer, fase_naam, is_hard_lock, created_by')
          .eq('id', taakId).maybeSingle();
        if (fetchErr || !taak) return `Taak met ID "${taakId}" niet gevonden.`;
        if (taak.is_hard_lock) return `Deze taak is vergrendeld en kan alleen worden verwijderd door ${taak.created_by || 'de eigenaar'}.`;

        const { error: deleteErr } = await supabase.from('taken').delete().eq('id', taakId);
        if (deleteErr) return `Fout bij verwijderen: ${deleteErr.message}`;

        return JSON.stringify({
          type: 'taak_verwijderd',
          taak_id: taakId,
          verwijderde_taak: { medewerker: taak.werknemer_naam, klant: taak.klant_naam, project: taak.project_nummer, fase: taak.fase_naam },
          reden,
          bericht: `Taak voor ${taak.werknemer_naam} (${taak.klant_naam} - ${taak.fase_naam}) is verwijderd.`,
        });
      }

      case 'voeg_taak_toe': {
        const { werknemer_naam, klant_naam, project_titel, fase_naam, week_start, dag_van_week, start_uur, duur_uren, reden } = args;
        if (!werknemer_naam || !klant_naam || !project_titel || !fase_naam || !week_start || dag_van_week === undefined || !start_uur || !duur_uren) {
          return 'Fout: niet alle verplichte velden zijn ingevuld.';
        }
        if (dag_van_week < 0 || dag_van_week > 4) return 'Fout: dag_van_week moet 0-4 zijn (ma-vr).';
        if (start_uur < config.werkdag_start || start_uur > config.werkdag_eind) {
          return `Fout: start_uur moet tussen ${config.werkdag_start} en ${config.werkdag_eind} zijn.`;
        }

        const { data: bestaand } = await supabase.from('taken').select('id, start_uur, duur_uren')
          .eq('werknemer_naam', werknemer_naam).eq('week_start', week_start).eq('dag_van_week', dag_van_week);
        const eindUur = start_uur + duur_uren;
        const conflict = (bestaand || []).find((t: { id: string; start_uur: number; duur_uren: number }) => start_uur < t.start_uur + t.duur_uren && eindUur > t.start_uur);
        if (conflict) return `Fout: ${werknemer_naam} heeft al een taak op dat tijdstip.`;

        const projectNummer = args.project_nummer || `P-${Date.now().toString().slice(-6)}`;
        const werktype = args.werktype || 'concept';
        const planStatus = args.plan_status || 'concept';

        let projectId = null;
        const { data: bestaandProject } = await supabase.from('projecten').select('id').eq('projectnummer', projectNummer).maybeSingle();
        if (bestaandProject) projectId = bestaandProject.id;

        const { data: nieuweTaak, error: insertErr } = await supabase.from('taken').insert({
          project_id: projectId, werknemer_naam, klant_naam, project_nummer: projectNummer,
          project_titel, fase_naam, werktype, discipline: bepaalDiscipline(fase_naam),
          week_start, dag_van_week, start_uur, duur_uren, plan_status: planStatus, is_hard_lock: false,
        }).select('id').single();
        if (insertErr) return `Fout bij toevoegen: ${insertErr.message}`;

        const dagNamen = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag'];
        return JSON.stringify({
          type: 'taak_toegevoegd',
          taak_id: nieuweTaak?.id,
          taak: { medewerker: werknemer_naam, klant: klant_naam, project: projectNummer, fase: fase_naam, dag: dagNamen[dag_van_week], tijd: `${start_uur}:00-${start_uur + duur_uren}:00`, uren: duur_uren },
          reden,
          bericht: `Nieuwe taak toegevoegd: ${werknemer_naam} - ${klant_naam} (${fase_naam}) op ${dagNamen[dag_van_week]} ${start_uur}:00-${start_uur + duur_uren}:00.`,
        });
      }

      default:
        return `Onbekende tool: ${toolName}`;
    }
  } catch (err) {
    return `Fout bij ${toolName}: ${(err as Error).message}`;
  }
}

// ===== SECTION 8: WIJZIGING UITVOEREN =====

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
  klanten: 'id', projecten: 'id', medewerkers: 'werknemer_id', taken: 'id',
  rolprofielen: 'rol_nummer', disciplines: 'id', projecttypes: 'id',
  project_fases: 'id', beschikbaarheid_medewerkers: 'id',
};

async function executeWijziging(supabase: SupabaseClient, tabel: string, id: string, veld: string, waarde: string): Promise<{ success: boolean; message: string }> {
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

// ===== SECTION 9: OPENROUTER HELPERS =====

async function callOpenRouter(
  apiKey: string,
  model: string,
  // deno-lint-ignore no-explicit-any
  messages: any[],
  // deno-lint-ignore no-explicit-any
  tools?: any[],
  maxTokens = 4096
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  // deno-lint-ignore no-explicit-any
  const body: any = { model, max_tokens: maxTokens, messages };
  if (tools?.length) body.tools = tools;

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://selmore.nl',
      'X-Title': 'Ellen AI Traffic Manager',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(errText) as Error & { status: number };
    err.status = response.status;
    throw err;
  }
  return response.json();
}

async function detectIntent(bericht: string, apiKey: string): Promise<Intent> {
  try {
    const data = await callOpenRouter(apiKey, ROUTER_MODEL, [
      {
        role: 'system',
        content: 'Classificeer de intentie van dit bericht. Antwoord ALLEEN met één woord: CHAT, PLAN, of QUERY.\n- PLAN: nieuw project plannen, planning maken voor een klant, fases inplannen\n- QUERY: informatie opvragen, zoeken, beschikbaarheid checken, rapportage (zonder iets te wijzigen)\n- CHAT: taak verplaatsen/wijzigen/verwijderen/toevoegen, of algemene vraag aan Ellen',
      },
      { role: 'user', content: bericht },
    ], undefined, 15);

    const raw = data.choices?.[0]?.message?.content?.trim().toUpperCase() || '';
    if (raw.includes('PLAN')) return 'PLAN';
    if (raw.includes('QUERY')) return 'QUERY';
    return 'CHAT';
  } catch {
    return 'CHAT'; // Veilige default
  }
}

// ===== SECTION 10: MAIN HANDLER =====

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Niet geautoriseerd' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const session = await verifySessionToken(authHeader.replace('Bearer ', ''));
    if (!session) {
      return new Response(JSON.stringify({ error: 'Ongeldige of verlopen sessie' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { sessie_id, bericht, actie, tabel, id, veld, nieuwe_waarde, project_data } = body;
    if (!sessie_id) {
      return new Response(JSON.stringify({ error: 'sessie_id is verplicht' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Acties zonder AI
    if (actie === 'laden') {
      const { data: berichten } = await supabase.from('chat_gesprekken')
        .select('rol, inhoud, created_at').eq('sessie_id', sessie_id)
        .order('created_at', { ascending: true }).limit(50);
      return new Response(JSON.stringify({ berichten: berichten || [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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
      return new Response(JSON.stringify({ success: true, message: 'Feedback opgeslagen' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (actie === 'uitvoeren') {
      if (!tabel || !id || !veld || nieuwe_waarde === undefined) {
        return new Response(JSON.stringify({ error: 'Ontbrekende velden' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const result = await executeWijziging(supabase, tabel, id, veld, nieuwe_waarde);
      return new Response(JSON.stringify(result), { status: result.success ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (actie === 'plannen') {
      const planning = body.planning;
      const gekozenWerktype = body.werktype;
      const gekozenPlanStatus = body.plan_status || 'concept';

      if (!planning?.taken?.length) {
        return new Response(JSON.stringify({ success: false, message: 'Geen planning data' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: klant } = await supabase.from('klanten').select('id').ilike('naam', `%${planning.klant_naam}%`).limit(1).maybeSingle();
      if (!klant) {
        return new Response(JSON.stringify({ success: false, message: `Klant "${planning.klant_naam}" niet gevonden` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const projectNummer = planning.project_nummer || `P-${Date.now().toString().slice(-6)}`;
      const { data: project, error: projectErr } = await supabase.from('projecten').insert({
        klant_id: klant.id,
        projectnummer: projectNummer,
        omschrijving: planning.project_omschrijving || planning.klant_naam,
        projecttype: planning.projecttype || 'algemeen',
        deadline: planning.deadline,
        status: 'concept',
        datum_aanvraag: new Date().toISOString().split('T')[0],
        volgnummer: Date.now() % 10000,
      }).select('id, projectnummer').single();

      if (projectErr || !project) {
        return new Response(JSON.stringify({ success: false, message: 'Kon project niet aanmaken' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const werktype = gekozenWerktype || 'concept';
      const werktypeLabels: Record<string, string> = {
        concept: 'Conceptontwikkeling', uitwerking: 'Conceptuitwerking', productie: 'Productie',
        extern: 'Meeting met klant', review: 'Interne review',
      };
      const faseLabel = werktypeLabels[werktype] || werktype;
      const projectTitel = planning.project_omschrijving || planning.klant_naam;
      let aantalGeplaatst = 0;

      console.log('Planning taken ontvangen:', JSON.stringify(planning.taken, null, 2));

      for (const taak of planning.taken) {
        const startUur = typeof taak.start_uur === 'number' ? taak.start_uur : 9;
        const duurUren = typeof taak.duur_uren === 'number' ? taak.duur_uren : 8;
        const dagVanWeek = typeof taak.dag_van_week === 'number' ? taak.dag_van_week : 0;

        const { error: taakErr } = await supabase.from('taken').insert({
          project_id: project.id, werknemer_naam: taak.werknemer_naam, klant_naam: planning.klant_naam,
          project_nummer: project.projectnummer, fase_naam: faseLabel, werktype,
          discipline: taak.discipline || 'Algemeen', week_start: taak.week_start,
          dag_van_week: dagVanWeek, start_uur: startUur, duur_uren: duurUren,
          plan_status: gekozenPlanStatus, is_hard_lock: false,
        });
        if (taakErr) console.error('Taak insert error:', taakErr.message);
        else aantalGeplaatst++;
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Planning "${project.projectnummer}" aangemaakt met ${aantalGeplaatst} blokken`,
        project_id: project.id, project_nummer: project.projectnummer, aantal_blokken: aantalGeplaatst,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Direct plan modus (vanuit template formulier — bypass AI)
    if (project_data?.direct_plan_fases?.length) {
      console.log('Direct plan modus: skip AI, voer plan_project direct uit');
      const planningConfig = await loadPlanningConfig(supabase);
      const fases = project_data.direct_plan_fases.map((f: Record<string, unknown>) => {
        const { _deadline, ...rest } = f;
        return rest;
      });
      const deadlines = project_data.direct_plan_fases.map((f: Record<string, unknown>) => f._deadline).filter(Boolean) as string[];
      const deadline = deadlines.sort()[0] || project_data.eind_datum;

      const result = await executeTool(supabase, planningConfig, 'plan_project', {
        klant_naam: project_data.klant_naam || 'Onbekend',
        project_naam: project_data.project_naam || 'Project',
        fases, deadline,
        reasoning: 'Direct plan vanuit template formulier — slot-algoritme bepaalt exacte tijden',
      });

      let voorstel: Record<string, unknown> | null = null;
      try { voorstel = JSON.parse(result); } catch { /* ignore */ }

      return new Response(JSON.stringify({
        antwoord: 'Planning aangemaakt op basis van het template.',
        voorstel: voorstel?.type === 'planning_voorstel' ? voorstel : null,
        sessie_id,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Chat modus
    if (!bericht) {
      return new Response(JSON.stringify({ error: 'bericht is verplicht' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check API key
    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openrouterKey) {
      return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY niet geconfigureerd. Stel dit in als Supabase secret.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Laad data parallel
    const [planningConfig, ellenRegels, recentFeedback, plannerInfo] = await Promise.all([
      loadPlanningConfig(supabase),
      loadEllenRegels(supabase),
      loadRecentFeedback(supabase),
      supabase.from('medewerkers')
        .select('naam_werknemer, primaire_rol, tweede_rol, discipline, werkuren, parttime_dag')
        .ilike('naam_werknemer', `%${session.naam}%`).limit(1).maybeSingle(),
    ]);

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

    // Detecteer intent (Haiku router) — tenzij project_data aanwezig is
    const intent: Intent = project_data ? 'PLAN' : await detectIntent(bericht, openrouterKey);
    console.log(`Intent gedetecteerd: ${intent}`);

    // Kies tools en prompt op basis van intent
    const tools = getToolsForIntent(intent);
    const systemContent = intent === 'PLAN'
      ? buildPlanPrompt(planningConfig, ellenRegels, recentFeedback, session.naam, plannerInfoStr)
      : intent === 'QUERY'
        ? buildQueryPrompt(session.naam)
        : buildChatPrompt(planningConfig, ellenRegels, session.naam);

    // Laad chat history
    let historyMessages: Array<{ rol: string; inhoud: string }> = [];
    try {
      const { data: history } = await supabase.from('chat_gesprekken')
        .select('rol, inhoud').eq('sessie_id', sessie_id)
        .order('created_at', { ascending: true }).limit(30);
      if (history) historyMessages = history;
    } catch { /* ignore */ }

    // Sla user bericht op
    try {
      await supabase.from('chat_gesprekken').insert({ sessie_id, rol: 'user', inhoud: bericht });
    } catch { /* ignore */ }

    // Bouw berichten (OpenAI-compatible: system in messages array)
    // deno-lint-ignore no-explicit-any
    const currentMessages: any[] = [{ role: 'system', content: systemContent }];

    for (const msg of historyMessages) {
      const cleanContent = msg.inhoud.replace(/\n*\[VOORSTEL:\{.*?\}\]/gs, '').trim();
      if (cleanContent) currentMessages.push({ role: msg.rol === 'user' ? 'user' : 'assistant', content: cleanContent });
    }

    // Pre-fetch data voor project planning
    let prefetchedContext = '';
    if (project_data) {
      const { medewerkers: mwNames, klant_naam, start_datum, eind_datum } = project_data;
      const prefetchParts: string[] = [];

      if (klant_naam) {
        const { data: klantData } = await supabase.from('klanten')
          .select('id, klantnummer, naam, contactpersoon, planning_instructies')
          .ilike('naam', `%${klant_naam}%`).limit(1).maybeSingle();
        if (klantData) prefetchParts.push(`\n--- PRE-LOADED: KLANT INFO ---\n${JSON.stringify(klantData, null, 2)}`);
      }

      if (mwNames?.length) {
        const { data: mwData } = await supabase.from('medewerkers')
          .select('werknemer_id, naam_werknemer, primaire_rol, tweede_rol, discipline, werkuren, parttime_dag, duo_team, beschikbaar, notities')
          .in('naam_werknemer', mwNames);
        if (mwData?.length) prefetchParts.push(`\n--- PRE-LOADED: MEDEWERKER INFO ---\n${JSON.stringify(mwData, null, 2)}`);

        if (start_datum && eind_datum) {
          const beschikbaarheid: Record<string, unknown> = {};
          await Promise.all(mwNames.map(async (mw: string) => {
            const [takenRes, verlofRes] = await Promise.all([
              supabase.from('taken').select('week_start, dag_van_week, start_uur, duur_uren, klant_naam, project_nummer')
                .eq('werknemer_naam', mw).gte('week_start', start_datum).lte('week_start', eind_datum).limit(40),
              supabase.from('beschikbaarheid_medewerkers').select('start_datum, eind_datum, type, reden')
                .eq('werknemer_naam', mw).eq('status', 'goedgekeurd').or(`start_datum.lte.${eind_datum},eind_atum.gte.${start_datum}`),
            ]);
            const totaalIngepland = (takenRes.data || []).reduce((sum: number, b: { duur_uren: number }) => sum + b.duur_uren, 0);
            beschikbaarheid[mw] = { ingeplande_uren: totaalIngepland, bestaande_taken: takenRes.data || [], verlof_periodes: verlofRes.data || [] };
          }));
          prefetchParts.push(`\n--- PRE-LOADED: BESCHIKBAARHEID (${start_datum} t/m ${eind_datum}) ---\n${JSON.stringify(beschikbaarheid, null, 2)}`);
        }

        const mwIds = (mwNames ? await supabase.from('medewerkers').select('werknemer_id, naam_werknemer').in('naam_werknemer', mwNames) : { data: [] }).data?.map((m: { werknemer_id: number }) => m.werknemer_id) || [];
        if (mwIds.length > 0) {
          const { data: tokenData } = await supabase.from('microsoft_tokens').select('werknemer_id').in('werknemer_id', mwIds);
          const gekoppeldeIds = new Set((tokenData || []).map((t: { werknemer_id: number }) => t.werknemer_id));
          const { data: allMw } = await supabase.from('medewerkers').select('werknemer_id, naam_werknemer').in('naam_werknemer', mwNames);
          const nietGekoppeld = (allMw || []).filter((m: { werknemer_id: number }) => !gekoppeldeIds.has(m.werknemer_id)).map((m: { naam_werknemer: string }) => m.naam_werknemer);
          const welGekoppeld = (allMw || []).filter((m: { werknemer_id: number }) => gekoppeldeIds.has(m.werknemer_id)).map((m: { naam_werknemer: string }) => m.naam_werknemer);
          if (nietGekoppeld.length > 0 && welGekoppeld.length > 0) {
            prefetchParts.push(`\n--- MICROSOFT AGENDA STATUS ---\nGekoppeld: ${welGekoppeld.join(', ')}\nNIET gekoppeld: ${nietGekoppeld.join(', ')}\nVermeld dit in je voorstel.`);
          } else if (nietGekoppeld.length > 0) {
            prefetchParts.push(`\n--- MICROSOFT AGENDA STATUS ---\nGeen agenda's gekoppeld (${nietGekoppeld.join(', ')}). Vermeld dit expliciet in je voorstel.`);
          }
        }
      }

      if (prefetchParts.length > 0) {
        prefetchedContext = '\n\n=== PRE-LOADED DATA — gebruik DIRECT plan_project, geen extra zoek-tools nodig ===\n' + prefetchParts.join('\n');
      }
    }

    currentMessages.push({ role: 'user', content: bericht + prefetchedContext });

    // Tool loop (OpenAI-compatible format)
    let assistantMessage = '';
    // deno-lint-ignore no-explicit-any
    let pendingVoorstel: any = null;
    const maxIterations = project_data ? 2 : 3;

    for (let i = 0; i < maxIterations; i++) {
      const data = await callOpenRouter(
        openrouterKey,
        MAIN_MODEL,
        currentMessages,
        tools,
        project_data ? 3000 : 4096
      );

      const choice = data.choices?.[0];
      const message = choice?.message;
      const finishReason = choice?.finish_reason;

      if (finishReason === 'stop' || finishReason === 'end_turn') {
        assistantMessage = message?.content || '';
        break;
      }

      if (finishReason === 'tool_calls' || finishReason === 'tool_use') {
        const toolCalls = message?.tool_calls || [];
        currentMessages.push({
          role: 'assistant',
          content: message?.content || null,
          tool_calls: toolCalls,
        });

        for (const toolCall of toolCalls) {
          const toolName = toolCall.function?.name;
          let toolArgs: Record<string, unknown> = {};
          try { toolArgs = JSON.parse(toolCall.function?.arguments || '{}'); } catch { /* ignore */ }

          const result = await executeTool(supabase, planningConfig, toolName, toolArgs);

          // Voorstel detectie
          if (toolName === 'stel_wijziging_voor' || toolName === 'plan_project') {
            try {
              const parsed = JSON.parse(result);
              if (parsed.type === 'voorstel' || parsed.type === 'planning_voorstel') pendingVoorstel = parsed;
            } catch { /* ignore */ }
          }

          currentMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
        }

        // Stop na plan_project bij project_data modus
        if (pendingVoorstel && project_data) {
          if (!assistantMessage) assistantMessage = 'Planning voorstel is klaar. Bekijk het hieronder en laat me weten of je aanpassingen wilt.';
          break;
        }
      } else {
        // Onbekend stop-reason: pak tekst en stop
        assistantMessage = message?.content || '';
        break;
      }
    }

    // Sla assistant response op
    const opslaan = pendingVoorstel
      ? `${assistantMessage}\n\n[VOORSTEL:${JSON.stringify(pendingVoorstel)}]`
      : assistantMessage;
    try {
      await supabase.from('chat_gesprekken').insert({ sessie_id, rol: 'assistant', inhoud: opslaan });
    } catch { /* ignore */ }

    const cleanAntwoord = assistantMessage.replace(/\n*\[VOORSTEL:\{.*?\}\]/gs, '').trim();
    return new Response(
      JSON.stringify({ antwoord: cleanAntwoord, voorstel: pendingVoorstel, intent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Ellen chat error:', error);

    // Rate limiting
    if ((error as { status?: number }).status === 429) {
      return new Response(JSON.stringify({
        error: 'Even geduld — AI is tijdelijk overbelast. Probeer het over 30 seconden opnieuw.',
        code: 'RATE_LIMITED',
      }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Er is een fout opgetreden bij Ellen' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
