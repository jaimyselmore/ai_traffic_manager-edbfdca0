import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { verify } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface WerkDag {
  werkt: boolean;
  start?: number;
  eind?: number;
  reden?: string;
}

interface Werktijden {
  maandag: WerkDag;
  dinsdag: WerkDag;
  woensdag: WerkDag;
  donderdag: WerkDag;
  vrijdag: WerkDag;
}

interface BezettePeriode {
  start: number;
  eind: number;
  type: 'meeting' | 'planning' | 'afspraak' | 'verlof' | 'parttime';
  bron: 'microsoft' | 'supabase';
  titel?: string;
  project?: string;
}

interface VrijePeriode {
  start: number;
  eind: number;
  duur: number;
}

interface DagBeschikbaarheid {
  datum: string;
  dagNaam: string;
  isWerkdag: boolean;
  reden?: string;
  werktijd?: { start: number; eind: number };
  bezet: BezettePeriode[];
  vrij: VrijePeriode[];
  vrijeUren: number;
  totaleWerkuren: number;
}

interface BeschikbaarheidResponse {
  medewerker: {
    id: number;
    naam: string;
    microsoftConnected: boolean;
  };
  periode: {
    start: string;
    eind: string;
  };
  dagen: DagBeschikbaarheid[];
  samenvatting: {
    totaleWerkuren: number;
    totaleVrijeUren: number;
    bezettingspercentage: number;
  };
}

// Helper to get day name in Dutch
function getDagNaam(date: Date): keyof Werktijden {
  const dagen: (keyof Werktijden)[] = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag'];
  const dayIndex = date.getDay();
  // Sunday = 0, Monday = 1, etc. We need Mon-Fri (1-5)
  if (dayIndex === 0 || dayIndex === 6) return 'maandag'; // Weekend, shouldn't happen
  return dagen[dayIndex - 1];
}

// Helper to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Calculate free periods from busy periods
function calculateVrijePeriodes(
  werktijd: { start: number; eind: number },
  bezet: BezettePeriode[]
): VrijePeriode[] {
  const vrij: VrijePeriode[] = [];

  // Sort busy periods by start time
  const sortedBezet = [...bezet].sort((a, b) => a.start - b.start);

  let currentStart = werktijd.start;

  for (const periode of sortedBezet) {
    if (periode.start > currentStart) {
      vrij.push({
        start: currentStart,
        eind: periode.start,
        duur: periode.start - currentStart,
      });
    }
    currentStart = Math.max(currentStart, periode.eind);
  }

  // Add remaining time after last busy period
  if (currentStart < werktijd.eind) {
    vrij.push({
      start: currentStart,
      eind: werktijd.eind,
      duur: werktijd.eind - currentStart,
    });
  }

  return vrij;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Geen autorisatie' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const jwtSecret = Deno.env.get('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    // Verify token
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    await verify(token, key);

    // Get request body
    const { medewerker_id, start_datum, eind_datum } = await req.json();

    if (!medewerker_id || !start_datum || !eind_datum) {
      return new Response(
        JSON.stringify({ error: 'medewerker_id, start_datum en eind_datum zijn verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get medewerker info including werktijden
    const { data: medewerker, error: medewerkerError } = await supabase
      .from('medewerkers')
      .select('werknemer_id, naam_werknemer, werktijden, microsoft_connected, microsoft_email')
      .eq('werknemer_id', medewerker_id)
      .single();

    if (medewerkerError || !medewerker) {
      return new Response(
        JSON.stringify({ error: 'Medewerker niet gevonden' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default werktijden if not set
    const werktijden: Werktijden = medewerker.werktijden || {
      maandag: { werkt: true, start: 9, eind: 17 },
      dinsdag: { werkt: true, start: 9, eind: 17 },
      woensdag: { werkt: true, start: 9, eind: 17 },
      donderdag: { werkt: true, start: 9, eind: 17 },
      vrijdag: { werkt: true, start: 9, eind: 17 },
    };

    // 2. Get verlof/ziek from beschikbaarheid_medewerkers
    const { data: verlofData } = await supabase
      .from('beschikbaarheid_medewerkers')
      .select('*')
      .eq('werknemer_naam', medewerker.naam_werknemer)
      .eq('status', 'goedgekeurd')
      .lte('start_datum', eind_datum)
      .gte('eind_datum', start_datum);

    // 3. Get existing planning from taken table
    const { data: takenData } = await supabase
      .from('taken')
      .select('*')
      .eq('werknemer_naam', medewerker.naam_werknemer)
      .gte('week_start', start_datum)
      .lte('week_start', eind_datum);

    // 4. Get Microsoft Calendar events (if connected)
    let microsoftEvents: Array<{
      date: string;
      startTime: string;
      endTime: string;
      title: string;
      showAs: string;
    }> = [];

    if (medewerker.microsoft_connected) {
      try {
        // Get tokens from microsoft_tokens table
        const { data: tokenData } = await supabase
          .from('microsoft_tokens')
          .select('access_token_encrypted, refresh_token_encrypted, token_expires_at')
          .eq('werknemer_id', medewerker_id)
          .single();

        if (tokenData) {
          // Call Microsoft Graph API
          // Note: In production, you'd decrypt the token and call the API
          // For now, we'll handle this in a separate function
          console.log('Microsoft tokens found, would fetch calendar events');
          // microsoftEvents = await fetchMicrosoftEvents(tokenData, start_datum, eind_datum);
        }
      } catch (msError) {
        console.error('Error fetching Microsoft events:', msError);
      }
    }

    // 5. Build day-by-day beschikbaarheid
    const dagen: DagBeschikbaarheid[] = [];
    const startDate = new Date(start_datum);
    const endDate = new Date(eind_datum);

    let totaleWerkuren = 0;
    let totaleVrijeUren = 0;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();

      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const datumStr = formatDate(d);
      const dagNaam = getDagNaam(d);
      const dagConfig = werktijden[dagNaam];

      // Check if it's a workday based on werktijden
      if (!dagConfig.werkt) {
        dagen.push({
          datum: datumStr,
          dagNaam,
          isWerkdag: false,
          reden: dagConfig.reden || 'Niet werkzaam',
          bezet: [],
          vrij: [],
          vrijeUren: 0,
          totaleWerkuren: 0,
        });
        continue;
      }

      const werktijd = {
        start: dagConfig.start || 9,
        eind: dagConfig.eind || 17,
      };

      const bezet: BezettePeriode[] = [];

      // Check verlof/ziek for this day
      const verlofOpDag = (verlofData || []).filter((v) => {
        const vStart = new Date(v.start_datum);
        const vEind = new Date(v.eind_datum);
        return d >= vStart && d <= vEind;
      });

      if (verlofOpDag.length > 0) {
        // Full day verlof
        bezet.push({
          start: werktijd.start,
          eind: werktijd.eind,
          type: 'verlof',
          bron: 'supabase',
          titel: verlofOpDag[0].type + (verlofOpDag[0].reden ? `: ${verlofOpDag[0].reden}` : ''),
        });
      }

      // Add existing planning blocks
      const takenOpDag = (takenData || []).filter((t) => {
        // Match by week_start and dag_van_week
        const taakWeekStart = new Date(t.week_start);
        const currentWeekStart = getMonday(d);
        const dagVanWeek = dayOfWeek - 1; // 0 = Monday

        return (
          taakWeekStart.getTime() === currentWeekStart.getTime() &&
          t.dag_van_week === dagVanWeek
        );
      });

      for (const taak of takenOpDag) {
        bezet.push({
          start: taak.start_uur,
          eind: taak.start_uur + taak.duur_uren,
          type: 'planning',
          bron: 'supabase',
          titel: taak.taak_titel,
          project: taak.project_naam,
        });
      }

      // Add Microsoft Calendar events
      const msEventsOpDag = microsoftEvents.filter((e) => e.date === datumStr && e.showAs !== 'free');
      for (const event of msEventsOpDag) {
        const startHour = parseInt(event.startTime.split(':')[0]);
        const endHour = parseInt(event.endTime.split(':')[0]);
        bezet.push({
          start: startHour,
          eind: endHour,
          type: 'afspraak',
          bron: 'microsoft',
          titel: event.title,
        });
      }

      // Calculate free periods
      const vrij = calculateVrijePeriodes(werktijd, bezet);
      const vrijeUren = vrij.reduce((sum, v) => sum + v.duur, 0);
      const dagWerkuren = werktijd.eind - werktijd.start;

      totaleWerkuren += dagWerkuren;
      totaleVrijeUren += vrijeUren;

      dagen.push({
        datum: datumStr,
        dagNaam,
        isWerkdag: true,
        werktijd,
        bezet,
        vrij,
        vrijeUren,
        totaleWerkuren: dagWerkuren,
      });
    }

    // Calculate summary
    const bezettingspercentage = totaleWerkuren > 0
      ? Math.round(((totaleWerkuren - totaleVrijeUren) / totaleWerkuren) * 100)
      : 0;

    const response: BeschikbaarheidResponse = {
      medewerker: {
        id: medewerker.werknemer_id,
        naam: medewerker.naam_werknemer,
        microsoftConnected: medewerker.microsoft_connected || false,
      },
      periode: {
        start: start_datum,
        eind: eind_datum,
      },
      dagen,
      samenvatting: {
        totaleWerkuren,
        totaleVrijeUren,
        bezettingspercentage,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-beschikbaarheid:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Onbekende fout' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to get Monday of a week
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
