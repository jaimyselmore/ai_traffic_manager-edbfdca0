// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface WerkDag {
  werkt: boolean
  start?: number
  eind?: number
  reden?: string
}

interface Werktijden {
  maandag: WerkDag
  dinsdag: WerkDag
  woensdag: WerkDag
  donderdag: WerkDag
  vrijdag: WerkDag
}

const dagNaarMsCode: Record<string, string> = {
  maandag: 'monday',
  dinsdag: 'tuesday',
  woensdag: 'wednesday',
  donderdag: 'thursday',
  vrijdag: 'friday',
}

// Haal een app-level access token op via client credentials flow
async function getClientCredentialsToken(): Promise<string> {
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')!
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')!
  const tenantId = Deno.env.get('MICROSOFT_TENANT_ID')!

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Token aanvragen mislukt:', errorText)
    throw new Error('Kon geen Microsoft token ophalen')
  }

  const data = await response.json()
  return data.access_token
}

// Maak een terugkerend "niet werkzaam" event aan voor een medewerker
async function createRecurringEvent(
  accessToken: string,
  microsoftEmail: string,
  dayOfWeek: string,
  employeeName: string
): Promise<string | null> {
  const eventBody = {
    subject: `Niet werkzaam - Parttime dag`,
    body: {
      contentType: 'text',
      content: `${employeeName} werkt niet op ${dayOfWeek}. Automatisch gegenereerd door het planningsysteem.`,
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
    showAs: 'oof',
    isAllDay: false,
    categories: ['Parttime', 'Planningsysteem'],
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(microsoftEmail)}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  })

  if (!response.ok) {
    console.error('Event aanmaken mislukt:', await response.text())
    return null
  }

  const data = await response.json()
  return data.id
}

// Verwijder een event uit de agenda van een medewerker
async function deleteEvent(
  accessToken: string,
  microsoftEmail: string,
  eventId: string
): Promise<boolean> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(microsoftEmail)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  return response.ok || response.status === 404
}

function getNextDayOfWeek(dayName: string, hour: number): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const targetDay = days.indexOf(dayName)
  const now = new Date()
  let daysUntilTarget = targetDay - now.getDay()
  if (daysUntilTarget <= 0) daysUntilTarget += 7
  const targetDate = new Date(now)
  targetDate.setDate(now.getDate() + daysUntilTarget)
  targetDate.setHours(hour, 0, 0, 0)
  return targetDate.toISOString().replace('Z', '')
}

function getNextDayOfWeekDate(dayName: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const targetDay = days.indexOf(dayName)
  const now = new Date()
  let daysUntilTarget = targetDay - now.getDay()
  if (daysUntilTarget <= 0) daysUntilTarget += 7
  const targetDate = new Date(now)
  targetDate.setDate(now.getDate() + daysUntilTarget)
  return targetDate.toISOString().split('T')[0]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { medewerker_id } = await req.json()

    if (!medewerker_id) {
      return new Response(
        JSON.stringify({ error: 'medewerker_id is verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Haal medewerker op inclusief microsoft_email en werktijden
    const { data: medewerker, error: medewerkerError } = await supabase
      .from('medewerkers')
      .select('werknemer_id, naam_werknemer, microsoft_email, werktijden, microsoft_parttime_event_ids')
      .eq('werknemer_id', medewerker_id)
      .single()

    if (medewerkerError || !medewerker) {
      return new Response(
        JSON.stringify({ error: 'Medewerker niet gevonden' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!medewerker.microsoft_email) {
      return new Response(
        JSON.stringify({ error: 'Medewerker heeft geen Microsoft e-mail ingesteld' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const microsoftEmail = medewerker.microsoft_email

    // Haal app-level token op
    const accessToken = await getClientCredentialsToken()

    // Verwijder bestaande parttime events
    const existingEventIds: string[] = medewerker.microsoft_parttime_event_ids || []
    for (const eventId of existingEventIds) {
      await deleteEvent(accessToken, microsoftEmail, eventId)
    }

    // Maak nieuwe events aan voor niet-werkdagen
    const werktijden: Werktijden = medewerker.werktijden || {
      maandag: { werkt: true },
      dinsdag: { werkt: true },
      woensdag: { werkt: true },
      donderdag: { werkt: true },
      vrijdag: { werkt: true },
    }

    const newEventIds: string[] = []
    const createdDays: string[] = []

    for (const [dag, config] of Object.entries(werktijden)) {
      if (!config.werkt) {
        const msDay = dagNaarMsCode[dag]
        const eventId = await createRecurringEvent(
          accessToken,
          microsoftEmail,
          msDay,
          medewerker.naam_werknemer
        )
        if (eventId) {
          newEventIds.push(eventId)
          createdDays.push(dag)
        }
      }
    }

    // Sla nieuwe event IDs op
    await supabase
      .from('medewerkers')
      .update({
        microsoft_parttime_event_ids: newEventIds,
        parttime_synced_to_microsoft: true,
      })
      .eq('werknemer_id', medewerker_id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Parttime dagen gesynchroniseerd naar Microsoft Calendar',
        synced_days: createdDays,
        event_ids: newEventIds,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Fout in sync-parttime-to-microsoft:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Onbekende fout' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
