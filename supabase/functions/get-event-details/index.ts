// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getToken(): Promise<string> {
  const params = new URLSearchParams({
    client_id: Deno.env.get('MICROSOFT_CLIENT_ID')!,
    client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET')!,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })
  const res = await fetch(
    `https://login.microsoftonline.com/${Deno.env.get('MICROSOFT_TENANT_ID')!}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() }
  )
  if (!res.ok) throw new Error('Kon geen Microsoft token ophalen')
  return (await res.json()).access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { werknemerId, eventId } = await req.json()
    if (!werknemerId || !eventId) {
      return new Response(JSON.stringify({ error: 'werknemerId en eventId zijn verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: med } = await supabase.from('medewerkers').select('microsoft_email').eq('werknemer_id', werknemerId).single()
    if (!med?.microsoft_email) {
      return new Response(JSON.stringify({ error: 'Geen Microsoft e-mail' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const token = await getToken()
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(med.microsoft_email)}/events/${encodeURIComponent(eventId)}` +
      `?$select=id,subject,start,end,location,isAllDay,organizer,attendees,body,webLink,showAs,categories`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Prefer': 'outlook.timezone="Europe/Amsterdam"',
        },
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('Graph API fout:', err)
      return new Response(JSON.stringify({ error: `Microsoft API fout: ${res.status}` }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const ev: any = await res.json()

    const statusMap: Record<string, string> = {
      accepted: 'accepted', tentativelyAccepted: 'tentative',
      declined: 'declined', notResponded: 'none', none: 'none',
    }

    return new Response(JSON.stringify({
      id: ev.id,
      title: ev.subject || 'Geen onderwerp',
      start: ev.start?.dateTime || null,
      end: ev.end?.dateTime || null,
      isAllDay: ev.isAllDay || false,
      location: ev.location?.displayName || null,
      webLink: ev.webLink || null,
      organizer: {
        name: ev.organizer?.emailAddress?.name || '',
        email: ev.organizer?.emailAddress?.address || '',
      },
      attendees: (ev.attendees || []).map((a: any) => ({
        name: a.emailAddress?.name || '',
        email: a.emailAddress?.address || '',
        status: statusMap[a.status?.response] || 'none',
        type: a.type || 'required',
      })),
      body: ev.body?.content ? ev.body.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().substring(0, 500) : '',
      categories: ev.categories || [],
      showAs: ev.showAs || 'busy',
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
