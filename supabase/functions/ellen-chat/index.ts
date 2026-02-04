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

const SYSTEM_PROMPT = `Je bent Ellen, de AI-planningsassistent van Selmore, een creatief mediabedrijf.

Je helpt planners met:
- Projecten, deadlines, status
- Teamcapaciteit en beschikbaarheid
- Planning, taken, werkverdelingen
- Klantinfo, meetings, verlof

Stijl:
- Compact: geen wollige zinnen, recht op de kern
- Direct: geef het antwoord eerst, toelichting daarna
- Kritisch: signaleer problemen en risico's proactief, draai er niet omheen
- Formeel maar niet stijf: zakelijke toon, af en toe een droge opmerking mag
- Gebruik opsommingen, geen lappen tekst

Regels:
- ALTIJD Nederlands
- Gebruik je tools om data op te zoeken - raad nooit
- Meerdere dingen opzoeken? Doe het gewoon, geen toestemming vragen
- Kun je iets niet vinden? Zeg het kort en helder
- Geen disclaimers of excuses tenzij het echt nodig is`;

// ---- OPENAI TOOL DEFINITIONS ----

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'zoek_klanten',
      description: 'Zoek klanten op naam of klantnummer. Geeft klantgegevens terug inclusief contactpersoon, email, telefoon, planning instructies.',
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
          .select('klantnummer, naam, contactpersoon, email, telefoon, adres, beschikbaarheid, interne_notities, planning_instructies')
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
          .select('projectnummer, omschrijving, projecttype, deadline, status, datum_aanvraag, opmerkingen');
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
          .select('werknemer_naam, klant_naam, project_nummer, fase_naam, werktype, discipline, week_start, dag_van_week, start_uur, duur_uren, plan_status, is_hard_lock');
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
          .select('werknemer_naam, type, start_datum, eind_datum, reden, status');
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

      default:
        return `Onbekende tool: ${toolName}`;
    }
  } catch (err) {
    return `Fout bij ${toolName}: ${(err as Error).message}`;
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
    const { sessie_id, bericht } = await req.json();
    if (!sessie_id || !bericht) {
      return new Response(
        JSON.stringify({ error: 'sessie_id en bericht zijn verplicht' }),
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
      openaiMessages.push({
        role: msg.rol === 'user' ? 'user' : 'assistant',
        content: msg.inhoud,
      });
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
        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    }

    // 9. Sla assistant antwoord op
    try {
      await supabase.from('chat_gesprekken').insert({
        sessie_id,
        rol: 'assistant',
        inhoud: assistantMessage,
      });
    } catch (e) {
      console.error('Kon antwoord niet opslaan:', e);
    }

    // 10. Return antwoord
    return new Response(
      JSON.stringify({ antwoord: assistantMessage }),
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
