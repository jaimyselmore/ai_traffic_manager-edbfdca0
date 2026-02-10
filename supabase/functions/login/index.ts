// DEPRECATED: Deze functie is verouderd en onveilig.
// Gebruik custom-login in plaats hiervan.
// Dit bestand is behouden voor backwards compatibility maar geeft altijd een error.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Altijd een error retourneren - deze functie is deprecated
  return new Response(
    JSON.stringify({
      error: 'Deze login endpoint is verouderd. Gebruik /functions/v1/custom-login.',
      code: 'DEPRECATED',
    }),
    {
      status: 410, // Gone - indicates resource no longer available
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
