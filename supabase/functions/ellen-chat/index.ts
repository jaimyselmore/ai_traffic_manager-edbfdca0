// Ellen AI Chat - Supabase Edge Function
// Verwerkt chatberichten, zoekt data op via OpenAI function calling, retourneert antwoorden
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { verify } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---- JWT VERIFICATION (zelfde patroon als data-access) ----

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

// ---- SYSTEM PROMPT ----

// Core prompt - persoonlijkheid en gedrag (NIET aanpasbaar via database)
const CORE_PROMPT = `Je bent Ellen, een traffic/planning-assistent voor Selmore - een creatief productiebedrijf.

## WIE JE BENT
Je bent een slimme, proactieve planningsassistent die MEEDENKT met het team. Je bent:
- **Slim en interpreterend** - je begrijpt de bedoeling, niet alleen de letterlijke vraag
- **Proactief** - je signaleert problemen en conflicten voordat ze ontstaan
- **Direct en efficient** - geen omhaal, recht op je doel af
- **Een tikje eigenwijs** - je hebt een mening en deelt die (vriendelijk)

## TONE OF VOICE
- Praat als een collega, niet als een assistent
- Kort en krachtig, geen wollige taal
- Informeel Nederlands ("Even kijken...", "Top!", "Momentje...")
- Bij problemen: oplossingsgericht, niet alleen melden maar ook alternatieven bieden

## EMOJI'S - SPAARZAAM
- Alleen bij droge humor of groot succes
- Default = geen emoji

## WAT JE PLANT
Je maakt planningsvoorstellen voor **Creatie** en **Studio** - alleen deze twee plan je in uren/blokken.
- **Account** = projectlead (plan je NIET in blokken)
- **Strategie, Producer, etc.** = kunnen verplicht aanwezig zijn bij meetings/presentaties
  → Je boekt hen NIET, maar je neemt hun aanwezigheid mee als constraint
  → Meld conflicten als Creatie/Studio botst met hun verplichte aanwezigheid

## HOE JE WERKT BIJ NIEUWE PROJECT TEMPLATES
De planner vult templates volledig in. Jij stelt GEEN intake-vragen maar geeft DIRECT een voorstel.

### Stap 1: Lees en analyseer
- Lees de template (klant, medewerkers, fases, deadline, opmerkingen)
- Check de ROLLEN van de gekozen medewerkers → bepaalt wie Creatie is en wie Studio
- Check klant.planning_instructies voor specifieke wensen
- Check medewerker beschikbaarheid (verlof, parttime, bestaande blokken)

### Stap 2: Bepaal de werkwijze
**Default:** Creatie stuurt Studio
- Creatie maakt/briefed eerst
- Studio produceert daarna
- Studio-output vraagt Creatie-akkoord VÓÓR klantpresentaties
- Studio-output vraagt Creatie-akkoord VÓÓR finale oplevering

**Afwijkingen:** Als template aangeeft "Studio eerst" of "Gedeeld" → pas werkwijze aan

### Stap 3: Plan rondom ankers
**Ankers** = deadlines, presentaties, meetings met klant
- Deze staan VAST - plan hier omheen
- Adviseer 30-60 min buffer VÓÓR elke klantpresentatie (voor laatste check)
- Als buffer niet past → meld dit als risico

### Stap 4: Maak voorstel
**Bij externe projecten:** stel voor hoeveel presentaties er moeten zijn met de klant
- Kick-off / briefing
- Tussentijdse presentatie(s) indien nodig
- Eindpresentatie / oplevering

**Je output bevat:**
- Concrete blokken voor Creatie en Studio (wie, wanneer, hoeveel uur)
- Voorgestelde presentatiemomenten
- Buffer-advies vóór presentaties
- Conflicten/risico's als die er zijn
- Wat je NIET hebt kunnen checken (bijv. MS Agenda)

### Stap 5: Wacht op feedback
- Na elk voorstel wacht je op feedback van de planner
- Bij "nee" of aanpassingen → maak een alternatief voorstel
- **NOOIT automatisch de echte planning aanpassen** - de mens keurt ALTIJD goed

## VERPLICHTE BRONNEN BIJ PLANNEN
Bij ELKE planning MOET je checken:

1. **Planning Regels** (uit planning_configuratie)
   - Werktijden, lunchtijd, meeting-tijden, fase richtlijnen
   - Als niet beschikbaar: gebruik defaults

2. **Klant Instructies** (uit klanten.planning_instructies)
   - Als leeg: vermeld dit

3. **Medewerker Info**
   - Rollen (bepaalt Creatie vs Studio)
   - Beschikbaarheid (verlof, parttime, bestaande blokken)
   - Notities/voorkeuren

4. **Microsoft Agenda** (indien gekoppeld)
   - Als niet gekoppeld: vermeld dit

**BELANGRIJK:** Vermeld ALTIJD wat je niet hebt kunnen checken!

## KRITIEKE REGELS (NOOIT BREKEN!)
1. Je hebt GEEN eigen kennis over Selmore data - ALTIJD tools gebruiken
2. Bij vragen over data: EERST zoek-tool gebruiken, DAN pas antwoorden
3. NOOIT antwoorden met info die niet uit een tool-resultaat komt
4. NOOIT automatisch de planning aanpassen zonder goedkeuring

## WIJZIGINGEN PROTOCOL
1. Gebruiker wil iets aanpassen? → EERST zoek-tool voor ID
2. ID gevonden? → ROEP stel_wijziging_voor AAN (VERPLICHT!)

## WAT JE WEET OVER SELMORE
- Creatief productiebedrijf gespecialiseerd in video content
- Team: Creatie (creatives, designers) en Studio (editors, motion designers)
- Projecten hebben fases: concept, productie, post-productie
- Planning is per week, met blokken van uren per medewerker`;

// ---- PLANNING CONFIGURATIE ----

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

// Default configuratie (als database nog niet geconfigureerd is)
const DEFAULT_CONFIG: PlanningConfig = {
  werkdag_start: 9,
  werkdag_eind: 18,
  lunch_start: 12.5,  // 12:30
  lunch_eind: 13.5,   // 13:30
  meeting_start: 10,
  meeting_eind: 17,
  standaard_uren_per_dag: 8,
  min_buffer_tussen_fases: 1,
  fase_templates: [
    { naam: 'Concept/Strategie', min_dagen: 1, max_dagen: 2 },
    { naam: 'Pre-productie', min_dagen: 1, max_dagen: 3 },
    { naam: 'Shoot/Productie', min_dagen: 1, max_dagen: 5 },
    { naam: 'Edit/Post-productie', min_dagen: 2, max_dagen: 10 },
    { naam: 'Review/Afronding', min_dagen: 1, max_dagen: 2 },
  ],
};

// deno-lint-ignore no-explicit-any
async function loadPlanningConfig(supabase: any): Promise<PlanningConfig> {
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

function formatTime(decimal: number): string {
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function buildPlanningContext(config: PlanningConfig): string {
  const faseList = config.fase_templates
    .map(f => `- ${f.naam}: ${f.min_dagen}-${f.max_dagen} dagen${f.omschrijving ? ` (${f.omschrijving})` : ''}`)
    .join('\n');

  let context = `

## HUIDIGE PLANNING REGELS
- Werkdag: ${formatTime(config.werkdag_start)} - ${formatTime(config.werkdag_eind)}
- Lunch: ${formatTime(config.lunch_start)} - ${formatTime(config.lunch_eind)}
  * Normaal werk: NIET tijdens lunch inplannen
  * Meetings met klant: MAG tijdens lunch (klant eet mee) - vraag dit na als relevant
- Meetings: bij voorkeur tussen ${formatTime(config.meeting_start)} en ${formatTime(config.meeting_eind)}
- Standaard uren per dag: ${config.standaard_uren_per_dag}
- Buffer tussen fases: minimaal ${config.min_buffer_tussen_fases} dag(en)

## FASE RICHTLIJNEN
${faseList}`;

  if (config.extra_instructies) {
    context += `

## EXTRA INSTRUCTIES
${config.extra_instructies}`;
  }

  return context;
}

// ---- OPENAI TOOL DEFINITIONS ----

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'zoek_klanten',
      description: 'Zoek klanten op naam of klantnummer. Geeft klantgegevens terug inclusief ID (voor wijzigingen), contactpersoon, email, telefoon, planning instructies.',
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
      description: 'Zoek medewerkers op naam, rol of discipline. Geeft info terug over werkuren, beschikbaarheid, rollen.',
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
      description: 'Zoek ingeplande taken/blokken in de planning. Filter op medewerker, project of week.',
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
      name: 'zoek_rolprofielen',
      description: 'Zoek rolprofielen op naam of beschrijving.',
      parameters: {
        type: 'object',
        properties: {
          zoekterm: { type: 'string', description: 'Zoekterm voor rolnaam of beschrijving' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'zoek_disciplines',
      description: 'Zoek disciplines op naam.',
      parameters: {
        type: 'object',
        properties: {
          zoekterm: { type: 'string', description: 'Zoekterm voor discipline naam' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'zoek_projecttypes',
      description: 'Zoek projecttypes op code of naam.',
      parameters: {
        type: 'object',
        properties: {
          zoekterm: { type: 'string', description: 'Zoekterm voor code of naam' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'zoek_project_fases',
      description: 'Zoek projectfases. Filter op project_id of fase_naam.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string', description: 'UUID van het project' },
          fase_naam: { type: 'string', description: 'Naam van de fase' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stel_wijziging_voor',
      description: 'VERPLICHT voor elke data-wijziging. Je MOET deze tool aanroepen om een wijziging voor te stellen - schrijf NOOIT alleen tekst over wijzigingen. De tool toont automatisch een bevestigknop aan de gebruiker.',
      parameters: {
        type: 'object',
        properties: {
          tabel: {
            type: 'string',
            description: 'Welke tabel',
            enum: ['klanten', 'projecten', 'medewerkers', 'taken', 'rolprofielen', 'disciplines', 'projecttypes', 'project_fases', 'beschikbaarheid_medewerkers']
          },
          id: { type: 'string', description: 'UUID of nummer van het record (uit zoekresultaat)' },
          veld: { type: 'string', description: 'Welk veld moet worden aangepast' },
          nieuwe_waarde: { type: 'string', description: 'De nieuwe waarde' },
          beschrijving: { type: 'string', description: 'Korte uitleg voor de gebruiker wat er verandert' },
        },
        required: ['tabel', 'id', 'veld', 'nieuwe_waarde', 'beschrijving'],
      },
    },
  },
  // ---- PLANNING TOOLS ----
  {
    type: 'function',
    function: {
      name: 'check_beschikbaarheid',
      description: 'Check de beschikbaarheid van medewerkers voor een periode. Geeft terug hoeveel uur ze vrij hebben per dag. Gebruik dit VOORDAT je een planning maakt om conflicten te voorkomen.',
      parameters: {
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
  },
  {
    type: 'function',
    function: {
      name: 'plan_project',
      description: 'Maak een nieuw project aan en plan blokken in voor medewerkers. Retourneert een voorstel dat de gebruiker moet bevestigen. Gebruik check_beschikbaarheid EERST om te kijken of medewerkers vrij zijn.',
      parameters: {
        type: 'object',
        properties: {
          klant_naam: { type: 'string', description: 'Naam van de klant' },
          project_naam: { type: 'string', description: 'Naam/omschrijving van het project' },
          projecttype: { type: 'string', description: 'Type project (bijv. commercial, corporate, social)', enum: ['commercial', 'corporate', 'social', 'branded', 'internal', 'algemeen'] },
          fases: {
            type: 'array',
            description: 'Lijst van fases met medewerkers en planning',
            items: {
              type: 'object',
              properties: {
                fase_naam: { type: 'string', description: 'Naam van de fase (bijv. Concept, Shoot, Edit)' },
                medewerkers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Namen van medewerkers voor deze fase'
                },
                start_datum: { type: 'string', description: 'Startdatum van de fase (YYYY-MM-DD)' },
                duur_dagen: { type: 'number', description: 'Aantal werkdagen voor deze fase' },
                uren_per_dag: { type: 'number', description: 'Aantal uren per dag (default 8)' },
              },
              required: ['fase_naam', 'medewerkers', 'start_datum', 'duur_dagen'],
            },
          },
          deadline: { type: 'string', description: 'Deadline van het project (YYYY-MM-DD)' },
          betrokken_personen: {
            type: 'array',
            items: { type: 'string' },
            description: 'Namen van personen die bij meetings/presentaties aanwezig moeten zijn maar niet aan het project werken (bijv. management, stakeholders)'
          },
        },
        required: ['klant_naam', 'project_naam', 'fases'],
      },
    },
  },
];

// ---- DATE HELPERS ----

/**
 * Get Monday of the week for a given date (YYYY-MM-DD format)
 * Uses local date formatting to avoid UTC timezone shifts
 */
function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  // Format as YYYY-MM-DD without timezone conversion
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Get day of week number (0=Monday, 4=Friday)
 */
function getDayOfWeekNumber(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1; // Convert Sunday=0 to Monday=0
}

/**
 * Check if date is weekend
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Determine discipline/color based on fase name
 */
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

/**
 * Check if a fase is a meeting/presentation type
 * Meetings have special scheduling rules (10:00-17:00, not early/late)
 */
function isMeetingFase(faseNaam: string): boolean {
  const lowerNaam = faseNaam.toLowerCase();
  return lowerNaam.includes('presentatie') ||
         lowerNaam.includes('meeting') ||
         lowerNaam.includes('kick-off') ||
         lowerNaam.includes('kick off') ||
         lowerNaam.includes('klantmeeting') ||
         lowerNaam.includes('review') ||
         lowerNaam.includes('tussentijds') ||
         lowerNaam.includes('eindpresentatie');
}

// ---- SLOT FINDER ----

// Werkdag constanten (in decimalen: 12.5 = 12:30)
// Dit zijn defaults - Ellen leest de echte waarden uit planning_configuratie
const WERKDAG_START = 9;      // 09:00
const WERKDAG_EIND = 18;      // 18:00
const LUNCH_START = 12.5;     // 12:30 - echte lunchtijd
const LUNCH_EIND = 13.5;      // 13:30 - echte lunchtijd
const MEETING_START = 10;     // Default: meetings niet voor 10:00 (komt uit planning_configuratie)
const MEETING_EIND = 17;      // Default: meetings niet na 17:00 (komt uit planning_configuratie)

interface TimeSlot {
  startUur: number;
  duurUren: number;
}

/**
 * Get existing blocks for employee on a date
 */
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

/**
 * Check if a time slot conflicts with existing blocks
 */
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

/**
 * Check of een tijdslot overlapt met de lunch (12:30-13:30)
 */
function overlapLunch(startUur: number, eindUur: number): boolean {
  // Overlap als: start < lunch_eind EN eind > lunch_start
  return startUur < LUNCH_EIND && eindUur > LUNCH_START;
}

/**
 * Find first available time slot for an employee on a given date
 * Werkdag: 09:00 - 18:00, lunch: 12:30-13:30
 */
async function vindEersteVrijeSlot(
  supabase: SupabaseClient,
  medewerkernaam: string,
  datum: Date,
  benodigdeUren: number
): Promise<TimeSlot | null> {
  const bezet = await getBestaandeBlokken(supabase, medewerkernaam, datum);

  // For full day blocks (8 hours), try to place at 09:00
  // Ochtend: 09:00-12:30 (3.5u) + Middag: 13:30-18:00 (4.5u) = 8u werk
  // Blok loopt visueel van 09:00-18:00 (9 uur inclusief lunch)
  if (benodigdeUren >= 8) {
    // Check if morning (9-12:30) and afternoon (13:30-18) are both free
    const ochtendVrij = !heeftConflict(bezet, WERKDAG_START, 3.5); // 9:00-12:30
    const middagVrij = !heeftConflict(bezet, 14, 4);               // 14:00-18:00 (we checken vanaf 14 voor hele uren)
    if (ochtendVrij && middagVrij) {
      // Return duurUren=9 zodat het blok visueel tot 18:00 loopt (9+9=18)
      return { startUur: WERKDAG_START, duurUren: 9 };
    }
    return null; // No space for full day
  }

  // For smaller blocks, find first free slot (we werken met hele uren voor start)
  for (let uur = WERKDAG_START; uur <= WERKDAG_EIND - benodigdeUren; uur++) {
    const eindUur = uur + benodigdeUren;

    // Skip als blok overlapt met lunch (12:30-13:30)
    if (overlapLunch(uur, eindUur)) {
      continue;
    }

    if (!heeftConflict(bezet, uur, benodigdeUren)) {
      return { startUur: uur, duurUren: benodigdeUren };
    }
  }

  return null;
}

/**
 * Find available slot for meetings/presentations
 * Meeting tijden komen uit planning_configuratie (default: 10:00-17:00)
 * Lunch: 12:30-13:30 - meetings kunnen soms WEL tijdens lunch (klant eet mee)
 * @param negeerLunch - als true, mag meeting ook tijdens lunch gepland worden
 */
async function vindMeetingSlot(
  supabase: SupabaseClient,
  medewerkernaam: string,
  datum: Date,
  benodigdeUren: number,
  negeerLunch = false
): Promise<TimeSlot | null> {
  const bezet = await getBestaandeBlokken(supabase, medewerkernaam, datum);

  // Meeting tijden (defaults, Ellen leest echte tijden uit planning_configuratie)
  for (let uur = MEETING_START; uur <= MEETING_EIND - benodigdeUren; uur++) {
    const eindUur = uur + benodigdeUren;

    // Skip lunch (12:30-13:30) tenzij negeerLunch=true (klant eet mee)
    if (!negeerLunch && overlapLunch(uur, eindUur)) {
      continue;
    }

    if (!heeftConflict(bezet, uur, benodigdeUren)) {
      return { startUur: uur, duurUren: benodigdeUren };
    }
  }

  return null;
}

/**
 * Check if employee has verlof on a specific date
 */
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

  if (error) {
    console.error('Error checking verlof:', error);
    return false;
  }

  return (verlof?.length || 0) > 0;
}

/**
 * Check if employee has parttime on this day
 */
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

  // Check if this day is the parttime day
  const parttimeDag = medewerker.parttime_dag?.toLowerCase();
  if (parttimeDag && parttimeDag === dagNaam) {
    return true;
  }

  return false;
}

// ---- FUZZY MATCHING ----

/**
 * Levenshtein distance - berekent hoe "ver" twee strings van elkaar zijn
 * Hoe lager het getal, hoe meer ze op elkaar lijken
 */
function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return 0;
  if (aLower.length === 0) return bLower.length;
  if (bLower.length === 0) return aLower.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      if (bLower.charAt(i - 1) === aLower.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[bLower.length][aLower.length];
}

/**
 * Berekent similarity score (0-1) op basis van Levenshtein distance
 */
function similarityScore(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - (distance / maxLength);
}

/**
 * Vindt beste match voor een naam in een lijst van medewerkers
 * Returns de medewerker als similarity > threshold
 */
function findBestNameMatch(
  searchTerm: string,
  // deno-lint-ignore no-explicit-any
  medewerkers: any[],
  threshold = 0.6
  // deno-lint-ignore no-explicit-any
): any | null {
  let bestMatch = null;
  let bestScore = 0;

  for (const m of medewerkers) {
    const naam = m.naam_werknemer || '';
    // Check voornaam (eerste woord)
    const voornaam = naam.split(' ')[0];

    // Bereken scores voor volledige naam en voornaam
    const scoreVolledig = similarityScore(searchTerm, naam);
    const scoreVoornaam = similarityScore(searchTerm, voornaam);
    const score = Math.max(scoreVolledig, scoreVoornaam);

    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = m;
    }
  }

  return bestMatch;
}

// ---- TOOL EXECUTION ----

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

function sanitize(term: string): string {
  return term.replace(/[,().\\]/g, '').substring(0, 100);
}

async function executeTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, string>
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

        // Als geen exacte match, probeer fuzzy matching
        if ((!data || data.length === 0) && term) {
          const { data: alleKlanten, error: allError } = await supabase
            .from('klanten')
            .select('id, klantnummer, naam, contactpersoon, email, telefoon, adres, beschikbaarheid, interne_notities, planning_instructies')
            .order('naam');

          if (allError || !alleKlanten?.length) {
            return 'Geen klanten gevonden.';
          }

          // Zoek beste fuzzy match op naam
          let bestMatch = null;
          let bestScore = 0;
          for (const k of alleKlanten) {
            const score = similarityScore(term, k.naam || '');
            if (score > bestScore && score >= 0.5) {
              bestScore = score;
              bestMatch = k;
            }
          }

          if (bestMatch) {
            return JSON.stringify({
              fuzzy_match: true,
              gezocht: term,
              bedoelde_je: bestMatch.naam,
              resultaat: [bestMatch]
            }, null, 2);
          }

          return `Geen klant gevonden met naam "${term}".`;
        }

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
        if (args.status) {
          query = query.eq('status', args.status);
        }
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

        if (zoekterm) {
          query = query.ilike('naam_werknemer', `%${zoekterm}%`);
        }
        if (args.discipline) {
          query = query.ilike('discipline', `%${sanitize(args.discipline)}%`);
        }

        const { data, error } = await query.order('naam_werknemer').limit(20);
        if (error) return `Fout: ${error.message}`;

        // Als geen exacte match gevonden EN we hadden een zoekterm, probeer fuzzy matching
        if ((!data || data.length === 0) && zoekterm) {
          // Haal ALLE medewerkers op voor fuzzy matching
          const { data: alleMedewerkers, error: allError } = await supabase
            .from('medewerkers')
            .select('werknemer_id, naam_werknemer, primaire_rol, tweede_rol, discipline, werkuren, parttime_dag, duo_team, beschikbaar, notities')
            .order('naam_werknemer');

          if (allError || !alleMedewerkers?.length) {
            return 'Geen medewerkers gevonden.';
          }

          // Zoek beste fuzzy match
          const fuzzyMatch = findBestNameMatch(zoekterm, alleMedewerkers, 0.5);

          if (fuzzyMatch) {
            return JSON.stringify({
              fuzzy_match: true,
              gezocht: zoekterm,
              bedoelde_je: fuzzyMatch.naam_werknemer,
              resultaat: [fuzzyMatch]
            }, null, 2);
          }

          // Geen fuzzy match gevonden, geef suggesties
          const suggesties = alleMedewerkers
            .map(m => ({
              naam: m.naam_werknemer,
              score: similarityScore(zoekterm, m.naam_werknemer.split(' ')[0])
            }))
            .filter(s => s.score > 0.3)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(s => s.naam);

          if (suggesties.length > 0) {
            return `Geen medewerker "${zoekterm}" gevonden. Bedoelde je misschien: ${suggesties.join(', ')}?`;
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
          .select('id, werknemer_naam, klant_naam, project_nummer, fase_naam, werktype, discipline, week_start, dag_van_week, start_uur, duur_uren, plan_status, is_hard_lock');
        if (args.werknemer_naam) {
          query = query.ilike('werknemer_naam', `%${sanitize(args.werknemer_naam)}%`);
        }
        if (args.project_nummer) {
          query = query.ilike('project_nummer', `%${sanitize(args.project_nummer)}%`);
        }
        if (args.week_start) {
          query = query.eq('week_start', args.week_start);
        }
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
        if (args.werknemer_naam) {
          query = query.ilike('werknemer_naam', `%${sanitize(args.werknemer_naam)}%`);
        }
        if (args.datum_van) query = query.gte('start_datum', args.datum_van);
        if (args.datum_tot) query = query.lte('eind_datum', args.datum_tot);
        const { data, error } = await query.order('start_datum', { ascending: true }).limit(15);
        if (error) return `Fout: ${error.message}`;
        if (!data?.length) return 'Geen verlof gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'zoek_rolprofielen': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase
          .from('rolprofielen')
          .select('rol_nummer, rol_naam, beschrijving_rol, taken_rol, standaard_discipline');
        if (args.zoekterm) {
          const term = sanitize(args.zoekterm);
          query = query.or(`rol_naam.ilike.%${term}%,beschrijving_rol.ilike.%${term}%`);
        }
        const { data, error } = await query.order('rol_naam').limit(20);
        if (error) return `Fout: ${error.message}`;
        if (!data?.length) return 'Geen rolprofielen gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'zoek_disciplines': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase
          .from('disciplines')
          .select('id, discipline_naam, beschrijving, kleur_hex');
        if (args.zoekterm) {
          query = query.ilike('discipline_naam', `%${sanitize(args.zoekterm)}%`);
        }
        const { data, error } = await query.order('discipline_naam').limit(20);
        if (error) return `Fout: ${error.message}`;
        if (!data?.length) return 'Geen disciplines gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'zoek_projecttypes': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase
          .from('projecttypes')
          .select('id, code, naam, omschrijving, is_system');
        if (args.zoekterm) {
          const term = sanitize(args.zoekterm);
          query = query.or(`code.ilike.%${term}%,naam.ilike.%${term}%`);
        }
        const { data, error } = await query.order('naam').limit(20);
        if (error) return `Fout: ${error.message}`;
        if (!data?.length) return 'Geen projecttypes gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'zoek_project_fases': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase
          .from('project_fases')
          .select('id, project_id, fase_naam, fase_type, volgorde, start_datum, eind_datum, datum_tijd, locatie, medewerkers, inspanning_dagen, opmerkingen, is_hard_lock');
        if (args.project_id) {
          query = query.eq('project_id', args.project_id);
        }
        if (args.fase_naam) {
          query = query.ilike('fase_naam', `%${sanitize(args.fase_naam)}%`);
        }
        const { data, error } = await query.order('volgorde').limit(20);
        if (error) return `Fout: ${error.message}`;
        if (!data?.length) return 'Geen projectfases gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'stel_wijziging_voor': {
        // Retourneer een voorstel-object dat de frontend kan tonen met bevestig-knop
        return JSON.stringify({
          type: 'voorstel',
          tabel: args.tabel,
          id: args.id,
          veld: args.veld,
          nieuwe_waarde: args.nieuwe_waarde,
          beschrijving: args.beschrijving,
        });
      }

      // ---- PLANNING TOOLS ----

      case 'check_beschikbaarheid': {
        const medewerkers = args.medewerkers as unknown as string[];
        const startDatum = args.start_datum;
        const eindDatum = args.eind_datum;

        if (!medewerkers?.length || !startDatum || !eindDatum) {
          return 'Ongeldige parameters: medewerkers, start_datum en eind_datum zijn verplicht.';
        }

        const resultaten: Record<string, unknown> = {};

        for (const medewerker of medewerkers) {
          // Haal bestaande blokken op
          const { data: blokken, error: blokErr } = await supabase
            .from('taken')
            .select('week_start, dag_van_week, start_uur, duur_uren')
            .eq('werknemer_naam', medewerker)
            .gte('week_start', startDatum)
            .lte('week_start', eindDatum);

          // Haal verlof op
          const { data: verlof, error: verlofErr } = await supabase
            .from('beschikbaarheid_medewerkers')
            .select('start_datum, eind_datum, type, reden')
            .eq('werknemer_naam', medewerker)
            .eq('status', 'goedgekeurd')
            .or(`start_datum.lte.${eindDatum},eind_datum.gte.${startDatum}`);

          if (blokErr || verlofErr) {
            resultaten[medewerker] = { error: 'Kon beschikbaarheid niet ophalen' };
            continue;
          }

          // Bereken bezetting per dag
          const bezettingPerDag: Record<string, number> = {};
          for (const blok of blokken || []) {
            // week_start + dag_van_week = exacte datum
            const key = `${blok.week_start}_dag${blok.dag_van_week}`;
            bezettingPerDag[key] = (bezettingPerDag[key] || 0) + blok.duur_uren;
          }

          // Tel totale ingeplande uren
          const totaalIngepland = (blokken || []).reduce((sum, b) => sum + b.duur_uren, 0);

          resultaten[medewerker] = {
            ingeplande_uren: totaalIngepland,
            verlof_periodes: verlof || [],
            bezetting_per_dag: bezettingPerDag,
            beschikbaar: verlof?.length === 0 ? 'Ja, geen verlof' : `Let op: ${verlof?.length} verlofperiode(s)`,
          };
        }

        return JSON.stringify({
          periode: `${startDatum} t/m ${eindDatum}`,
          medewerkers: resultaten,
        }, null, 2);
      }

      case 'plan_project': {
        const klantNaam = args.klant_naam;
        const projectNaam = args.project_naam;
        const projecttype = args.projecttype || 'algemeen';
        const fases = args.fases as unknown as Array<{
          fase_naam: string;
          medewerkers: string[];
          start_datum: string;
          duur_dagen: number;
          uren_per_dag?: number;
        }>;
        const deadline = args.deadline;
        const betrokkenPersonen = args.betrokken_personen as unknown as string[] || [];

        if (!klantNaam || !projectNaam || !fases?.length) {
          return 'Ongeldige parameters: klant_naam, project_naam en minstens één fase zijn verplicht.';
        }

        // Zoek klant_id
        const { data: klant, error: klantErr } = await supabase
          .from('klanten')
          .select('id, naam, planning_instructies')
          .ilike('naam', `%${klantNaam}%`)
          .limit(1)
          .maybeSingle();

        if (klantErr || !klant) {
          return `Kon klant "${klantNaam}" niet vinden. Zoek eerst de klant op of maak een nieuwe aan.`;
        }

        // Generate project number
        const projectNummer = `P-${Date.now().toString().slice(-6)}`;

        // CALCULATE ACTUAL BLOCKS for each fase
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

        // ======= SMART SPREADING LOGIC =======
        // Calculate optimal spacing between phases
        const totalFaseDays = fases.reduce((sum, f) => sum + f.duur_dagen, 0);
        const firstStartDate = new Date(fases[0].start_datum + 'T00:00:00');

        // Calculate available working days until deadline
        let availableDays = totalFaseDays; // default: no extra buffer
        if (deadline) {
          const deadlineDate = new Date(deadline + 'T00:00:00');
          let workingDays = 0;
          const checkDate = new Date(firstStartDate);
          while (checkDate < deadlineDate) {
            if (!isWeekend(checkDate)) workingDays++;
            checkDate.setDate(checkDate.getDate() + 1);
          }
          availableDays = workingDays;
        }

        // Calculate buffer days between phases (spread evenly)
        const bufferDaysTotal = Math.max(0, availableDays - totalFaseDays);
        const numberOfGaps = fases.length - 1;
        const bufferPerGap = numberOfGaps > 0 ? Math.floor(bufferDaysTotal / numberOfGaps) : 0;
        // Cap buffer at 5 days to avoid excessive gaps
        const actualBufferPerGap = Math.min(bufferPerGap, 5);
        // But ensure at least 1 buffer day between phases for review time
        const minBuffer = fases.length > 1 ? Math.max(1, actualBufferPerGap) : 0;

        // Track running date across all phases
        let runningDate = new Date(firstStartDate);

        for (let faseIndex = 0; faseIndex < fases.length; faseIndex++) {
          const fase = fases[faseIndex];
          const urenPerDag = fase.uren_per_dag || 8;
          const discipline = bepaalDiscipline(fase.fase_naam);

          // Use running date (which may have been pushed forward from previous fase + buffer)
          // But respect explicit start_datum if it's later than running date
          const explicitStart = new Date(fase.start_datum + 'T00:00:00');
          let huidigeDatum = explicitStart > runningDate ? explicitStart : new Date(runningDate);

          const faseStartFormatted = `${huidigeDatum.getDate()}/${huidigeDatum.getMonth() + 1}`;
          samenvattingParts.push(`\n${fase.fase_naam} (start: ${faseStartFormatted}):`);

          // For each day in the fase
          for (let dag = 0; dag < fase.duur_dagen; dag++) {
            // Skip weekends
            while (isWeekend(huidigeDatum)) {
              huidigeDatum.setDate(huidigeDatum.getDate() + 1);
            }

            // For each medewerker
            for (const medewerker of fase.medewerkers) {
              // Check verlof
              const hasVerlof = await heeftVerlof(supabase, medewerker, huidigeDatum);
              if (hasVerlof) {
                warnings.push(`${medewerker} heeft verlof op ${huidigeDatum.toISOString().split('T')[0]}`);
                continue;
              }

              // Check parttime
              const isParttime = await isParttimeDag(supabase, medewerker, huidigeDatum);
              if (isParttime) {
                warnings.push(`${medewerker} werkt niet op ${huidigeDatum.toISOString().split('T')[0]} (parttime)`);
                continue;
              }

              // Find available slot - use meeting rules for presentations/meetings
              const isMeeting = isMeetingFase(fase.fase_naam);
              const slot = isMeeting
                ? await vindMeetingSlot(supabase, medewerker, huidigeDatum, urenPerDag)
                : await vindEersteVrijeSlot(supabase, medewerker, huidigeDatum, urenPerDag);

              if (slot) {
                const weekStart = getMonday(huidigeDatum);
                const dagVanWeek = getDayOfWeekNumber(huidigeDatum);
                const dagNamen = ['ma', 'di', 'wo', 'do', 'vr'];
                const weekNum = Math.ceil((huidigeDatum.getTime() - firstStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

                taken.push({
                  werknemer_naam: medewerker,
                  fase_naam: fase.fase_naam,
                  discipline: discipline,
                  werktype: fase.fase_naam,
                  week_start: weekStart,
                  dag_van_week: dagVanWeek,
                  start_uur: slot.startUur,
                  duur_uren: slot.duurUren,
                });

                const meetingIndicator = isMeeting ? ' (meeting)' : '';
                samenvattingParts.push(`  ${medewerker}: wk${weekNum} ${dagNamen[dagVanWeek]} ${slot.startUur}:00-${slot.startUur + slot.duurUren}:00${meetingIndicator}`);
              } else {
                const slotType = isMeeting ? 'meeting slot (10:00-17:00)' : 'vrije slot';
                warnings.push(`Geen ${slotType} voor ${medewerker} op ${huidigeDatum.toISOString().split('T')[0]}`);
              }
            }

            // For meetings: also create blocks for betrokkenPersonen (people attending but not working on project)
            const isMeetingFaseCheck = isMeetingFase(fase.fase_naam);
            if (isMeetingFaseCheck && betrokkenPersonen.length > 0) {
              for (const persoon of betrokkenPersonen) {
                // Skip if already in medewerkers list
                if (fase.medewerkers.includes(persoon)) continue;

                // Check verlof
                const hasVerlof = await heeftVerlof(supabase, persoon, huidigeDatum);
                if (hasVerlof) {
                  warnings.push(`${persoon} (betrokken) heeft verlof op ${huidigeDatum.toISOString().split('T')[0]}`);
                  continue;
                }

                // Check parttime
                const isParttime = await isParttimeDag(supabase, persoon, huidigeDatum);
                if (isParttime) {
                  warnings.push(`${persoon} (betrokken) werkt niet op ${huidigeDatum.toISOString().split('T')[0]} (parttime)`);
                  continue;
                }

                // Find meeting slot for betrokken persoon
                const slot = await vindMeetingSlot(supabase, persoon, huidigeDatum, urenPerDag);

                if (slot) {
                  const weekStart = getMonday(huidigeDatum);
                  const dagVanWeek = getDayOfWeekNumber(huidigeDatum);
                  const dagNamen = ['ma', 'di', 'wo', 'do', 'vr'];
                  const weekNum = Math.ceil((huidigeDatum.getTime() - firstStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

                  taken.push({
                    werknemer_naam: persoon,
                    fase_naam: fase.fase_naam,
                    discipline: 'Meeting', // Mark as meeting attendee
                    werktype: fase.fase_naam,
                    week_start: weekStart,
                    dag_van_week: dagVanWeek,
                    start_uur: slot.startUur,
                    duur_uren: slot.duurUren,
                  });

                  samenvattingParts.push(`  ${persoon} (betrokken): wk${weekNum} ${dagNamen[dagVanWeek]} ${slot.startUur}:00-${slot.startUur + slot.duurUren}:00 (meeting)`);
                } else {
                  warnings.push(`Geen meeting slot voor ${persoon} (betrokken) op ${huidigeDatum.toISOString().split('T')[0]}`);
                }
              }
            }

            // Move to next day
            huidigeDatum.setDate(huidigeDatum.getDate() + 1);
          }

          // Update running date for next fase (add buffer between phases)
          runningDate = new Date(huidigeDatum);
          if (faseIndex < fases.length - 1 && minBuffer > 0) {
            // Add buffer days between phases
            for (let b = 0; b < minBuffer; b++) {
              runningDate.setDate(runningDate.getDate() + 1);
              // Skip weekends in buffer
              while (isWeekend(runningDate)) {
                runningDate.setDate(runningDate.getDate() + 1);
              }
            }
          }
        }

        // Build summary text
        let samenvatting = samenvattingParts.join('\n');
        if (warnings.length > 0) {
          samenvatting += '\n\n⚠️ Let op:\n' + warnings.map(w => `  - ${w}`).join('\n');
        }

        // Retourneer als planning-voorstel met ECHTE TAKEN
        return JSON.stringify({
          type: 'planning_voorstel',
          klant_naam: klant.naam,
          klant_id: klant.id,
          project_nummer: projectNummer,
          project_omschrijving: projectNaam,
          projecttype: projecttype,
          deadline: deadline || null,
          aantal_taken: taken.length,
          taken: taken,
          samenvatting: samenvatting,
          planning_instructies: klant.planning_instructies || null,
          fases: fases.map(f => ({
            fase_naam: f.fase_naam,
            medewerkers: f.medewerkers,
            start_datum: f.start_datum,
            duur_dagen: f.duur_dagen,
            uren_per_dag: f.uren_per_dag || 8,
          })),
          betrokken_personen: betrokkenPersonen.length > 0 ? betrokkenPersonen : undefined,
        });
      }

      default:
        return `Onbekende tool: ${toolName}`;
    }
  } catch (err) {
    return `Fout bij ${toolName}: ${(err as Error).message}`;
  }
}

// Toegestane velden per tabel voor wijzigingen
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

// ID-kolom per tabel
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
  // Valideer tabel
  if (!WIJZIG_VELDEN[tabel]) {
    return { success: false, message: `Onbekende tabel: ${tabel}` };
  }
  // Valideer veld
  if (!WIJZIG_VELDEN[tabel].includes(veld)) {
    return { success: false, message: `Veld '${veld}' mag niet worden aangepast in ${tabel}` };
  }
  // Valideer ID formaat (UUID of nummer)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const isNumber = /^\d+$/.test(id);
  if (!isUuid && !isNumber) {
    return { success: false, message: 'Ongeldig ID formaat' };
  }

  const idKolom = ID_KOLOM[tabel];
  const idValue = isNumber ? parseInt(id, 10) : id;

  try {
    const { error } = await supabase
      .from(tabel)
      .update({ [veld]: waarde })
      .eq(idKolom, idValue);

    if (error) {
      return { success: false, message: `Database fout: ${error.message}` };
    }
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

    // 2. Parse request (één keer, alle velden)
    const body = await req.json();
    const { sessie_id, bericht, actie, tabel, id, veld, nieuwe_waarde } = body;
    if (!sessie_id) {
      return new Response(
        JSON.stringify({ error: 'sessie_id is verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2b. Laad-modus: geef alleen chatgeschiedenis terug
    if (actie === 'laden') {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      );
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

    // 2b2. Feedback opslaan - Ellen leert van feedback
    if (actie === 'feedback_opslaan') {
      const { feedback, context } = body;
      if (!feedback) {
        return new Response(
          JSON.stringify({ success: false, message: 'Geen feedback ontvangen' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      );

      try {
        // Sla feedback op in ellen_feedback tabel
        await supabase.from('ellen_feedback').insert({
          gebruiker_naam: session.naam,
          feedback_tekst: feedback,
          context_data: context ? JSON.stringify(context) : null,
          project_info: context?.project_info ? JSON.stringify(context.project_info) : null,
          vorig_voorstel: context?.vorig_voorstel ? JSON.stringify(context.vorig_voorstel) : null,
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Feedback opgeslagen' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        console.error('Feedback opslaan error:', err);
        // Niet kritisch - return success anyway
        return new Response(
          JSON.stringify({ success: true, message: 'Feedback verwerkt' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2c. Uitvoeren-modus: voer een bevestigde wijziging uit
    if (actie === 'uitvoeren') {
      console.log('Uitvoeren wijziging:', { tabel, id, veld, nieuwe_waarde });
      if (!tabel || !id || !veld || nieuwe_waarde === undefined) {
        const missing: string[] = [];
        if (!tabel) missing.push('tabel');
        if (!id) missing.push('id');
        if (!veld) missing.push('veld');
        if (nieuwe_waarde === undefined) missing.push('nieuwe_waarde');
        return new Response(
          JSON.stringify({ error: `Ontbrekende velden: ${missing.join(', ')}`, debug: { tabel, id, veld, nieuwe_waarde } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      );
      const result = await executeWijziging(supabase, tabel, id, veld, nieuwe_waarde);
      console.log('Wijziging resultaat:', result);

      // Sla uitkomst op in chatgeschiedenis
      try {
        await supabase.from('chat_gesprekken').insert({
          sessie_id,
          rol: 'assistant',
          inhoud: result.success ? `✓ ${result.message}` : `✗ ${result.message}`,
        });
      } catch { /* ignore */ }

      return new Response(
        JSON.stringify(result),
        { status: result.success ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2d. Plannen-modus: maak project en blokken aan op basis van planning voorstel
    if (actie === 'plannen') {
      const planning = body.planning;
      const gekozenWerktype = body.werktype; // Gekozen door planner na goedkeuring (bepaalt kleur)

      if (!planning || !planning.taken?.length) {
        return new Response(
          JSON.stringify({ success: false, message: 'Geen planning data ontvangen' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      );

      try {
        // 1. Zoek klant_id op basis van naam
        const { data: klant, error: klantErr } = await supabase
          .from('klanten')
          .select('id')
          .ilike('naam', `%${planning.klant_naam}%`)
          .limit(1)
          .maybeSingle();

        if (klantErr || !klant) {
          return new Response(
            JSON.stringify({ success: false, message: `Klant "${planning.klant_naam}" niet gevonden` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 2. Maak project aan
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
          console.error('Project creation error:', projectErr);
          return new Response(
            JSON.stringify({ success: false, message: `Kon project niet aanmaken: ${projectErr?.message || 'Onbekende fout'}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 3. Maak taken (blokken) aan - zonder project_fases
        let aantalGeplaatst = 0;
        const errors: string[] = [];

        // Gebruik gekozen werktype of val terug op taak werktype (werktype bepaalt de kleur!)
        const werktype = gekozenWerktype || planning.taken[0]?.werktype || 'concept';

        // Map werktype naar display label
        const werktypeLabels: Record<string, string> = {
          concept: 'Conceptontwikkeling',
          uitwerking: 'Conceptuitwerking',
          productie: 'Productie',
          extern: 'Meeting met klant',
          review: 'Interne review',
          optie: 'Optie',
        };
        const faseLabel = werktypeLabels[werktype] || werktype;

        // Gebruik project_omschrijving als project_titel (dit is de volledige projecttitel)
        const projectTitel = planning.project_omschrijving || planning.klant_naam;

        for (const taak of planning.taken) {
          const { error: taakErr } = await supabase
            .from('taken')
            .insert({
              project_id: project.id,
              werknemer_naam: taak.werknemer_naam,
              klant_naam: planning.klant_naam,
              project_nummer: project.projectnummer,
              project_titel: projectTitel, // Volledige projecttitel voor display in planner
              fase_naam: faseLabel,
              werktype: werktype, // Dit bepaalt de kleur in de planner!
              discipline: taak.discipline || 'Algemeen', // Dit is de functiegroep
              week_start: taak.week_start,
              dag_van_week: taak.dag_van_week,
              start_uur: taak.start_uur,
              duur_uren: taak.duur_uren,
              plan_status: 'concept',
              is_hard_lock: false,
            });

          if (taakErr) {
            console.error('Taak creation error:', taakErr);
            errors.push(`Kon blok voor ${taak.werknemer_naam} niet plaatsen`);
          } else {
            aantalGeplaatst++;
          }
        }

        // 4. Sla resultaat op in chatgeschiedenis
        const resultMsg = errors.length > 0
          ? `Planning geplaatst met ${aantalGeplaatst} blokken. ${errors.length} blokken konden niet worden geplaatst.`
          : `Planning "${project.projectnummer}" aangemaakt met ${aantalGeplaatst} blokken als concept.`;

        try {
          await supabase.from('chat_gesprekken').insert({
            sessie_id,
            rol: 'assistant',
            inhoud: errors.length > 0 ? `⚠️ ${resultMsg}` : `✓ ${resultMsg}`,
          });
        } catch { /* ignore */ }

        return new Response(
          JSON.stringify({
            success: errors.length === 0,
            message: resultMsg,
            project_id: project.id,
            project_nummer: project.projectnummer,
            aantal_blokken: aantalGeplaatst,
            errors: errors.length > 0 ? errors : undefined,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (err) {
        console.error('Planning error:', err);
        return new Response(
          JSON.stringify({ success: false, message: `Er ging iets mis: ${(err as Error).message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!bericht) {
      return new Response(
        JSON.stringify({ error: 'bericht is verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Create Supabase client (service role bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 4. Laad planning configuratie en planner info parallel
    const [planningConfig, plannerInfo] = await Promise.all([
      loadPlanningConfig(supabase),
      supabase
        .from('medewerkers')
        .select('naam_werknemer, primaire_rol, tweede_rol, discipline, werkuren, parttime_dag, duo_team')
        .ilike('naam_werknemer', `%${session.naam}%`)
        .limit(1)
        .maybeSingle(),
    ]);

    // Bouw planner context
    let plannerContext = `\n\nJe praat nu met ${session.naam} (${session.rol}).`;
    const medewerker = plannerInfo.data;
    if (medewerker) {
      const parts = [`Rol: ${medewerker.primaire_rol}`];
      if (medewerker.tweede_rol) parts.push(`Tweede rol: ${medewerker.tweede_rol}`);
      if (medewerker.discipline) parts.push(`Discipline: ${medewerker.discipline}`);
      if (medewerker.werkuren) parts.push(`Werkuren: ${medewerker.werkuren}u/week`);
      if (medewerker.parttime_dag) parts.push(`Parttime dag: ${medewerker.parttime_dag}`);
      if (medewerker.duo_team) parts.push(`Duo team: ${medewerker.duo_team}`);
      plannerContext = `\n\nJe praat met ${medewerker.naam_werknemer}. ${parts.join('. ')}.`;
    }

    // Bouw volledige system prompt met dynamische planning regels
    const planningContext = buildPlanningContext(planningConfig);
    const fullSystemPrompt = CORE_PROMPT + planningContext + plannerContext;

    // 5. Load chat history (laatste 30 berichten voor context)
    let historyMessages: Array<{ rol: string; inhoud: string }> = [];
    try {
      const { data: history } = await supabase
        .from('chat_gesprekken')
        .select('rol, inhoud')
        .eq('sessie_id', sessie_id)
        .order('created_at', { ascending: true })
        .limit(30);
      if (history) historyMessages = history;
    } catch (e) {
      console.error('Kon chatgeschiedenis niet laden:', e);
    }

    // 6. Sla user bericht op
    try {
      await supabase.from('chat_gesprekken').insert({
        sessie_id,
        rol: 'user',
        inhoud: bericht,
      });
    } catch (e) {
      console.error('Kon bericht niet opslaan:', e);
    }

    // 7. Bouw OpenAI messages array
    // deno-lint-ignore no-explicit-any
    const openaiMessages: any[] = [
      { role: 'system', content: fullSystemPrompt },
    ];

    for (const msg of historyMessages) {
      // Strip [VOORSTEL:...] uit history zodat OpenAI dit patroon niet leert
      const cleanContent = msg.inhoud.replace(/\n*\[VOORSTEL:\{.*?\}\]/gs, '').trim();
      if (cleanContent) {
        openaiMessages.push({
          role: msg.rol === 'user' ? 'user' : 'assistant',
          content: cleanContent,
        });
      }
    }
    openaiMessages.push({ role: 'user', content: bericht });

    // 7. Check OpenAI key
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key niet geconfigureerd. Stel OPENAI_API_KEY in als Supabase secret.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Call OpenAI met tool calling loop (max 5 iteraties)
    let assistantMessage = '';
    // deno-lint-ignore no-explicit-any
    let pendingVoorstel: any = null; // Bewaar voorstel apart voor frontend
    // deno-lint-ignore no-explicit-any
    const currentMessages = [...openaiMessages];

    // Detecteer of dit een planning request is (bevat KRITIEKE INSTRUCTIE + plan_project)
    const isPlanningRequest = bericht.includes('KRITIEKE INSTRUCTIE') && bericht.includes('plan_project');

    for (let i = 0; i < 5; i++) {
      // Voor planning requests: forceer plan_project tool in eerste iteratie
      const toolChoice = (isPlanningRequest && i === 0)
        ? { type: 'function', function: { name: 'plan_project' } }
        : 'auto';

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: currentMessages,
          tools: TOOLS,
          tool_choice: toolChoice,
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('OpenAI API error:', errText);
        return new Response(
          JSON.stringify({ error: 'Fout bij communicatie met AI' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      if (!choice) {
        assistantMessage = 'Sorry, ik kreeg geen antwoord terug. Probeer het opnieuw.';
        break;
      }

      const message = choice.message;

      // Geen tool calls = definitief antwoord
      if (!message.tool_calls?.length) {
        assistantMessage = message.content || 'Ik had geen antwoord. Probeer het anders te formuleren.';
        break;
      }

      // Voeg assistant bericht met tool_calls toe aan context
      currentMessages.push(message);

      // Voer elke tool call uit
      for (const toolCall of message.tool_calls) {
        let toolArgs: Record<string, string> = {};
        try {
          toolArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          toolArgs = {};
        }

        const result = await executeTool(supabase, toolCall.function.name, toolArgs);

        // Als dit een voorstel is (wijziging of planning), bewaar het apart
        if (toolCall.function.name === 'stel_wijziging_voor' || toolCall.function.name === 'plan_project') {
          try {
            const parsed = JSON.parse(result);
            if (parsed.type === 'voorstel' || parsed.type === 'planning_voorstel') {
              pendingVoorstel = parsed;
            }
          } catch { /* ignore */ }
        }

        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    }

    // 9. Sla assistant antwoord op (inclusief voorstel-info als die er is)
    const opslaan = pendingVoorstel
      ? `${assistantMessage}\n\n[VOORSTEL:${JSON.stringify(pendingVoorstel)}]`
      : assistantMessage;
    try {
      await supabase.from('chat_gesprekken').insert({
        sessie_id,
        rol: 'assistant',
        inhoud: opslaan,
      });
    } catch (e) {
      console.error('Kon antwoord niet opslaan:', e);
    }

    // 10. Return antwoord + voorstel apart (strip eventuele [VOORSTEL:...] uit tekst)
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
