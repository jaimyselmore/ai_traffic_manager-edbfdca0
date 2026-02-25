// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get identifier from URL path (can be werknemerId or invitation token)
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const identifier = pathParts[pathParts.length - 1]

    if (!identifier) {
      return new Response(
        JSON.stringify({ error: 'werknemerId or token is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    let werknemerId: string

    // Check if identifier is a token (64 chars hex) or werknemerId (numeric)
    const isToken = identifier.length === 64 && /^[a-f0-9]+$/.test(identifier)

    if (isToken) {
      // Validate invitation token
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      const { data: invitation, error: invError } = await supabase
        .from('microsoft_invitations')
        .select('werknemer_id, email, expires_at, used_at')
        .eq('token', identifier)
        .single()

      if (invError || !invitation) {
        return returnErrorPage('Ongeldige of verlopen uitnodiging')
      }

      // Check if already used
      if (invitation.used_at) {
        return returnErrorPage('Deze uitnodiging is al gebruikt')
      }

      // Check if expired
      if (new Date(invitation.expires_at) < new Date()) {
        return returnErrorPage('Deze uitnodiging is verlopen')
      }

      werknemerId = String(invitation.werknemer_id)

      // Mark invitation as used
      await supabase
        .from('microsoft_invitations')
        .update({ used_at: new Date().toISOString() })
        .eq('token', identifier)

      console.log(`✅ Invitation token validated for employee ${werknemerId}`)
    } else {
      // Direct werknemerId (admin flow)
      werknemerId = identifier
    }

    // Microsoft OAuth configuration
    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')!
    const tenantId = Deno.env.get('MICROSOFT_TENANT_ID')!
    const redirectUri = Deno.env.get('MICROSOFT_REDIRECT_URI')!

    // Build authorization URL
    const scopes = ['User.Read', 'Calendars.ReadWrite', 'offline_access']
    const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`)

    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('scope', scopes.join(' '))
    authUrl.searchParams.append('state', werknemerId)
    authUrl.searchParams.append('response_mode', 'query')

    // Redirect to Microsoft login
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': authUrl.toString()
      }
    })
  } catch (error: any) {
    console.error('Error generating Microsoft login URL:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate login URL', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function returnErrorPage(message: string) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Fout</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
          .card { background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px; }
          .error { color: #ef4444; font-size: 48px; margin-bottom: 16px; }
          h1 { color: #333; margin: 0 0 8px 0; font-size: 24px; }
          p { color: #666; margin: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="error">✕</div>
          <h1>${message}</h1>
          <p>Neem contact op met je beheerder voor een nieuwe uitnodiging.</p>
        </div>
      </body>
    </html>
  `
  return new Response(html, {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
  })
}
