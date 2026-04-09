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

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  const response = await fetch(tokenUrl, {
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

// Haal agenda-events op voor een specifiek e-mailadres
async function fetchCalendarEvents(
  accessToken: string,
  microsoftEmail: string,
  startDateTime: string,
  endDateTime: string
): Promise<any[]> {
  const graphUrl = new URL(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(microsoftEmail)}/calendar/events`)
  graphUrl.searchParams.append('$filter', `start/dateTime ge '${startDateTime}' and end/dateTime le '${endDateTime}'`)
  graphUrl.searchParams.append('$orderby', 'start/dateTime')
  graphUrl.searchParams.append('$top', '100')
  graphUrl.searchParams.append('$select', 'id,subject,start,end,location,isAllDay,showAs')

  const response = await fetch(graphUrl.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Microsoft Graph API fout:', errorText)
    throw new Error('Kon agenda niet ophalen uit Microsoft')
  }

  const data = await response.json()
  return data.value || []
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { werknemerId, weekStart } = await req.json()

    if (!werknemerId) {
      return new Response(
        JSON.stringify({ error: 'werknemerId is verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!weekStart) {
      return new Response(
        JSON.stringify({ error: 'weekStart is verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Haal microsoft_email op van de medewerker
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
        JSON.stringify({ error: 'Medewerker heeft geen Microsoft e-mail ingesteld', code: 'NOT_CONNECTED' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Agenda ophalen voor ${medewerker.naam_werknemer} (${medewerker.microsoft_email}), week: ${weekStart}`)

    // Haal app-level token op
    const accessToken = await getClientCredentialsToken()

    // Bereken datumbereik (maandag t/m vrijdag)
    const startDate = new Date(weekStart)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 4)
    endDate.setHours(23, 59, 59, 999)

    const startDateTime = startDate.toISOString()
    const endDateTime = endDate.toISOString()

    console.log(`Events ophalen van ${startDateTime} tot ${endDateTime}`)

    const events = await fetchCalendarEvents(accessToken, medewerker.microsoft_email, startDateTime, endDateTime)

    console.log(`${events.length} agenda-events gevonden`)

    // Transformeer naar ons formaat
    const transformedEvents = events.map((event: any) => ({
      id: event.id,
      title: event.subject || 'Geen onderwerp',
      date: event.start.dateTime ? event.start.dateTime.split('T')[0] : event.start.date,
      startTime: event.start.dateTime ? event.start.dateTime.split('T')[1].substring(0, 5) : null,
      endTime: event.end.dateTime ? event.end.dateTime.split('T')[1].substring(0, 5) : null,
      location: event.location?.displayName || null,
      isAllDay: event.isAllDay || false,
      showAs: event.showAs || 'busy',
    }))

    return new Response(
      JSON.stringify({
        success: true,
        events: transformedEvents,
        count: transformedEvents.length,
      }),
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
