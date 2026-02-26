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

// ===========================================
// ERROR HANDLING - Map DB errors to safe messages
// ===========================================

const ERROR_CODES = {
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  DUPLICATE_KEY: 'DUPLICATE_KEY',
  INVALID_REFERENCE: 'INVALID_REFERENCE',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

const ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.DUPLICATE_EMAIL]: 'Dit e-mailadres is al in gebruik',
  [ERROR_CODES.DUPLICATE_KEY]: 'Deze waarde bestaat al',
  [ERROR_CODES.INVALID_REFERENCE]: 'Ongeldige referentie naar gerelateerde data',
  [ERROR_CODES.NOT_FOUND]: 'Item niet gevonden',
  [ERROR_CODES.VALIDATION_ERROR]: 'Ongeldige invoer',
  [ERROR_CODES.DATABASE_ERROR]: 'Er is een fout opgetreden bij het verwerken van uw verzoek',
};

function mapDatabaseError(dbError: { message?: string; code?: string }): { code: string; message: string } {
  const errorMessage = (dbError.message || '').toLowerCase();
  const errorCode = dbError.code || '';

  // Check for specific Postgres error patterns
  if (errorMessage.includes('duplicate') && errorMessage.includes('email')) {
    return { code: ERROR_CODES.DUPLICATE_EMAIL, message: ERROR_MESSAGES[ERROR_CODES.DUPLICATE_EMAIL] };
  }
  if (errorMessage.includes('duplicate') || errorMessage.includes('unique') || errorCode === '23505') {
    return { code: ERROR_CODES.DUPLICATE_KEY, message: ERROR_MESSAGES[ERROR_CODES.DUPLICATE_KEY] };
  }
  if (errorMessage.includes('foreign key') || errorMessage.includes('violates') || errorCode === '23503') {
    return { code: ERROR_CODES.INVALID_REFERENCE, message: ERROR_MESSAGES[ERROR_CODES.INVALID_REFERENCE] };
  }
  if (errorMessage.includes('not found') || errorMessage.includes('no rows')) {
    return { code: ERROR_CODES.NOT_FOUND, message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND] };
  }

  // Log the actual error server-side for debugging
  console.error('Database error details:', dbError);

  // Return generic error to client
  return { code: ERROR_CODES.DATABASE_ERROR, message: ERROR_MESSAGES[ERROR_CODES.DATABASE_ERROR] };
}

// ===========================================
// INPUT VALIDATION
// ===========================================

const ALLOWED_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is'];

// Define allowed columns per table for validation
const TABLE_COLUMNS: Record<string, string[]> = {
  klanten: ['id', 'klantnummer', 'naam', 'contactpersoon', 'email', 'telefoon', 'reistijd_minuten', 'interne_notities', 'planning_instructies', 'created_by', 'created_at', 'updated_at'],
  medewerkers: ['werknemer_id', 'naam_werknemer', 'gebruikersnaam', 'primaire_rol', 'tweede_rol', 'derde_rol', 'discipline', 'discipline_2', 'discipline_3', 'werkuren', 'parttime_dag', 'duo_team', 'vaardigheden', 'notities', 'beschikbaar', 'is_planner', 'in_planning', 'planner_volgorde', 'display_order', 'microsoft_connected', 'microsoft_connected_at', 'microsoft_email', 'rol', 'created_at', 'updated_at'],
  users: ['id', 'gebruikersnaam', 'naam', 'rol', 'is_planner', 'werknemer_id', 'password_hash', 'created_at', 'updated_at'],
  rolprofielen: ['rol_nummer', 'rol_naam', 'beschrijving_rol', 'taken_rol', 'standaard_discipline', 'created_at', 'updated_at'],
  disciplines: ['id', 'discipline_naam', 'beschrijving', 'created_at', 'updated_at'],
  projecttypes: ['id', 'code', 'naam', 'omschrijving', 'is_system', 'created_at', 'updated_at'],
  projecten: ['id', 'projectnummer', 'volgnummer', 'klant_id', 'omschrijving', 'projecttype', 'datum_aanvraag', 'deadline', 'status', 'adres_klant', 'info_klant', 'opmerkingen', 'account_team', 'creatie_team', 'productie_team', 'created_by', 'created_at', 'updated_at'],
  project_fases: ['id', 'project_id', 'fase_naam', 'fase_type', 'volgorde', 'start_datum', 'eind_datum', 'datum_tijd', 'locatie', 'medewerkers', 'inspanning_dagen', 'opmerkingen', 'is_hard_lock', 'created_at', 'updated_at'],
  taken: ['id', 'project_id', 'project_nummer', 'klant_naam', 'fase_id', 'fase_naam', 'werknemer_naam', 'werktype', 'discipline', 'week_start', 'dag_van_week', 'start_uur', 'duur_uren', 'plan_status', 'is_hard_lock', 'created_by', 'locked_by', 'created_at', 'updated_at'],
  'meetings & presentaties': ['id', 'project_id', 'datum', 'start_tijd', 'eind_tijd', 'onderwerp', 'type', 'locatie', 'deelnemers', 'is_hard_lock', 'status', 'created_by', 'created_at', 'updated_at'],
  beschikbaarheid_medewerkers: ['id', 'werknemer_naam', 'type', 'start_datum', 'eind_datum', 'reden', 'status', 'created_by', 'created_at', 'updated_at'],
  wijzigingsverzoeken: ['id', 'project_id', 'type_wijziging', 'beschrijving', 'impact', 'nieuwe_deadline', 'extra_uren', 'betrokken_mensen', 'status', 'created_by', 'created_at', 'updated_at'],
  notificaties: ['id', 'type', 'titel', 'beschrijving', 'klant_naam', 'project_nummer', 'voor_werknemer', 'deadline', 'severity', 'aantal', 'is_done', 'created_at', 'updated_at'],
  audit_log: ['id', 'user_id', 'entiteit_type', 'entiteit_id', 'actie', 'oude_waarde', 'nieuwe_waarde', 'ip_address', 'created_at'],
  planning_regels: ['regel_id', 'titel_kort', 'voorwaarde_kort', 'actie_kort', 'categorie', 'ernst', 'max_per_dag', 'parameters', 'created_at', 'updated_at'],
  ellen_regels: ['id', 'categorie', 'prioriteit', 'regel', 'rationale', 'actief', 'created_at'],
};

// Max limits per request
const MAX_LIMIT = 1000;
const MAX_TEXT_LENGTH = 5000;

function validateFilters(table: string, filters: Filter[]): string | null {
  const allowedColumns = TABLE_COLUMNS[table];
  if (!allowedColumns) return null;

  for (const filter of filters) {
    // Validate operator
    if (!ALLOWED_OPERATORS.includes(filter.operator)) {
      return `Ongeldige operator: ${filter.operator}`;
    }
    // Validate column exists in table
    if (!allowedColumns.includes(filter.column)) {
      return `Ongeldige kolom: ${filter.column}`;
    }
  }
  return null;
}

function validateData(table: string, data: Record<string, unknown>): string | null {
  const allowedColumns = TABLE_COLUMNS[table];
  if (!allowedColumns) return null;

  for (const [key, value] of Object.entries(data)) {
    // Skip system fields that are auto-set
    if (['id', 'created_at', 'updated_at', 'created_by'].includes(key)) continue;
    
    // Validate column exists
    if (!allowedColumns.includes(key)) {
      return `Ongeldige kolom: ${key}`;
    }
    
    // Validate text length
    if (typeof value === 'string' && value.length > MAX_TEXT_LENGTH) {
      return `Tekst te lang in kolom ${key} (max ${MAX_TEXT_LENGTH} tekens)`;
    }
  }
  return null;
}

function validateOrderColumn(table: string, column: string): boolean {
  const allowedColumns = TABLE_COLUMNS[table];
  if (!allowedColumns) return true; // Allow if table not in list
  return allowedColumns.includes(column);
}

// ===========================================
// JWT VERIFICATION
// ===========================================

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

// ===========================================
// ALLOWED TABLES AND OPERATIONS
// ===========================================

const ALLOWED_TABLES = [
  'klanten', 'medewerkers', 'users', 'rolprofielen', 'disciplines', 'projecttypes',
  'projecten', 'project_fases', 'taken', 'meetings & presentaties', 'beschikbaarheid_medewerkers',
  'wijzigingsverzoeken', 'notificaties', 'audit_log', 'planning_regels', 'ellen_regels'
];

const ALLOWED_OPERATIONS = ['select', 'insert', 'update', 'delete'];

// ===========================================
// MAIN HANDLER
// ===========================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify session token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Niet geautoriseerd', code: 'NO_SESSION' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const session = await verifySessionToken(token);

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Ongeldige of verlopen sessie', code: 'INVALID_SESSION' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only planners can access data
    if (!session.isPlanner) {
      return new Response(
        JSON.stringify({ error: 'Toegang geweigerd - Planner rechten vereist', code: 'NOT_PLANNER' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { operation, table, data, filters, columns, order, limit } = await req.json();

    // Validate operation
    if (!ALLOWED_OPERATIONS.includes(operation)) {
      return new Response(
        JSON.stringify({ error: 'Ongeldige operatie', code: 'VALIDATION_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate table
    if (!ALLOWED_TABLES.includes(table)) {
      return new Response(
        JSON.stringify({ error: 'Ongeldige tabel', code: 'VALIDATION_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate filters if provided
    if (filters && Array.isArray(filters) && filters.length > 0) {
      const filterError = validateFilters(table, filters as Filter[]);
      if (filterError) {
        return new Response(
          JSON.stringify({ error: filterError, code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate data if provided
    if (data && typeof data === 'object') {
      const dataError = validateData(table, data as Record<string, unknown>);
      if (dataError) {
        return new Response(
          JSON.stringify({ error: dataError, code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate order column if provided
    if (order?.column && !validateOrderColumn(table, order.column)) {
      return new Response(
        JSON.stringify({ error: 'Ongeldige sortering kolom', code: 'VALIDATION_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and cap limit
    const safeLimit = Math.min(Math.max(1, limit || 100), MAX_LIMIT);

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
        query = query.limit(safeLimit);

        result = await query;
        break;
      }

      case 'insert': {
        // Add created_by if the table has it
        const insertData = { ...data };
        if (['taken', 'meetings & presentaties', 'beschikbaarheid_medewerkers', 'wijzigingsverzoeken', 'projecten', 'klanten'].includes(table)) {
          insertData.created_by = session.sub;
        }

        result = await supabase.from(table).insert(insertData).select();

        // Log the action (silent failure - don't block main operation)
        try {
          await supabase.from('audit_log').insert({
            user_id: session.sub,
            entiteit_type: table,
            entiteit_id: result?.data?.[0]?.id || result?.data?.[0]?.werknemer_id || result?.data?.[0]?.rol_nummer || 'unknown',
            actie: 'create',
            nieuwe_waarde: insertData,
          });
        } catch (auditError) {
          console.error('Audit log error:', auditError);
        }
        break;
      }

      case 'update': {
        if (!filters || filters.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Update vereist filters', code: 'VALIDATION_ERROR' }),
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
            JSON.stringify({ error: `Alleen de eigenaar kan dit aanpassen (vergrendeld)`, code: 'HARD_LOCK' }),
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
        try {
          const entiteitId = (filters as Filter[]).find((f: Filter) => ['id', 'werknemer_id', 'rol_nummer'].includes(f.column))?.value || 'unknown';
          await supabase.from('audit_log').insert({
            user_id: session.sub,
            entiteit_type: table,
            entiteit_id: String(entiteitId),
            actie: 'update',
            oude_waarde: oldData,
            nieuwe_waarde: data,
          });
        } catch (auditError) {
          console.error('Audit log error:', auditError);
        }
        break;
      }

      case 'delete': {
        if (!filters || filters.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Delete vereist filters', code: 'VALIDATION_ERROR' }),
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
            JSON.stringify({ error: `Alleen de eigenaar kan dit verwijderen (vergrendeld)`, code: 'HARD_LOCK' }),
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
        try {
          const entiteitId = (filters as Filter[]).find((f: Filter) => ['id', 'werknemer_id', 'rol_nummer'].includes(f.column))?.value || 'unknown';
          await supabase.from('audit_log').insert({
            user_id: session.sub,
            entiteit_type: table,
            entiteit_id: String(entiteitId),
            actie: 'delete',
            oude_waarde: oldData,
          });
        } catch (auditError) {
          console.error('Audit log error:', auditError);
        }
        break;
      }
    }

    if (result?.error) {
      // Map database error to safe client message
      const mappedError = mapDatabaseError(result.error);
      return new Response(
        JSON.stringify({ error: mappedError.message, code: mappedError.code }),
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
      JSON.stringify({ error: 'Er is een fout opgetreden', code: 'SERVER_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
