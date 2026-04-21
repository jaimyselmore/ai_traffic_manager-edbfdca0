// ===== ELLEN AI — HOOFDORCHESTRATOR =====
// Dit bestand is bewust kort: het regelt alleen de request-flow.
// Alle logica zit in aparte modules:
//   _types.ts      → gedeelde interfaces
//   _data.ts       → Supabase data loaders
//   _prompts.ts    → prompt builders per modus (CHAT/PLAN/QUERY)
//   _tools.ts      → tool definities + gating per modus
//   _planning.ts   → planning engine (slot-finder, datum-helpers)
//   _execution.ts  → tool uitvoering + wijziging-flow
//   _router.ts     → Haiku intent detectie

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { verify } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

import { SessionPayload, Intent } from './_types.ts';
import { loadPlanningConfig, loadEllenRegels, loadRecentFeedback } from './_data.ts';
import { buildChatPrompt, buildPlanPrompt, buildQueryPrompt } from './_prompts.ts';
import { getToolsForIntent } from './_tools.ts';
import { executeTool, executeWijziging } from './_execution.ts';
import { detectIntent } from './_router.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAIN_MODEL = 'anthropic/claude-sonnet-4-5';

// ── JWT VERIFICATIE ───────────────────────────────────────────────────────────

async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const jwtSecret = Deno.env.get('JWT_SECRET') ?? serviceRoleKey;
  if (!jwtSecret) return null;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(jwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    const payload = await verify(token, key) as unknown as SessionPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── OPENROUTER API CALL ───────────────────────────────────────────────────────

async function callOpenRouter(
  apiKey: string,
  // deno-lint-ignore no-explicit-any
  messages: any[],
  // deno-lint-ignore no-explicit-any
  tools: any[],
  maxTokens: number
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  // deno-lint-ignore no-explicit-any
  const body: any = { model: MAIN_MODEL, max_tokens: maxTokens, messages };
  if (tools?.length) body.tools = tools;

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://selmore.nl',
      'X-Title': 'Ellen AI Traffic Manager',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(errText) as Error & { status: number };
    err.status = response.status;
    throw err;
  }
  return response.json();
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Niet geautoriseerd' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const session = await verifySessionToken(authHeader.replace('Bearer ', ''));
    if (!session) {
      return new Response(JSON.stringify({ error: 'Ongeldige of verlopen sessie' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Parse request
    const body = await req.json();
    const { sessie_id, bericht, actie, tabel, id, veld, nieuwe_waarde, project_data } = body;
    if (!sessie_id) {
      return new Response(JSON.stringify({ error: 'sessie_id is verplicht' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 3. Acties zonder AI
    if (actie === 'laden') {
      const { data: berichten } = await supabase.from('chat_gesprekken')
        .select('rol, inhoud, created_at').eq('sessie_id', sessie_id)
        .order('created_at', { ascending: true }).limit(50);
      return new Response(JSON.stringify({ berichten: berichten || [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (actie === 'feedback_opslaan') {
      const { feedback, context } = body;
      if (feedback) {
        try {
          await supabase.from('ellen_feedback').insert({ gebruiker_naam: session.naam, feedback_tekst: feedback, context_data: context ? JSON.stringify(context) : null });
        } catch { /* ignore */ }
      }
      return new Response(JSON.stringify({ success: true, message: 'Feedback opgeslagen' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (actie === 'uitvoeren') {
      if (!tabel || !id || !veld || nieuwe_waarde === undefined) {
        return new Response(JSON.stringify({ error: 'Ontbrekende velden' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const result = await executeWijziging(supabase, tabel, id, veld, nieuwe_waarde);
      return new Response(JSON.stringify(result), { status: result.success ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (actie === 'plannen') {
      const { planning, werktype: gekozenWerktype, plan_status: gekozenPlanStatus = 'concept' } = body;
      if (!planning?.taken?.length) {
        return new Response(JSON.stringify({ success: false, message: 'Geen planning data' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: klant } = await supabase.from('klanten').select('id').ilike('naam', `%${planning.klant_naam}%`).limit(1).maybeSingle();
      if (!klant) return new Response(JSON.stringify({ success: false, message: `Klant "${planning.klant_naam}" niet gevonden` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const projectNummer = planning.project_nummer || `P-${Date.now().toString().slice(-6)}`;
      const werktype = gekozenWerktype || 'concept';

      // Check of concept-taken al bestaan (direct opgeslagen door plan_project engine)
      const { data: bestaandeConcept } = await supabase.from('taken')
        .select('id').eq('project_nummer', projectNummer).eq('plan_status', 'concept').limit(1);

      const { data: project, error: projectErr } = await supabase.from('projecten').insert({
        klant_id: klant.id, projectnummer: projectNummer,
        omschrijving: planning.project_omschrijving || planning.klant_naam,
        projecttype: planning.projecttype || 'algemeen', deadline: planning.deadline,
        status: 'concept', datum_aanvraag: new Date().toISOString().split('T')[0], volgnummer: Date.now() % 10000,
      }).select('id, projectnummer').single();
      if (projectErr || !project) return new Response(JSON.stringify({ success: false, message: 'Kon project niet aanmaken' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      let aantalGeplaatst = 0;

      if (bestaandeConcept?.length) {
        // Concept-taken bestaan al — koppel project_id en update status/werktype
        const { error: updateErr } = await supabase.from('taken')
          .update({ project_id: project.id, plan_status: gekozenPlanStatus, werktype })
          .eq('project_nummer', projectNummer)
          .eq('plan_status', 'concept');
        if (updateErr) console.error('Update concept-taken fout:', updateErr.message);
        aantalGeplaatst = planning.taken.length;
      } else {
        // Fallback: geen concept-taken (bijv. template-route) — insert nieuw
        const werktypeLabels: Record<string, string> = { concept: 'Conceptontwikkeling', uitwerking: 'Conceptuitwerking', productie: 'Productie', extern: 'Meeting met klant', review: 'Interne review' };
        const faseLabel = werktypeLabels[werktype] || werktype;
        for (const taak of planning.taken) {
          const { error: taakErr } = await supabase.from('taken').insert({
            project_id: project.id, werknemer_naam: taak.werknemer_naam, klant_naam: planning.klant_naam,
            project_nummer: project.projectnummer, fase_naam: faseLabel, werktype,
            discipline: taak.discipline || 'Algemeen',
            week_start: taak.week_start,
            dag_van_week: typeof taak.dag_van_week === 'number' ? taak.dag_van_week : 0,
            start_uur: typeof taak.start_uur === 'number' ? taak.start_uur : 9,
            duur_uren: typeof taak.duur_uren === 'number' ? taak.duur_uren : 8,
            plan_status: gekozenPlanStatus, is_hard_lock: false,
          });
          if (taakErr) console.error('Taak insert error:', taakErr.message);
          else aantalGeplaatst++;
        }
      }

      return new Response(JSON.stringify({ success: true, message: `Planning "${project.projectnummer}" bevestigd met ${aantalGeplaatst} blokken`, project_id: project.id, project_nummer: project.projectnummer, aantal_blokken: aantalGeplaatst }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (actie === 'afwijzen_planning') {
      const { project_nummer } = body;
      if (!project_nummer) {
        return new Response(JSON.stringify({ success: false, message: 'project_nummer is verplicht' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { error: delErr } = await supabase.from('taken')
        .delete().eq('project_nummer', project_nummer).eq('plan_status', 'concept');
      if (delErr) return new Response(JSON.stringify({ success: false, message: `Verwijderen mislukt: ${delErr.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: true, message: 'Concept-planning verwijderd' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Direct plan modus (vanuit template formulier — bypass AI)
    if (project_data?.direct_plan_fases?.length) {
      const planningConfig = await loadPlanningConfig(supabase);
      // _deadline per fase omzetten naar fase_deadline zodat execution per fase de juiste deadline gebruikt.
      // Gebruik de LAATSTE deadline als globale horizon voor resource-loading (niet de vroegste).
      const fases = project_data.direct_plan_fases.map((f: Record<string, unknown>) => {
        const { _deadline, ...rest } = f;
        return _deadline ? { ...rest, fase_deadline: _deadline } : rest;
      });
      const deadlines = project_data.direct_plan_fases.map((f: Record<string, unknown>) => f._deadline).filter(Boolean) as string[];
      const deadline = deadlines.sort().reverse()[0] || project_data.eind_datum;

      const result = await executeTool(supabase, planningConfig, 'plan_project', {
        klant_naam: project_data.klant_naam || 'Onbekend', project_naam: project_data.project_naam || 'Project',
        fases, deadline, reasoning: 'Direct plan vanuit template formulier',
      });

      let voorstel: Record<string, unknown> | null = null;
      try { voorstel = JSON.parse(result); } catch { /* ignore */ }

      return new Response(JSON.stringify({ antwoord: 'Planning aangemaakt op basis van het template.', voorstel: voorstel?.type === 'planning_voorstel' ? voorstel : null, sessie_id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 5. Chat modus
    if (!bericht) return new Response(JSON.stringify({ error: 'bericht is verplicht' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openrouterKey) return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY niet geconfigureerd.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 6. Laad data + detecteer intent parallel
    const [planningConfig, ellenRegels, recentFeedback, plannerInfo, intent] = await Promise.all([
      loadPlanningConfig(supabase),
      loadEllenRegels(supabase),
      loadRecentFeedback(supabase),
      supabase.from('medewerkers').select('naam_werknemer, primaire_rol, tweede_rol, discipline, werkuren, parttime_dag').ilike('naam_werknemer', `%${session.naam}%`).limit(1).maybeSingle(),
      project_data ? Promise.resolve<Intent>('PLAN') : detectIntent(bericht, openrouterKey),
    ]);
    console.log(`Intent: ${intent}`);

    let plannerInfoStr = '';
    const mw = plannerInfo.data;
    if (mw) {
      const parts = [`Rol: ${mw.primaire_rol}`];
      if (mw.tweede_rol) parts.push(`Tweede rol: ${mw.tweede_rol}`);
      if (mw.discipline) parts.push(`Discipline: ${mw.discipline}`);
      if (mw.werkuren) parts.push(`Werkuren: ${mw.werkuren}u/week`);
      if (mw.parttime_dag) parts.push(`Parttime: ${mw.parttime_dag}`);
      plannerInfoStr = parts.join('. ');
    }

    // 7. Kies prompt en tools op basis van intent
    const systemContent = intent === 'PLAN'
      ? buildPlanPrompt(planningConfig, ellenRegels, recentFeedback, session.naam, plannerInfoStr)
      : intent === 'QUERY'
        ? buildQueryPrompt(session.naam)
        : buildChatPrompt(planningConfig, ellenRegels, session.naam);

    const tools = getToolsForIntent(intent);

    // 8. Laad chat history
    let historyMessages: Array<{ rol: string; inhoud: string }> = [];
    try {
      const { data: history } = await supabase.from('chat_gesprekken').select('rol, inhoud').eq('sessie_id', sessie_id).order('created_at', { ascending: true }).limit(30);
      if (history) historyMessages = history;
    } catch { /* ignore */ }

    // 9. Sla user bericht op
    try { await supabase.from('chat_gesprekken').insert({ sessie_id, rol: 'user', inhoud: bericht }); } catch { /* ignore */ }

    // 10. Bouw berichten (systeem prompt als eerste message)
    // deno-lint-ignore no-explicit-any
    const currentMessages: any[] = [{ role: 'system', content: systemContent }];
    for (const msg of historyMessages) {
      const clean = msg.inhoud.replace(/\n*\[VOORSTEL:\{.*?\}\]/gs, '').trim();
      if (clean) currentMessages.push({ role: msg.rol === 'user' ? 'user' : 'assistant', content: clean });
    }

    // 11. Pre-fetch voor project planning
    let prefetchedContext = '';
    if (project_data) {
      const { medewerkers: mwNames, klant_naam, start_datum, eind_datum } = project_data;
      const parts: string[] = [];

      if (klant_naam) {
        const { data: klantData } = await supabase.from('klanten').select('id, klantnummer, naam, contactpersoon, planning_instructies').ilike('naam', `%${klant_naam}%`).limit(1).maybeSingle();
        if (klantData) parts.push(`\n--- PRE-LOADED: KLANT ---\n${JSON.stringify(klantData, null, 2)}`);
      }

      if (mwNames?.length) {
        const { data: mwData } = await supabase.from('medewerkers').select('werknemer_id, naam_werknemer, primaire_rol, tweede_rol, discipline, werkuren, parttime_dag, duo_team, beschikbaar, notities').in('naam_werknemer', mwNames);
        if (mwData?.length) parts.push(`\n--- PRE-LOADED: MEDEWERKERS ---\n${JSON.stringify(mwData, null, 2)}`);

        if (start_datum && eind_datum) {
          const beschikbaarheid: Record<string, unknown> = {};
          await Promise.all(mwNames.map(async (naam: string) => {
            const [takenRes, verlofRes] = await Promise.all([
              supabase.from('taken').select('week_start, dag_van_week, start_uur, duur_uren, klant_naam, project_nummer').eq('werknemer_naam', naam).gte('week_start', start_datum).lte('week_start', eind_datum).limit(40),
              supabase.from('beschikbaarheid_medewerkers').select('start_datum, eind_datum, type, reden').eq('werknemer_naam', naam).eq('status', 'goedgekeurd').or(`start_datum.lte.${eind_datum},eind_datum.gte.${start_datum}`),
            ]);
            beschikbaarheid[naam] = { ingeplande_uren: (takenRes.data || []).reduce((s: number, b: { duur_uren: number }) => s + b.duur_uren, 0), bestaande_taken: takenRes.data || [], verlof_periodes: verlofRes.data || [] };
          }));
          parts.push(`\n--- PRE-LOADED: BESCHIKBAARHEID (${start_datum} t/m ${eind_datum}) ---\n${JSON.stringify(beschikbaarheid, null, 2)}`);
        }

        if (mwNames?.length) {
          const { data: mwIds } = await supabase.from('medewerkers').select('werknemer_id, naam_werknemer').in('naam_werknemer', mwNames);
          const ids = (mwIds || []).map((m: { werknemer_id: number }) => m.werknemer_id);
          if (ids.length) {
            const { data: tokenData } = await supabase.from('microsoft_tokens').select('werknemer_id').in('werknemer_id', ids);
            const gekoppeld = new Set((tokenData || []).map((t: { werknemer_id: number }) => t.werknemer_id));
            const niet = (mwIds || []).filter((m: { werknemer_id: number }) => !gekoppeld.has(m.werknemer_id)).map((m: { naam_werknemer: string }) => m.naam_werknemer);
            if (niet.length) parts.push(`\n--- MICROSOFT AGENDA ---\nNIET gekoppeld: ${niet.join(', ')}. Vermeld dit in je voorstel.`);
          }
        }
      }

      if (parts.length) prefetchedContext = '\n\n=== PRE-LOADED DATA — ga direct naar plan_project ===\n' + parts.join('\n');
    }

    currentMessages.push({ role: 'user', content: bericht + prefetchedContext });

    // 12. Tool loop (max 3 iteraties)
    let assistantMessage = '';
    // deno-lint-ignore no-explicit-any
    let pendingVoorstel: any = null;
    const maxIterations = project_data ? 2 : 3;

    for (let i = 0; i < maxIterations; i++) {
      const data = await callOpenRouter(openrouterKey, currentMessages, tools, project_data ? 3000 : 4096);
      const choice = data.choices?.[0];
      const message = choice?.message;
      const finishReason = choice?.finish_reason;

      if (finishReason === 'stop' || finishReason === 'end_turn') {
        assistantMessage = message?.content || '';
        break;
      }

      if (finishReason === 'tool_calls' || finishReason === 'tool_use') {
        const toolCalls = message?.tool_calls || [];
        currentMessages.push({ role: 'assistant', content: message?.content || null, tool_calls: toolCalls });

        for (const toolCall of toolCalls) {
          let toolArgs: Record<string, unknown> = {};
          try { toolArgs = JSON.parse(toolCall.function?.arguments || '{}'); } catch { /* ignore */ }

          const result = await executeTool(supabase, planningConfig, toolCall.function?.name, toolArgs);

          if (['stel_wijziging_voor', 'plan_project'].includes(toolCall.function?.name)) {
            try {
              const parsed = JSON.parse(result);
              if (parsed.type === 'voorstel' || parsed.type === 'planning_voorstel') pendingVoorstel = parsed;
            } catch { /* ignore */ }
          }

          currentMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
        }

        if (pendingVoorstel && project_data) {
          if (!assistantMessage) assistantMessage = 'Planning voorstel klaar. Bekijk het hieronder.';
          break;
        }
      } else {
        assistantMessage = message?.content || '';
        break;
      }
    }

    // 13. Sla op en return
    const opslaan = pendingVoorstel ? `${assistantMessage}\n\n[VOORSTEL:${JSON.stringify(pendingVoorstel)}]` : assistantMessage;
    try { await supabase.from('chat_gesprekken').insert({ sessie_id, rol: 'assistant', inhoud: opslaan }); } catch { /* ignore */ }

    return new Response(
      JSON.stringify({ antwoord: assistantMessage.replace(/\n*\[VOORSTEL:\{.*?\}\]/gs, '').trim(), voorstel: pendingVoorstel, intent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Ellen error:', error);
    if ((error as { status?: number }).status === 429) {
      return new Response(JSON.stringify({ error: 'AI tijdelijk overbelast. Probeer over 30 seconden opnieuw.', code: 'RATE_LIMITED' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'Er is een fout opgetreden bij Ellen' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
