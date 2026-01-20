// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { AES, enc } from "https://esm.sh/crypto-js@4.2.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Encryption utilities
function encryptToken(plainText: string, key: string): string {
  const encrypted = AES.encrypt(plainText, key)
  return encrypted.toString()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const oauthError = url.searchParams.get('error')
    const frontendUrl = Deno.env.get('FRONTEND_URL')!

    // Check if user denied consent
    if (oauthError) {
      console.error('OAuth error:', oauthError)
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `${frontendUrl}/agendas?error=access_denied`
        }
      })
    }

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing code or state parameter' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const werknemerId = state

    // Exchange authorization code for tokens
    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')!
    const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')!
    const tenantId = Deno.env.get('MICROSOFT_TENANT_ID')!
    const redirectUri = Deno.env.get('MICROSOFT_REDIRECT_URI')!

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

    const tokenParams = new URLSearchParams({
      client_id: clientId,
      scope: 'User.Read Calendars.ReadWrite offline_access',
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      client_secret: clientSecret,
    })

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      throw new Error('Failed to acquire tokens from Microsoft')
    }

    const tokens = await tokenResponse.json()

    if (!tokens.access_token) {
      throw new Error('No access token in response')
    }

    // Get user info to store email
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    })

    const userInfo = await userInfoResponse.json()
    const microsoftEmail = userInfo.mail || userInfo.userPrincipalName

    // Encrypt tokens
    const encryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY')!
    const encryptedAccessToken = encryptToken(tokens.access_token, encryptionKey)
    const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token, encryptionKey) : null

    // Calculate expiration
    const expiresIn = tokens.expires_in || 3600
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // Store tokens in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error: tokenError } = await supabase
      .from('microsoft_tokens')
      .upsert({
        werknemer_id: parseInt(werknemerId),
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })

    if (tokenError) {
      console.error('Failed to store tokens:', tokenError)
      throw new Error(`Failed to store tokens: ${tokenError.message}`)
    }

    // Update employee status
    const { error: medewerkError } = await supabase
      .from('medewerkers')
      .update({
        microsoft_connected: true,
        microsoft_connected_at: new Date().toISOString(),
        microsoft_email: microsoftEmail,
      })
      .eq('werknemer_id', parseInt(werknemerId))

    if (medewerkError) {
      console.error('Failed to update employee:', medewerkError)
      throw new Error(`Failed to update employee: ${medewerkError.message}`)
    }

    console.log(`✅ Microsoft account connected for employee ${werknemerId}`)

    // Redirect back to frontend with success
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${frontendUrl}/agendas?microsoft_connected=true`
      }
    })
  } catch (error: any) {
    console.error('Error handling Microsoft callback:', error)
    const frontendUrl = Deno.env.get('FRONTEND_URL')!
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${frontendUrl}/agendas?error=connection_failed`
      }
    })
  }
})
