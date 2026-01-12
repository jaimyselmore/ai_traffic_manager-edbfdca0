// Secure data access edge function - all database operations go through here with server-side auth
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { verify } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SessionPayload {
  sub: string;
  email: string;
  naam: string;
  isPlanner: boolean;
  rol: string;
  iat: number;
  exp: number;
}

interface Filter {
  column: string;
  operator: string;
  value: unknown;
}

async function getJwtKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const jwtSecret = Deno.env.get('JWT_SECRET') ?? serviceRoleKey;

  if (!jwtSecret) return null;

  try {
    const key = await getJwtKey(jwtSecret);
    const payload = await verify(token, key) as unknown as SessionPayload;
    
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

// Allowed operations and tables for planners
const ALLOWED_TABLES = [
  'klanten', 'werknemers', 'users', 'rolprofielen', 'disciplines',
  'projecten', 'project_fases', 'taken', 'meetings', 'verlof_aanvragen',
  'wijzigingsverzoeken', 'notificaties', 'audit_log', 'planning_regels'
];

const ALLOWED_OPERATIONS = ['select', 'insert', 'update', 'delete'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify session token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'NO_SESSION' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const session = await verifySessionToken(token);

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session', code: 'INVALID_SESSION' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only planners can access data
    if (!session.isPlanner) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Planner access required', code: 'NOT_PLANNER' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { operation, table, data, filters, columns, order, limit } = await req.json();

    // Validate operation
    if (!ALLOWED_OPERATIONS.includes(operation)) {
      return new Response(
        JSON.stringify({ error: `Invalid operation: ${operation}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate table
    if (!ALLOWED_TABLES.includes(table)) {
      return new Response(
        JSON.stringify({ error: `Invalid table: ${table}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // deno-lint-ignore no-explicit-any
    let result: { data: any; error: any } | undefined;

    switch (operation) {
      case 'select': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase.from(table).select(columns || '*');
        
        // Apply filters
        if (filters) {
          for (const filter of filters as Filter[]) {
            const { column, operator, value } = filter;
            switch (operator) {
              case 'eq': query = query.eq(column, value); break;
              case 'neq': query = query.neq(column, value); break;
              case 'gt': query = query.gt(column, value); break;
              case 'gte': query = query.gte(column, value); break;
              case 'lt': query = query.lt(column, value); break;
              case 'lte': query = query.lte(column, value); break;
              case 'like': query = query.like(column, value); break;
              case 'ilike': query = query.ilike(column, value); break;
              case 'in': query = query.in(column, value); break;
              case 'is': query = query.is(column, value); break;
            }
          }
        }

        // Apply ordering
        if (order) {
          query = query.order(order.column, { ascending: order.ascending ?? true });
        }

        // Apply limit
        if (limit) {
          query = query.limit(limit);
        }

        result = await query;
        break;
      }

      case 'insert': {
        // Add created_by if the table has it
        const insertData = { ...data };
        if (['taken', 'meetings', 'verlof_aanvragen', 'wijzigingsverzoeken', 'projecten', 'klanten'].includes(table)) {
          insertData.created_by = session.sub;
        }
        
        result = await supabase.from(table).insert(insertData).select();
        
        // Log the action
        await supabase.from('audit_log').insert({
          user_id: session.sub,
          entiteit_type: table,
          entiteit_id: result?.data?.[0]?.id || 'unknown',
          actie: 'create',
          nieuwe_waarde: insertData,
        });
        break;
      }

      case 'update': {
        if (!filters || filters.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Update requires filters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get old value for audit log
        // deno-lint-ignore no-explicit-any
        let selectQuery: any = supabase.from(table).select('*');
        for (const filter of filters as Filter[]) {
          if (filter.operator === 'eq') {
            selectQuery = selectQuery.eq(filter.column, filter.value);
          }
        }
        const { data: oldData } = await selectQuery.single();

        // Check hard lock
        if (oldData?.is_hard_lock && oldData?.created_by !== session.sub) {
          return new Response(
            JSON.stringify({ error: `Alleen ${oldData.created_by_naam || 'de eigenaar'} kan dit aanpassen` }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // deno-lint-ignore no-explicit-any
        let updateQuery: any = supabase.from(table).update(data);
        for (const filter of filters as Filter[]) {
          if (filter.operator === 'eq') {
            updateQuery = updateQuery.eq(filter.column, filter.value);
          }
        }
        result = await updateQuery.select();

        // Log the action
        await supabase.from('audit_log').insert({
          user_id: session.sub,
          entiteit_type: table,
          entiteit_id: (filters as Filter[]).find((f: Filter) => f.column === 'id')?.value || 'unknown',
          actie: 'update',
          oude_waarde: oldData,
          nieuwe_waarde: data,
        });
        break;
      }

      case 'delete': {
        if (!filters || filters.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Delete requires filters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get old value for audit log and hard lock check
        // deno-lint-ignore no-explicit-any
        let selectQuery: any = supabase.from(table).select('*');
        for (const filter of filters as Filter[]) {
          if (filter.operator === 'eq') {
            selectQuery = selectQuery.eq(filter.column, filter.value);
          }
        }
        const { data: oldData } = await selectQuery.single();

        // Check hard lock
        if (oldData?.is_hard_lock && oldData?.created_by !== session.sub) {
          return new Response(
            JSON.stringify({ error: `Alleen ${oldData.created_by_naam || 'de eigenaar'} kan dit verwijderen` }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // deno-lint-ignore no-explicit-any
        let deleteQuery: any = supabase.from(table).delete();
        for (const filter of filters as Filter[]) {
          if (filter.operator === 'eq') {
            deleteQuery = deleteQuery.eq(filter.column, filter.value);
          }
        }
        result = await deleteQuery.select();

        // Log the action
        await supabase.from('audit_log').insert({
          user_id: session.sub,
          entiteit_type: table,
          entiteit_id: (filters as Filter[]).find((f: Filter) => f.column === 'id')?.value || 'unknown',
          actie: 'delete',
          oude_waarde: oldData,
        });
        break;
      }
    }

    if (result?.error) {
      console.error('Database error:', result.error);
      return new Response(
        JSON.stringify({ error: result.error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ data: result?.data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Data access error:', error);
    return new Response(
      JSON.stringify({ error: 'Er is een fout opgetreden' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
