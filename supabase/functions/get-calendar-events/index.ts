// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const err = await response.text()
    console.error('Token aanvragen mislukt:', err)
    throw new Error('Kon geen Microsoft token ophalen')
  }

  return (await response.json()).access_token
}

// Haal agenda-events op via calendarView (werkt ook voor terugkerende afspraken)
// Gebruikt Prefer: outlook.timezone zodat tijden in Amsterdam-tijd terugkomen (niet UTC)
async function fetchCalendarEvents(
  accessToken: string,
  microsoftEmail: string,
  weekStartDate: string,  // YYYY-MM-DD (maandag)
  weekEndDate: string,    // YYYY-MM-DD (vrijdag)
): Promise<any[]> {
  // calendarView is beter dan events+filter: retourneert ook instanties van terugkerende afspraken
  const graphUrl = new URL(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(microsoftEmail)}/calendarView`
  )
  // Geen Z-suffix: tijden worden geïnterpreteerd in de timezone uit de Prefer header
  graphUrl.searchParams.append('startDateTime', `${weekStartDate}T00:00:00`)
  graphUrl.searchParams.append('endDateTime', `${weekEndDate}T23:59:59`)
  graphUrl.searchParams.append('$orderby', 'start/dateTime')
  graphUrl.searchParams.append('$top', '150')
  graphUrl.searchParams.append('$select', 'id,subject,start,end,location,isAllDay,showAs')

  const response = await fetch(graphUrl.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      // Zorgt dat alle dateTime-waarden in de response Amsterdam-tijd zijn
      'Prefer': 'outlook.timezone="Europe/Amsterdam"',
    },
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('Microsoft Graph API fout:', errText)
    throw new Error(`Kon agenda niet ophalen: ${response.status}`)
  }

  return (await response.json()).value || []
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { werknemerId, weekStart } = await req.json()

    if (!werknemerId || !weekStart) {
      return new Response(
        JSON.stringify({ error: 'werknemerId en weekStart zijn verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Haal microsoft_email op
    const { data: medewerker, error: medewerkerError } = await supabase
      .from('medewerkers')
      .select('microsoft_email, naam_werknemer')
      .eq('werknemer_id', werknemerId)
      .single()

    if (medewerkerError || !medewerker) {
      return new Response(
        JSON.stringify({ error: 'Medewerker niet gevonden', code: 'NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!medewerker.microsoft_email) {
      return new Response(
        JSON.stringify({ error: 'Geen Microsoft e-mail ingesteld voor deze medewerker', code: 'NOT_CONNECTED' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Bereken maandag t/m vrijdag (alleen de datum, geen tijd)
    const monday = new Date(weekStart)
    monday.setUTCHours(0, 0, 0, 0)
    const friday = new Date(monday)
    friday.setUTCDate(friday.getUTCDate() + 4)

    const weekStartDate = monday.toISOString().split('T')[0]  // YYYY-MM-DD
    const weekEndDate = friday.toISOString().split('T')[0]    // YYYY-MM-DD

    console.log(`Agenda ophalen voor ${medewerker.naam_werknemer} (${medewerker.microsoft_email}): ${weekStartDate} t/m ${weekEndDate}`)

    const accessToken = await getClientCredentialsToken()
    const events = await fetchCalendarEvents(accessToken, medewerker.microsoft_email, weekStartDate, weekEndDate)

    console.log(`${events.length} agenda-events gevonden`)

    // Transformeer naar ons formaat
    // Met Prefer:outlook.timezone zijn de dateTime-waarden al in Amsterdam-tijd
    const transformedEvents = events.map((event: any) => {
      const startDT: string = event.start.dateTime || ''
      const endDT: string = event.end.dateTime || ''
      const isAllDay = event.isAllDay || false

      return {
        id: event.id,
        title: event.subject || 'Geen onderwerp',
        date: isAllDay
          ? (event.start.date || startDT.split('T')[0])
          : startDT.split('T')[0],
        startTime: isAllDay ? null : startDT.split('T')[1]?.substring(0, 5) ?? null,
        endTime: isAllDay ? null : endDT.split('T')[1]?.substring(0, 5) ?? null,
        location: event.location?.displayName || null,
        isAllDay,
        showAs: event.showAs || 'busy',
      }
    })

    return new Response(
      JSON.stringify({ success: true, events: transformedEvents, count: transformedEvents.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Fout bij ophalen agenda-events:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Er is een fout opgetreden', code: 'ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
