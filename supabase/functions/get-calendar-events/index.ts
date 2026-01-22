// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { AES, enc } from "https://esm.sh/crypto-js@4.2.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Decrypt token utility
function decryptToken(cipherText: string, key: string): string {
  const bytes = AES.decrypt(cipherText, key)
  return bytes.toString(enc.Utf8)
}

// Encrypt token utility (for storing refreshed tokens)
function encryptToken(plainText: string, key: string): string {
  const encrypted = AES.encrypt(plainText, key)
  return encrypted.toString()
}

// Refresh access token using refresh token
async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  tenantId: string
): Promise<{ accessToken: string; expiresIn: number; newRefreshToken?: string }> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

  const tokenParams = new URLSearchParams({
    client_id: clientId,
    scope: 'User.Read Calendars.ReadWrite offline_access',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    client_secret: clientSecret,
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Token refresh failed:', errorText)
    throw new Error('Token refresh mislukt. Medewerker moet opnieuw inloggen bij Microsoft.')
  }

  const tokens = await response.json()
  return {
    accessToken: tokens.access_token,
    expiresIn: tokens.expires_in || 3600,
    newRefreshToken: tokens.refresh_token,
  }
}

// Fetch calendar events from Microsoft Graph API
async function fetchCalendarEvents(
  accessToken: string,
  startDateTime: string,
  endDateTime: string
): Promise<any[]> {
  const graphUrl = new URL('https://graph.microsoft.com/v1.0/me/calendar/events')
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
    console.error('Microsoft Graph API error:', errorText)
    throw new Error('Kon agenda niet ophalen uit Microsoft')
  }

  const data = await response.json()
  return data.value || []
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Parse request body
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

    console.log(`Fetching calendar events for werknemer ${werknemerId}, week starting ${weekStart}`)

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const encryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY')
    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')
    const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')
    const tenantId = Deno.env.get('MICROSOFT_TENANT_ID')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuratie ontbreekt')
    }
    if (!encryptionKey) {
      throw new Error('TOKEN_ENCRYPTION_KEY ontbreekt')
    }
    if (!clientId || !clientSecret || !tenantId) {
      throw new Error('Microsoft OAuth configuratie ontbreekt')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch tokens from database
    const { data: tokenData, error: tokenError } = await supabase
      .from('microsoft_tokens')
      .select('*')
      .eq('werknemer_id', werknemerId)
      .single()

    if (tokenError || !tokenData) {
      console.log(`No Microsoft tokens found for werknemer ${werknemerId}`)
      return new Response(
        JSON.stringify({ 
          error: 'Medewerker is niet gekoppeld aan Microsoft', 
          code: 'NOT_CONNECTED' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Decrypt tokens
    let accessToken: string
    try {
      accessToken = decryptToken(tokenData.access_token_encrypted, encryptionKey)
    } catch (e) {
      console.error('Failed to decrypt access token:', e)
      throw new Error('Kon tokens niet decrypteren')
    }

    // Check if token is expired
    const now = new Date()
    const expiresAt = new Date(tokenData.token_expires_at)
    
    if (now >= expiresAt) {
      console.log('Access token expired, refreshing...')
      
      // Decrypt refresh token
      let refreshToken: string
      try {
        refreshToken = decryptToken(tokenData.refresh_token_encrypted, encryptionKey)
      } catch (e) {
        console.error('Failed to decrypt refresh token:', e)
        throw new Error('Kon refresh token niet decrypteren. Medewerker moet opnieuw inloggen.')
      }

      // Refresh the token
      const refreshResult = await refreshAccessToken(refreshToken, clientId, clientSecret, tenantId)
      accessToken = refreshResult.accessToken

      // Calculate new expiration
      const newExpiresAt = new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString()

      // Update tokens in database
      const updateData: any = {
        access_token_encrypted: encryptToken(accessToken, encryptionKey),
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      }

      // If we got a new refresh token, update it too
      if (refreshResult.newRefreshToken) {
        updateData.refresh_token_encrypted = encryptToken(refreshResult.newRefreshToken, encryptionKey)
      }

      const { error: updateError } = await supabase
        .from('microsoft_tokens')
        .update(updateData)
        .eq('werknemer_id', werknemerId)

      if (updateError) {
        console.error('Failed to update tokens:', updateError)
        // Continue anyway, we have a valid access token
      } else {
        console.log('Tokens refreshed and stored successfully')
      }
    }

    // Calculate date range for the week (Monday 00:00 to Friday 23:59)
    const startDate = new Date(weekStart)
    startDate.setHours(0, 0, 0, 0)
    
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 4) // Friday
    endDate.setHours(23, 59, 59, 999)

    const startDateTime = startDate.toISOString()
    const endDateTime = endDate.toISOString()

    console.log(`Fetching events from ${startDateTime} to ${endDateTime}`)

    // Fetch calendar events
    const events = await fetchCalendarEvents(accessToken, startDateTime, endDateTime)

    console.log(`Found ${events.length} calendar events`)

    // Transform events to our format
    const transformedEvents = events.map((event: any) => ({
      id: event.id,
      title: event.subject || 'Geen onderwerp',
      date: event.start.dateTime.split('T')[0],
      startTime: event.start.dateTime.split('T')[1].substring(0, 5),
      endTime: event.end.dateTime.split('T')[1].substring(0, 5),
      location: event.location?.displayName || null,
      isAllDay: event.isAllDay || false,
      showAs: event.showAs || 'busy',
    }))

    return new Response(
      JSON.stringify({ 
        success: true, 
        events: transformedEvents,
        count: transformedEvents.length 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error fetching calendar events:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Er is een fout opgetreden', 
        code: 'ERROR' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
