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

const SYSTEM_PROMPT = `Je bent Ellen, planningsassistent van Selmore.

KRITIEKE REGELS - NOOIT BREKEN:
1. Je hebt GEEN eigen kennis over Selmore medewerkers, projecten, klanten, etc.
2. Bij ELKE vraag over data: EERST een zoek-tool gebruiken, DAN pas antwoorden
3. NOOIT antwoorden met informatie die niet uit een tool-resultaat komt
4. Als je geen tool hebt gebruikt, zeg je: "Even kijken..." en GEBRUIK DAN DE TOOL

Voorbeeld goede flow:
- Gebruiker: "Wie is Eline?"
- Jij: [ROEP zoek_medewerkers AAN met zoekterm "Eline"]
- Tool geeft resultaat → Jij antwoordt op basis van dat resultaat

Voorbeeld FOUTE flow (NOOIT DOEN):
- Gebruiker: "Wie is Eline?"
- Jij: "Eline is Account Manager..." ← FOUT! Je hebt geen tool gebruikt!

WIJZIGINGEN - STRIKT PROTOCOL:
1. Gebruiker wil iets aanpassen? → ROEP EERST zoek-tool aan om ID te vinden
2. ID gevonden? → ROEP stel_wijziging_voor tool AAN (VERPLICHT!)
3. NOOIT tekst schrijven zoals "Bevestig de wijziging" - de tool doet dat automatisch
4. Als je tekst schrijft over wijzigen zonder de tool aan te roepen = FOUT

Voorbeeld goed:
- Gebruiker: "Pas Editor aan naar Studio"
- Jij: [ROEP zoek_disciplines AAN] → krijgt ID 6
- Jij: [ROEP stel_wijziging_voor AAN met tabel="disciplines", id="6", veld="discipline_naam", nieuwe_waarde="Studio"]
- Tool geeft bevestigknop aan gebruiker

Persoonlijkheid (secundair):
- Kort en bondig, praat als collega
- "Jakko? Creative Director, 40 uur." (niet: "De medewerker Jakko heeft als rol...")
- Geef alleen relevante info, niet alle velden`;

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
];

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
        if (args.zoekterm) {
          query = query.ilike('naam_werknemer', `%${sanitize(args.zoekterm)}%`);
        }
        if (args.discipline) {
          query = query.ilike('discipline', `%${sanitize(args.discipline)}%`);
        }
        const { data, error } = await query.order('naam_werknemer').limit(20);
        if (error) return `Fout: ${error.message}`;
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

    // 4. Haal extra info over de ingelogde planner op
    let plannerContext = `\n\nJe praat nu met ${session.naam} (${session.rol}).`;
    try {
      const { data: medewerker } = await supabase
        .from('medewerkers')
        .select('naam_werknemer, primaire_rol, tweede_rol, discipline, werkuren, parttime_dag, duo_team')
        .ilike('naam_werknemer', `%${session.naam}%`)
        .limit(1)
        .single();
      if (medewerker) {
        const parts = [`Rol: ${medewerker.primaire_rol}`];
        if (medewerker.tweede_rol) parts.push(`Tweede rol: ${medewerker.tweede_rol}`);
        if (medewerker.discipline) parts.push(`Discipline: ${medewerker.discipline}`);
        if (medewerker.werkuren) parts.push(`Werkuren: ${medewerker.werkuren}u/week`);
        if (medewerker.parttime_dag) parts.push(`Parttime dag: ${medewerker.parttime_dag}`);
        if (medewerker.duo_team) parts.push(`Duo team: ${medewerker.duo_team}`);
        plannerContext = `\n\nJe praat met ${medewerker.naam_werknemer}. ${parts.join('. ')}.`;
      }
    } catch {
      // Geen match gevonden, gebruik basis sessie-info
    }

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
      { role: 'system', content: SYSTEM_PROMPT + plannerContext },
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

    for (let i = 0; i < 5; i++) {
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
          tool_choice: 'auto',
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

        // Als dit een wijzigingsvoorstel is, bewaar het apart
        if (toolCall.function.name === 'stel_wijziging_voor') {
          try {
            const parsed = JSON.parse(result);
            if (parsed.type === 'voorstel') {
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
