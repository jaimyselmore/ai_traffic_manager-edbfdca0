import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { verify } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';
import CryptoJS from 'https://esm.sh/crypto-js@4.2.0';

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

// Map Dutch day names to Microsoft Graph API day codes
const dagNaarMsCode: Record<string, string> = {
  maandag: 'monday',
  dinsdag: 'tuesday',
  woensdag: 'wednesday',
  donderdag: 'thursday',
  vrijdag: 'friday',
};

// Decrypt token helper
function decryptToken(encryptedToken: string): string {
  const encryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY');
  if (!encryptionKey) throw new Error('TOKEN_ENCRYPTION_KEY not set');

  const bytes = CryptoJS.AES.decrypt(encryptedToken, encryptionKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// Refresh Microsoft access token if expired
async function refreshAccessToken(
  refreshToken: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  werknemerId: number
): Promise<string> {
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Microsoft credentials not configured');
  }

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'User.Read Calendars.ReadWrite offline_access',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Microsoft token');
  }

  const data = await response.json();

  // Encrypt and save new tokens
  const encryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY')!;
  const encryptedAccess = CryptoJS.AES.encrypt(data.access_token, encryptionKey).toString();
  const encryptedRefresh = CryptoJS.AES.encrypt(data.refresh_token, encryptionKey).toString();

  await supabase
    .from('microsoft_tokens')
    .update({
      access_token_encrypted: encryptedAccess,
      refresh_token_encrypted: encryptedRefresh,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('werknemer_id', werknemerId);

  return data.access_token;
}

// Create recurring event in Microsoft Calendar
async function createRecurringEvent(
  accessToken: string,
  dayOfWeek: string,
  employeeName: string
): Promise<string | null> {
  const eventBody = {
    subject: `Niet werkzaam - Parttime dag`,
    body: {
      contentType: 'text',
      content: `${employeeName} werkt niet op ${dayOfWeek}. Dit is een automatisch gegenereerd event door het planningsysteem.`,
    },
    start: {
      dateTime: getNextDayOfWeek(dayOfWeek, 9),
      timeZone: 'Europe/Amsterdam',
    },
    end: {
      dateTime: getNextDayOfWeek(dayOfWeek, 17),
      timeZone: 'Europe/Amsterdam',
    },
    recurrence: {
      pattern: {
        type: 'weekly',
        interval: 1,
        daysOfWeek: [dayOfWeek],
      },
      range: {
        type: 'noEnd',
        startDate: getNextDayOfWeekDate(dayOfWeek),
      },
    },
    showAs: 'oof', // Out of Office
    isAllDay: false,
    categories: ['Parttime', 'Planningsysteem'],
  };

  const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  });

  if (!response.ok) {
    console.error('Failed to create Microsoft event:', await response.text());
    return null;
  }

  const data = await response.json();
  return data.id;
}

// Delete event from Microsoft Calendar
async function deleteEvent(accessToken: string, eventId: string): Promise<boolean> {
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.ok || response.status === 404; // 404 means already deleted
}

// Helper to get next occurrence of a day of week
function getNextDayOfWeek(dayName: string, hour: number): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = days.indexOf(dayName);

  const now = new Date();
  const currentDay = now.getDay();
  let daysUntilTarget = targetDay - currentDay;

  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7;
  }

  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysUntilTarget);
  targetDate.setHours(hour, 0, 0, 0);

  return targetDate.toISOString().replace('Z', '');
}

function getNextDayOfWeekDate(dayName: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = days.indexOf(dayName);

  const now = new Date();
  const currentDay = now.getDay();
  let daysUntilTarget = targetDay - currentDay;

  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7;
  }

  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysUntilTarget);

  return targetDate.toISOString().split('T')[0];
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

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    await verify(token, key);

    // Get request body
    const { medewerker_id } = await req.json();

    if (!medewerker_id) {
      return new Response(
        JSON.stringify({ error: 'medewerker_id is verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get medewerker info
    const { data: medewerker, error: medewerkerError } = await supabase
      .from('medewerkers')
      .select('werknemer_id, naam_werknemer, werktijden, microsoft_connected, microsoft_parttime_event_ids')
      .eq('werknemer_id', medewerker_id)
      .single();

    if (medewerkerError || !medewerker) {
      return new Response(
        JSON.stringify({ error: 'Medewerker niet gevonden' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!medewerker.microsoft_connected) {
      return new Response(
        JSON.stringify({ error: 'Medewerker heeft geen Microsoft account gekoppeld' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get Microsoft tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('microsoft_tokens')
      .select('access_token_encrypted, refresh_token_encrypted, token_expires_at')
      .eq('werknemer_id', medewerker_id)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: 'Microsoft tokens niet gevonden' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get valid access token (refresh if needed)
    let accessToken: string;
    const tokenExpires = new Date(tokenData.token_expires_at);

    if (tokenExpires <= new Date()) {
      // Token expired, refresh it
      const refreshToken = decryptToken(tokenData.refresh_token_encrypted);
      accessToken = await refreshAccessToken(refreshToken, supabase, medewerker_id);
    } else {
      accessToken = decryptToken(tokenData.access_token_encrypted);
    }

    // 4. Delete existing parttime events
    const existingEventIds = medewerker.microsoft_parttime_event_ids || [];
    for (const eventId of existingEventIds) {
      await deleteEvent(accessToken, eventId);
    }

    // 5. Create new parttime events based on werktijden
    const werktijden: Werktijden = medewerker.werktijden || {
      maandag: { werkt: true },
      dinsdag: { werkt: true },
      woensdag: { werkt: true },
      donderdag: { werkt: true },
      vrijdag: { werkt: true },
    };

    const newEventIds: string[] = [];
    const createdDays: string[] = [];

    for (const [dag, config] of Object.entries(werktijden)) {
      if (!config.werkt) {
        const msDay = dagNaarMsCode[dag];
        const eventId = await createRecurringEvent(
          accessToken,
          msDay,
          medewerker.naam_werknemer
        );

        if (eventId) {
          newEventIds.push(eventId);
          createdDays.push(dag);
        }
      }
    }

    // 6. Update medewerker with new event IDs
    await supabase
      .from('medewerkers')
      .update({
        microsoft_parttime_event_ids: newEventIds,
        parttime_synced_to_microsoft: true,
      })
      .eq('werknemer_id', medewerker_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Parttime dagen gesynchroniseerd naar Microsoft Calendar`,
        synced_days: createdDays,
        event_ids: newEventIds,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-parttime-to-microsoft:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Onbekende fout' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
