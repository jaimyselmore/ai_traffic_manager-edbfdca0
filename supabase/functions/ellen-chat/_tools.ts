// ===== TOOL DEFINITIES + GATING =====
// Tool schemas in OpenAI-compatible format.
// Elke modus krijgt alleen de tools die hij echt nodig heeft.

import { Intent } from './_types.ts';

// deno-lint-ignore no-explicit-any
const ALL_TOOLS: any[] = [
  {
    type: 'function',
    function: {
      name: 'zoek_klanten',
      description: 'Zoek klanten op naam of klantnummer. Geeft klantgegevens terug inclusief planning_instructies.',
      parameters: {
        type: 'object',
        properties: {
          zoekterm: { type: 'string', description: 'Zoekterm voor naam of klantnummer' },
        },
        required: ['zoekterm'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'zoek_projecten',
      description: 'Zoek projecten op projectnummer, omschrijving of status.',
      parameters: {
        type: 'object',
        properties: {
          zoekterm: { type: 'string', description: 'Zoekterm voor projectnummer of omschrijving' },
          status: { type: 'string', enum: ['concept', 'vast', 'afgerond'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'zoek_medewerkers',
      description: 'Zoek medewerkers op naam, rol of discipline.',
      parameters: {
        type: 'object',
        properties: {
          zoekterm: { type: 'string', description: 'Naam van de medewerker' },
          discipline: { type: 'string', description: 'Filter op discipline' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'zoek_taken',
      description: 'Zoek ingeplande taken in de planning. Filter op medewerker, project of week.',
      parameters: {
        type: 'object',
        properties: {
          werknemer_naam: { type: 'string' },
          project_nummer: { type: 'string' },
          week_start: { type: 'string', description: 'Maandag van de week (YYYY-MM-DD)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'zoek_meetings',
      description: 'Zoek meetings en presentaties op datumbereik.',
      parameters: {
        type: 'object',
        properties: {
          datum_van: { type: 'string', description: 'Startdatum (YYYY-MM-DD)' },
          datum_tot: { type: 'string', description: 'Einddatum (YYYY-MM-DD)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'zoek_verlof',
      description: 'Zoek verlof en afwezigheden van medewerkers.',
      parameters: {
        type: 'object',
        properties: {
          werknemer_naam: { type: 'string' },
          datum_van: { type: 'string', description: 'Startdatum (YYYY-MM-DD)' },
          datum_tot: { type: 'string', description: 'Einddatum (YYYY-MM-DD)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_beschikbaarheid',
      description: 'Check beschikbaarheid van medewerkers voor een periode. Geeft ingeplande uren en verlofperiodes terug.',
      parameters: {
        type: 'object',
        properties: {
          medewerkers: { type: 'array', items: { type: 'string' }, description: 'Namen van de medewerkers' },
          start_datum: { type: 'string', description: 'Startdatum (YYYY-MM-DD)' },
          eind_datum: { type: 'string', description: 'Einddatum (YYYY-MM-DD)' },
        },
        required: ['medewerkers', 'start_datum', 'eind_datum'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'plan_project',
      description: 'Maak een planning voorstel. VERPLICHT bij elke planning request. Analyseer eerst de toelichtingen voor de juiste verdeling.',
      parameters: {
        type: 'object',
        properties: {
          klant_naam: { type: 'string' },
          project_naam: { type: 'string' },
          projecttype: { type: 'string', enum: ['commercial', 'corporate', 'social', 'branded', 'internal', 'algemeen'] },
          fases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                fase_naam: { type: 'string' },
                medewerkers: { type: 'array', items: { type: 'string' } },
                start_datum: { type: 'string', description: 'YYYY-MM-DD. Weglaten = automatisch ketenen van de vorige fase.' },
                duur_dagen: { type: 'number' },
                uren_per_dag: { type: 'number', description: 'Default 8' },
                verdeling: { type: 'string', enum: ['aaneengesloten', 'per_week', 'laatste_week'], description: 'aaneengesloten=blokken op rij, per_week=verspreid, laatste_week=vlak voor deadline' },
                dagen_per_week: { type: 'number', description: 'Bij per_week: aantal dagen per week' },
                datumType: { type: 'string', enum: ['zelf', 'ellen'], description: 'Voor presentaties: zelf=vaste datum in start_datum, ellen=engine kiest automatisch donderdag/vrijdag' },
                fixed_time: { type: 'string', description: 'Tijdstip van presentatie in HH:MM, bijv. "14:00". Informatief — de engine plant geen extra voorbereiding-blokken; alle workload eindigt altijd vóór de presentatiedag.' },
              },
              required: ['fase_naam', 'medewerkers', 'duur_dagen'],
            },
          },
          deadline: { type: 'string', description: 'YYYY-MM-DD' },
          reasoning: { type: 'string', description: 'Leg uit WAAROM je deze keuzes maakt' },
        },
        required: ['klant_naam', 'project_naam', 'fases', 'reasoning'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stel_wijziging_voor',
      description: 'Stel een wijziging voor aan bestaande data. De gebruiker moet dit bevestigen.',
      parameters: {
        type: 'object',
        properties: {
          tabel: { type: 'string', enum: ['klanten', 'projecten', 'medewerkers', 'taken', 'rolprofielen', 'disciplines', 'projecttypes', 'project_fases', 'beschikbaarheid_medewerkers'] },
          id: { type: 'string' },
          veld: { type: 'string' },
          nieuwe_waarde: { type: 'string' },
          beschrijving: { type: 'string', description: 'Uitleg voor de gebruiker' },
        },
        required: ['tabel', 'id', 'veld', 'nieuwe_waarde', 'beschrijving'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'wijzig_taak',
      description: 'Wijzig een bestaande taak DIRECT (geen voorstel). Gebruik vanuit chat.',
      parameters: {
        type: 'object',
        properties: {
          taak_id: { type: 'string' },
          nieuwe_waarden: {
            type: 'object',
            properties: {
              werknemer_naam: { type: 'string' },
              week_start: { type: 'string', description: 'YYYY-MM-DD (maandag)' },
              dag_van_week: { type: 'number', description: '0=ma 1=di 2=wo 3=do 4=vr' },
              start_uur: { type: 'number' },
              duur_uren: { type: 'number' },
              fase_naam: { type: 'string' },
              plan_status: { type: 'string', enum: ['concept', 'vast', 'wacht_klant'] },
            },
          },
          reden: { type: 'string' },
        },
        required: ['taak_id', 'nieuwe_waarden', 'reden'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verwijder_taak',
      description: 'Verwijder een taak DIRECT (geen voorstel). Gebruik vanuit chat.',
      parameters: {
        type: 'object',
        properties: {
          taak_id: { type: 'string' },
          reden: { type: 'string' },
        },
        required: ['taak_id', 'reden'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'voeg_taak_toe',
      description: 'Voeg een nieuwe taak toe DIRECT (geen voorstel). Gebruik vanuit chat.',
      parameters: {
        type: 'object',
        properties: {
          werknemer_naam: { type: 'string' },
          klant_naam: { type: 'string' },
          project_nummer: { type: 'string', description: 'Optioneel' },
          project_titel: { type: 'string' },
          fase_naam: { type: 'string' },
          werktype: { type: 'string', enum: ['concept', 'uitwerking', 'productie', 'extern', 'review'] },
          week_start: { type: 'string', description: 'YYYY-MM-DD (maandag)' },
          dag_van_week: { type: 'number', description: '0=ma 1=di 2=wo 3=do 4=vr' },
          start_uur: { type: 'number' },
          duur_uren: { type: 'number' },
          plan_status: { type: 'string', enum: ['concept', 'vast', 'wacht_klant'] },
          reden: { type: 'string' },
        },
        required: ['werknemer_naam', 'klant_naam', 'project_titel', 'fase_naam', 'week_start', 'dag_van_week', 'start_uur', 'duur_uren', 'reden'],
      },
    },
  },
];

// Tool-sets per modus — nooit meer dan 6 tools tegelijk
const TOOL_NAMES: Record<Intent, string[]> = {
  CHAT:  ['zoek_klanten', 'zoek_taken', 'wijzig_taak', 'verwijder_taak', 'voeg_taak_toe'],
  PLAN:  ['zoek_klanten', 'zoek_projecten', 'zoek_medewerkers', 'check_beschikbaarheid', 'plan_project', 'stel_wijziging_voor'],
  QUERY: ['zoek_klanten', 'zoek_projecten', 'zoek_medewerkers', 'zoek_taken', 'zoek_meetings', 'zoek_verlof'],
};

// deno-lint-ignore no-explicit-any
export function getToolsForIntent(intent: Intent): any[] {
  const names = TOOL_NAMES[intent];
  return ALL_TOOLS.filter(t => names.includes(t.function.name));
}
