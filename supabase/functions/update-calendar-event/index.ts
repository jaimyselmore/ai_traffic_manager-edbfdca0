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
    const { werknemerId, eventId, updates } = await req.json()
    // updates: { subject?, startDateTime?, endDateTime?, body? }
    if (!werknemerId || !eventId || !updates) {
      return new Response(JSON.stringify({ error: 'werknemerId, eventId en updates zijn verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: med } = await supabase.from('medewerkers').select('microsoft_email').eq('werknemer_id', werknemerId).single()
    if (!med?.microsoft_email) {
      return new Response(JSON.stringify({ error: 'Geen Microsoft e-mail' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const token = await getToken()

    // Bouw het PATCH body op
    const patch: any = {}
    if (updates.subject !== undefined) patch.subject = updates.subject
    if (updates.startDateTime) {
      patch.start = { dateTime: updates.startDateTime, timeZone: 'Europe/Amsterdam' }
    }
    if (updates.endDateTime) {
      patch.end = { dateTime: updates.endDateTime, timeZone: 'Europe/Amsterdam' }
    }
    if (updates.body !== undefined) {
      patch.body = { contentType: 'text', content: updates.body }
    }
    if (updates.location !== undefined) {
      patch.location = { displayName: updates.location }
    }

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(med.microsoft_email)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('Graph PATCH fout:', err)
      return new Response(JSON.stringify({ error: `Microsoft API fout: ${res.status}`, details: err }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
