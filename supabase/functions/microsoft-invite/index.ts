// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate a secure random token
function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { werknemerId, email, appUrl } = await req.json()

    if (!werknemerId || !email) {
      return new Response(
        JSON.stringify({ error: 'werknemerId and email are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate email format
    if (!email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Generate unique token
    const token = generateToken()

    // Invitation expires in 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // Delete any existing unused invitations for this employee
    await supabase
      .from('microsoft_invitations')
      .delete()
      .eq('werknemer_id', werknemerId)
      .is('used_at', null)

    // Store the invitation
    const { error: insertError } = await supabase
      .from('microsoft_invitations')
      .insert({
        werknemer_id: werknemerId,
        token: token,
        email: email,
        expires_at: expiresAt,
      })

    if (insertError) {
      console.error('Failed to create invitation:', insertError)
      throw new Error(`Failed to create invitation: ${insertError.message}`)
    }

    // Get employee name for the response
    const { data: employee } = await supabase
      .from('medewerkers')
      .select('naam_werknemer')
      .eq('werknemer_id', werknemerId)
      .single()

    // Construct the invitation URL
    // Use provided appUrl or fallback to a default
    const baseUrl = appUrl || Deno.env.get('APP_URL') || 'https://ellen-planning.lovable.app'
    const invitationUrl = `${baseUrl}/microsoft-koppelen/${token}`

    console.log(`✅ Created Microsoft invitation for ${email} (employee ${werknemerId})`)

    return new Response(
      JSON.stringify({
        success: true,
        invitationUrl: invitationUrl,
        email: email,
        employeeName: employee?.naam_werknemer || 'Onbekend',
        expiresAt: expiresAt,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('Error creating invitation:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create invitation', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
