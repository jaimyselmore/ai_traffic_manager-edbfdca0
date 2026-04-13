// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function getClientCredentialsToken(): Promise<string> {
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

const typeLabels: Record<string, string> = {
  concept: 'Concept',
  review: 'Review',
  uitwerking: 'Uitwerking',
  productie: 'Productie',
  extern: 'Extern',
  optie: 'Optie',
}

const dagNaarIndex: Record<string, number> = {
  maandag: 0, dinsdag: 1, woensdag: 2, donderdag: 3, vrijdag: 4,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { werknemerId, taakIds } = await req.json()

    if (!werknemerId || !Array.isArray(taakIds) || taakIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'werknemerId en taakIds zijn verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Haal medewerker op
    const { data: medewerker, error: mErr } = await supabase
      .from('medewerkers')
      .select('microsoft_email, naam_werknemer')
      .eq('werknemer_id', werknemerId)
      .single()

    if (mErr || !medewerker?.microsoft_email) {
      return new Response(
        JSON.stringify({ error: 'Medewerker niet gevonden of geen Microsoft e-mail ingesteld', code: 'NOT_CONNECTED' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Haal taken op
    const { data: taken, error: takenErr } = await supabase
      .from('taken')
      .select('id, dag_van_week, start_uur, duur_uren, plan_status, klant_naam, werktype, week_start')
      .in('id', taakIds)

    if (takenErr || !taken) {
      return new Response(
        JSON.stringify({ error: 'Kon taken niet ophalen' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const accessToken = await getClientCredentialsToken()
    const results: { taakId: string; success: boolean; eventId?: string; error?: string }[] = []

    for (const taak of taken) {
      try {
        const dagIndex = dagNaarIndex[taak.dag_van_week]
        if (dagIndex === undefined) {
          results.push({ taakId: taak.id, success: false, error: `Onbekende dag: ${taak.dag_van_week}` })
          continue
        }

        // Bereken de exacte datum (week_start is maandag, + dagIndex)
        const weekStartDate = new Date(taak.week_start + 'T00:00:00')
        weekStartDate.setDate(weekStartDate.getDate() + dagIndex)
        const dateStr = taak.week_start.substring(0, 4) + '-' +
          String(weekStartDate.getMonth() + 1).padStart(2, '0') + '-' +
          String(weekStartDate.getDate()).padStart(2, '0')

        const startH = taak.start_uur ?? 9
        const duur = taak.duur_uren ?? 1
        const endH = Math.min(startH + duur, 23)

        const startDateTime = `${dateStr}T${String(startH).padStart(2, '0')}:00:00`
        const endDateTime = `${dateStr}T${String(endH).padStart(2, '0')}:00:00`

        const typeLabel = typeLabels[taak.plan_status] || taak.plan_status || 'Planning'
        const title = taak.klant_naam
          ? `${taak.klant_naam} – ${typeLabel}`
          : taak.werktype || typeLabel

        const body = {
          subject: title,
          body: {
            contentType: 'text',
            content: `Planningsblok: ${title}\nType: ${typeLabel}\nTijd: ${String(startH).padStart(2, '0')}:00 – ${String(endH).padStart(2, '0')}:00\n\nAutomatisch aangemaakt via AI Traffic Manager.`,
          },
          start: { dateTime: startDateTime, timeZone: 'Europe/Amsterdam' },
          end: { dateTime: endDateTime, timeZone: 'Europe/Amsterdam' },
          showAs: 'busy',
          categories: ['Planning', 'AI Traffic Manager'],
        }

        const res = await fetch(
          `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(medewerker.microsoft_email)}/events`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        )

        if (res.ok) {
          const created = await res.json()
          results.push({ taakId: taak.id, success: true, eventId: created.id })
          console.log(`Event aangemaakt voor taak ${taak.id}: ${created.id}`)
        } else {
          const errText = await res.text()
          console.error(`Event aanmaken mislukt voor taak ${taak.id}:`, errText)
          results.push({ taakId: taak.id, success: false, error: `Microsoft API fout: ${res.status}` })
        }
      } catch (e: any) {
        results.push({ taakId: taak.id, success: false, error: e.message })
      }
    }

    const succeeded = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({ success: true, results, succeeded, failed }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Fout in add-planning-to-calendar:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Onbekende fout' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
