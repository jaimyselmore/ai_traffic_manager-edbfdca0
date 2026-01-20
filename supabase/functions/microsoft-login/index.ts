// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get werknemerId from URL path
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const werknemerId = pathParts[pathParts.length - 1]

    if (!werknemerId) {
      return new Response(
        JSON.stringify({ error: 'werknemerId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
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
