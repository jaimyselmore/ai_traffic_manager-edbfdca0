# Ellen's Tools

Ellen gebruikt function calling (tools) om acties uit te voeren en data op te halen. Dit document beschrijft alle tools die Ellen tot haar beschikking heeft.

## Tool Categories

1. **Query Tools** - Data ophalen zonder wijzigingen
2. **Action Tools** - Database mutaties en planning wijzigingen
3. **Analysis Tools** - Complexe berekeningen en voorstellen

---

## 1. QUERY TOOLS

### `get_current_projects`
Haal alle actieve projecten op, optioneel gefilterd.

**Parameters:**
```typescript
{
  status?: 'concept' | 'vast' | 'afgerond',
  klant_id?: string,
  deadline_before?: string,  // ISO date
  limit?: number
}
```

**Returns:**
```typescript
{
  projects: Array<{
    id: string,
    projectTitel: string,
    projectnummer: string,
    klantNaam: string,
    omschrijving: string,
    deadline: string,
    status: string,
    fases: Array<{
      naam: string,
      medewerkers: string[],
      startDatum: string
    }>
  }>
}
```

**Use Case:** Ellen gebruikt dit om context te laden bij conversatie start.

---

### `get_employee_capacity`
Check beschikbare uren voor een medewerker in een bepaalde periode.

**Parameters:**
```typescript
{
  employee_id: string,
  start_date: string,  // ISO date
  end_date: string     // ISO date
}
```

**Returns:**
```typescript
{
  employee_name: string,
  total_available_hours: number,
  busy_hours: number,
  free_hours: number,
  busy_blocks: Array<{
    datum: string,
    start_uur: number,
    duur_uren: number,
    project_titel: string,
    fase_naam: string
  }>,
  verlof: Array<{
    start_datum: string,
    eind_datum: string,
    type: string
  }>
}
```

**Use Case:** Bepalen of een medewerker beschikbaar is voor nieuwe taken.

---

### `get_schedule_conflicts`
Vind overlappende taken voor meerdere medewerkers.

**Parameters:**
```typescript
{
  employee_ids: string[],
  start_date: string,
  end_date: string
}
```

**Returns:**
```typescript
{
  conflicts: Array<{
    datum: string,
    tijd_slot: string,
    medewerkers: string[],
    conflicting_tasks: Array<{
      project_titel: string,
      fase_naam: string,
      werknemer_naam: string
    }>
  }>
}
```

**Use Case:** Voor meeting scheduling - vind gemeenschappelijke vrije momenten.

---

### `check_employee_availability`
Check of specifieke medewerkers beschikbaar zijn op gegeven datum/tijd.

**Parameters:**
```typescript
{
  employee_ids: string[],
  datum: string,      // ISO date
  start_tijd: string, // "14:00"
  duur_uren: number
}
```

**Returns:**
```typescript
{
  available: boolean,
  availability_per_employee: Array<{
    employee_id: string,
    employee_name: string,
    is_available: boolean,
    reason?: string  // "Heeft meeting" | "Verlof" | "Andere taak"
  }>
}
```

**Use Case:** Valideren of meeting kan plaatsvinden op voorgestelde tijd.

---

### `get_project_details`
Haal complete project informatie op inclusief planning.

**Parameters:**
```typescript
{
  project_id: string
}
```

**Returns:**
```typescript
{
  id: string,
  projectTitel: string,
  projectnummer: string,
  klantNaam: string,
  klant_id: string,
  omschrijving: string,
  projecttype: string,
  deadline: string,
  status: string,
  created_at: string,

  fases: Array<{
    id: string,
    naam: string,
    type: string,
    medewerkers: string[],
    inspanning_dagen: number,
    start_datum: string | null
  }>,

  taken: Array<{
    id: string,
    werknemer_naam: string,
    fase_naam: string,
    week_start: string,
    dag_van_week: number,
    start_uur: number,
    duur_uren: number,
    plan_status: string
  }>,

  meetings: Array<{
    id: string,
    datum: string,
    onderwerp: string,
    type: string,
    deelnemers: string[]
  }>
}
```

**Use Case:** Volledige context bij wijzigingsverzoek.

---

### `get_team_load_distribution`
Overzicht van workload per medewerker.

**Parameters:**
```typescript
{
  start_date: string,
  end_date: string,
  include_verlof?: boolean
}
```

**Returns:**
```typescript
{
  period: { start: string, end: string },
  employees: Array<{
    id: string,
    name: string,
    discipline: string,
    total_hours_available: number,
    total_hours_planned: number,
    load_percentage: number,
    projects: Array<{
      project_titel: string,
      hours: number
    }>,
    verlof_days: number
  }>,
  overall_capacity: {
    total_available: number,
    total_used: number,
    utilization_percentage: number
  }
}
```

**Use Case:** Capaciteitsanalyse, bepalen wie overbelast is.

---

### `search_past_projects`
Zoek eerdere projecten op basis van filters.

**Parameters:**
```typescript
{
  query?: string,           // Zoek in titel/omschrijving
  klant_id?: string,
  projecttype?: string,
  completed_after?: string, // ISO date
  limit?: number
}
```

**Returns:**
```typescript
{
  projects: Array<{
    projectTitel: string,
    klantNaam: string,
    omschrijving: string,
    projecttype: string,
    deadline: string,
    actual_duration_days: number,
    team_size: number
  }>
}
```

**Use Case:** Leren van eerdere projecten voor betere schattingen.

---

## 2. ACTION TOOLS

### `create_project_proposal`
Genereer een planning voorstel voor een nieuw project.

**Parameters:**
```typescript
{
  projectTitel: string,
  klant_id: string,
  projecttype: string,
  deadline: string,
  fases: Array<{
    naam: string,
    inspanning_dagen: number,
    preferred_employees?: string[]
  }>
}
```

**Returns:**
```typescript
{
  proposal: {
    feasible: boolean,
    start_date: string,
    end_date: string,
    timeline: Array<{
      fase_naam: string,
      start_datum: string,
      eind_datum: string,
      toegewezen_medewerkers: Array<{
        employee_id: string,
        employee_name: string,
        hours: number
      }>
    }>,
    warnings: string[],
    conflicts: string[]
  }
}
```

**Use Case:** Planning voorstellen voordat project wordt aangemaakt.

---

### `schedule_meeting`
Plan een meeting in de agenda.

**Parameters:**
```typescript
{
  project_id: string,
  onderwerp: string,
  meeting_type: string,
  datum: string,
  start_tijd: string,
  eind_tijd: string,
  locatie?: string,
  deelnemers: string[],
  confirm: boolean  // Safety: moet true zijn om uit te voeren
}
```

**Returns:**
```typescript
{
  success: boolean,
  meeting_id?: string,
  blocks_created: number,
  errors?: string[]
}
```

**Use Case:** Meeting daadwerkelijk inplannen na bevestiging gebruiker.

---

### `apply_project_changes`
Pas wijzigingen toe aan bestaand project.

**Parameters:**
```typescript
{
  project_id: string,
  changes: {
    deadline?: string,
    fase_wijzigingen?: Array<{
      fase_id: string,
      nieuwe_start_datum?: string,
      nieuwe_inspanning?: number,
      nieuwe_medewerkers?: string[]
    }>,
    status?: string
  },
  reason: string,
  confirm: boolean
}
```

**Returns:**
```typescript
{
  success: boolean,
  affected_tasks: number,
  updated_fases: string[],
  new_deadline: string,
  warnings: string[]
}
```

**Use Case:** Wijzigingsverzoek uitvoeren.

---

### `apply_verlof`
Registreer verlof en pas planning aan.

**Parameters:**
```typescript
{
  employee_id: string,
  start_datum: string,
  eind_datum: string,
  verlof_type: string,
  reden?: string,
  redistribution_plan?: {
    backup_employee_id?: string,
    action: 'reschedule' | 'reassign' | 'cancel'
  },
  confirm: boolean
}
```

**Returns:**
```typescript
{
  success: boolean,
  verlof_id: string,
  affected_tasks: Array<{
    task_id: string,
    project_titel: string,
    action_taken: string  // "Rescheduled" | "Reassigned to X" | "Cancelled"
  }>,
  affected_meetings: Array<{
    meeting_id: string,
    onderwerp: string,
    action_taken: string
  }>
}
```

**Use Case:** Verlof registreren en conflicterende taken oplossen.

---

### `suggest_team_reallocation`
Stel herverdeling van taken voor bij overbelasting.

**Parameters:**
```typescript
{
  overloaded_employees?: string[],
  project_id?: string,
  date_range: { start: string, end: string }
}
```

**Returns:**
```typescript
{
  suggestions: Array<{
    from_employee: string,
    to_employee: string,
    tasks_to_move: Array<{
      task_id: string,
      project_titel: string,
      fase_naam: string,
      hours: number
    }>,
    rationale: string,
    impact: {
      from_employee_new_load: number,
      to_employee_new_load: number
    }
  }>
}
```

**Use Case:** Load balancing bij capaciteitsproblemen.

---

## 3. ANALYSIS TOOLS

### `check_deadline_feasibility`
Valideer of deadline haalbaar is gegeven effort.

**Parameters:**
```typescript
{
  deadline: string,
  required_effort_days: number,
  required_disciplines?: string[],
  project_type?: string
}
```

**Returns:**
```typescript
{
  feasible: boolean,
  confidence: 'high' | 'medium' | 'low',
  earliest_realistic_deadline: string,
  team_required: number,
  risks: string[],
  assumptions: string[]
}
```

**Use Case:** Deadline check bij nieuwe projecten.

---

### `get_resource_optimization`
Optimaliseer planning gegeven constraints.

**Parameters:**
```typescript
{
  project_ids?: string[],
  constraints: {
    max_overtime?: boolean,
    preserve_deadlines?: boolean,
    minimize_context_switching?: boolean
  },
  date_range: { start: string, end: string }
}
```

**Returns:**
```typescript
{
  optimized_plan: {
    changes_proposed: number,
    estimated_improvement: {
      load_balance_score: number,  // 0-100
      deadline_margin_days: number,
      context_switches_reduced: number
    },
    specific_changes: Array<{
      type: 'move_task' | 'adjust_hours' | 'swap_employees',
      description: string,
      project_affected: string,
      before: any,
      after: any
    }>
  }
}
```

**Use Case:** Proactieve optimalisatie suggesties.

---

### `analyze_project_health`
Geef status overzicht van project.

**Parameters:**
```typescript
{
  project_id: string
}
```

**Returns:**
```typescript
{
  health_score: number,  // 0-100
  status: 'on_track' | 'at_risk' | 'delayed',
  metrics: {
    completion_percentage: number,
    days_to_deadline: number,
    team_capacity_used: number,
    blockers: string[]
  },
  recommendations: string[]
}
```

**Use Case:** Project monitoring en early warnings.

---

## Tool Implementation Pattern

Alle tools volgen deze structuur:

```typescript
// Tool schema (OpenAI format for Claude)
const toolSchema = {
  name: "get_employee_capacity",
  description: "Check beschikbare uren voor een medewerker in een periode",
  parameters: {
    type: "object",
    properties: {
      employee_id: {
        type: "string",
        description: "UUID van de medewerker"
      },
      start_date: {
        type: "string",
        description: "Start datum in ISO format (YYYY-MM-DD)"
      },
      end_date: {
        type: "string",
        description: "Eind datum in ISO format (YYYY-MM-DD)"
      }
    },
    required: ["employee_id", "start_date", "end_date"]
  }
};

// Tool implementation
async function executeGetEmployeeCapacity(params, supabaseClient) {
  // 1. Validate inputs
  if (!isValidUUID(params.employee_id)) {
    throw new Error("Invalid employee_id");
  }

  // 2. Query database
  const { data: tasks, error } = await supabaseClient
    .from('taken')
    .select('*')
    .eq('werknemer_id', params.employee_id)
    .gte('week_start', params.start_date)
    .lte('week_start', params.end_date);

  if (error) throw error;

  // 3. Calculate capacity
  const totalHours = calculateTotalHours(tasks);
  const busyHours = tasks.reduce((sum, t) => sum + t.duur_uren, 0);

  // 4. Check verlof
  const verlof = await getVerlof(params.employee_id, params.start_date, params.end_date);

  // 5. Return formatted result
  return {
    employee_name: "...",
    total_available_hours: totalHours,
    busy_hours: busyHours,
    free_hours: totalHours - busyHours,
    busy_blocks: tasks,
    verlof: verlof
  };
}
```

---

## Tool Safety & Confirmations

### Confirmatie vereist voor:
- `schedule_meeting` - Blocks plaatsen
- `apply_project_changes` - Planning wijzigen
- `apply_verlof` - Taken verplaatsen
- Alle ACTION tools die data muteren

### Read-only tools:
- Alle QUERY tools
- Alle ANALYSIS tools
- Geen confirmatie nodig, veilig om automatisch uit te voeren

### Error Handling:
```typescript
try {
  const result = await executeTool(toolName, params);
  return { success: true, data: result };
} catch (error) {
  return {
    success: false,
    error: error.message,
    fallback: "Please use the manual form instead"
  };
}
```

---

## Tool Execution Flow

```
Claude response includes tool calls
       ↓
Edge function receives tool calls array
       ↓
For each tool call:
  ├─ Validate parameters
  ├─ Check permissions (RLS)
  ├─ Execute tool function
  └─ Collect result
       ↓
Format results for Claude
       ↓
Send back to Claude for final response
       ↓
Claude generates user-friendly explanation + confirmation buttons
       ↓
User confirms (if needed)
       ↓
Execute confirmed action
```

## Future Tools (Phase 2+)

- `generate_invoice_estimate` - Kostenschatting maken
- `analyze_profitability` - Project winstgevendheid
- `predict_capacity_issues` - Toekomstige knelpunten voorspellen
- `suggest_project_prioritization` - Prioriteiten bepalen
- `export_planning_report` - Rapportage genereren
- `sync_external_calendar` - Integratie externe agenda's
- `send_client_notification` - Klant automatisch informeren
