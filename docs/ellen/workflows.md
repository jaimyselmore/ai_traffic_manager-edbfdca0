# Ellen Workflows & Template Integration

Dit document beschrijft hoe Ellen werkt met de verschillende templates en welke data zij nodig heeft.

## Template → Ellen Flow

Alle templates (Meeting, Wijziging, Verlof, NieuwProject) verzamelen gestructureerde data en kunnen deze naar Ellen sturen voor intelligente verwerking.

```
Template Form → User Input → Ellen Analysis → Action Proposal → User Confirmation → Execution
```

---

## 1. NieuwProject Workflow

### Huidige Implementatie
**Status**: ✅ Volledig geautomatiseerd (GEEN Ellen nodig)

NieuwProject gebruikt `planningAutomation.createProjectAndSchedule()` die:
- Project aanmaakt in database
- Fases distribueert
- Team toewijst
- Blocks plaatst in planner

**Ellen's rol**: OPTIONEEL - Ellen kan helpen bij:
- Team selectie optimaliseren
- Deadline feasibility check
- Alternatieve planning voorstellen

### Data die Ellen ontvangt
```typescript
{
  projectTitel: "Selmore_12345601",
  klantNaam: "Selmore",
  klantId: "uuid",
  volledigProjectId: "12345601",
  projectomschrijving: "Video productie Q1",
  deadline: "2024-03-15",
  projectType: "productie" | "algemeen",

  // Productie specifiek:
  fases: [
    {
      naam: "Conceptontwikkeling",
      type: "conceptueel",
      medewerkers: ["uuid1", "uuid2"],
      inspanningDagen: 3
    },
    // ...meer fases
  ],

  // Algemeen specifiek:
  planningMode: "vast" | "indicatief",
  effort: {
    eenheid: "uren" | "dagen",
    hoeveelheid: 40
  }
}
```

### Ellen's Actions
```typescript
TOOLS:
- validate_deadline_feasibility(projectData) → { feasible: boolean, risks: string[] }
- suggest_team_optimization(fases, medewerkers) → { suggestions: TeamSuggestion[] }
- check_capacity_conflicts(fases, startDate) → { conflicts: Conflict[] }
- create_project(projectData) → { success: boolean, projectId: string }
```

---

## 2. Meeting/Presentatie Workflow

### Huidige Situatie
**Status**: ❌ MOET GEFIXEERD - gebruikt klanten ipv projecten

### Gewenste Data voor Ellen
```typescript
{
  // PROJECT KOPPELING (met titel!)
  projectId: "uuid",
  projectTitel: "Selmore_12345601",  // BELANGRIJK voor Ellen
  klantNaam: "Selmore",

  // MEETING DETAILS
  onderwerp: "Presentatie Fase 2 ontwerp",
  meetingType: "presentatie" | "intake" | "review" | "overleg",
  doel: "Klant goedkeuring ontwerp fase 2",  // NIEUW - helpt Ellen context begrijpen

  // TIMING
  datum: "2024-01-20",
  starttijd: "14:00",
  eindtijd: "15:30",
  locatie: "Teams / Kantoor klant",

  // DEELNEMERS
  medewerkers: ["uuid1", "uuid2"],

  // OPTIONEEL
  prioriteit: "normaal" | "urgent",
  flexibiliteit: "vast" | "flexibel"
}
```

### Ellen's Workflow

**Stap 1: Context Laden**
```typescript
Ellen haalt op:
- Project details (fases, huidige status, deadline)
- Deelnemers beschikbaarheid (agenda, verlof, andere meetings)
- Gemeenschappelijke vrije slots
- Project geschiedenis (eerdere meetings)
```

**Stap 2: Analyse**
```typescript
Ellen checkt:
✓ Zijn alle deelnemers beschikbaar op voorgestelde tijd?
✓ Is er voldoende voorbereidingstijd voor het team?
✓ Past dit logisch in project timeline?
✓ Zijn er conflicterende meetings?
```

**Stap 3: Voorstel**
```typescript
Ellen suggereert:
"Ik zie dat je een presentatie wilt plannen voor Selmore_12345601.

Voorgestelde tijd: 20 jan, 14:00-15:30
✓ Alle deelnemers beschikbaar
✓ Fase 2 is volgens planning dan klaar voor review
⚠️ Let op: Sarah heeft die dag al 2 meetings

Alternatief: 22 jan, 10:00-11:30 (minder druk voor Sarah)

[Bevestig 20 jan] [Kies 22 jan] [Andere tijd]"
```

**Stap 4: Uitvoering**
```typescript
Na bevestiging, Ellen:
1. Maakt meeting record aan (meetings_presentaties tabel)
2. Plaatst blocks voor deelnemers in planner
3. Verstuurt agenda uitnodiging (toekomstig)
4. Maakt voorbereiding tasks (toekomstig)
```

### Ellen's Tools
```typescript
- get_project_context(projectId) → ProjectDetails
- check_availability(medewerkers[], datum, tijd) → AvailabilityStatus
- find_common_slots(medewerkers[], dateRange) → TimeSlot[]
- schedule_meeting(meetingData) → { success: boolean, meetingId: string }
- suggest_alternatives(conflicts) → AlternativeProposal[]
```

---

## 3. Wijzigingsverzoek Workflow

### Huidige Situatie
**Status**: ⚠️ MOET VERBETERD - mist titel + context velden

### Gewenste Data voor Ellen
```typescript
{
  // PROJECT
  projectId: "uuid",
  projectTitel: "Selmore_12345601",  // TOEVOEGEN
  klantNaam: "Selmore",

  // WIJZIGING TYPE
  wijzigingType: "scope" | "timing" | "team" | "uren",

  // CONTEXT (NIEUW - essentieel voor Ellen)
  reden: "Klant verzoek" | "Technische blocker" | "Scope creep" | "Planning conflict" | "Anders",
  huidigeSituatie: "Fase 2 gepland in week 5, 3 dagen",
  gewensteSituatie: "Fase 2 verplaatsen naar week 7, uitbreiden naar 5 dagen",

  // IMPACT
  impactScope: "klein" | "middel" | "groot",  // NIEUW
  urgentie: "normaal" | "urgent",  // NIEUW

  // DETAILS
  beschrijving: "Klant heeft extra feedback, meer tijd nodig voor aanpassingen",
  nieuwDeadline: "2024-02-15",  // Optioneel
  medewerkers: ["uuid1"]  // Betrokkenen
}
```

### Ellen's Workflow

**Stap 1: Huidige Planning Ophalen**
```typescript
Ellen haalt project op:
- Huidige fases en hun planning
- Toegewezen medewerkers
- Deadline
- Dependencies (welke fases hangen af van deze fase?)
```

**Stap 2: Impact Analyse**
```typescript
Ellen berekent:
✓ Hoeveel taken worden beïnvloed?
✓ Welke medewerkers krijgen meer/minder werk?
✓ Raakt dit de deadline?
✓ Zijn er andere projecten die hierdoor verschuiven?
```

**Stap 3: Voorstel**
```typescript
Ellen reageert:
"Ik begrijp het. Je wilt Fase 2 van Selmore_12345601 aanpassen:

HUIDIGE PLANNING:
- Week 5 (3 dagen, Mark + Sarah)

GEWENSTE WIJZIGING:
- Week 7 (5 dagen, Mark + Sarah)
- Reden: Extra klant feedback

IMPACT ANALYSE:
⚠️ Deadline verschuift van 15 feb naar 22 feb (+7 dagen)
✓ Mark en Sarah hebben capaciteit in week 7
✓ Geen andere projecten beïnvloed

VOORSTEL:
1. Verschuif Fase 2 naar week 7
2. Pas deadline aan naar 22 feb
3. Notificeer klant over nieuwe deadline

[Goedkeuren] [Alleen Fase 2 verschuiven] [Annuleren]"
```

**Stap 4: Uitvoering**
```typescript
Na goedkeuring, Ellen:
1. Verwijdert oude blocks (week 5)
2. Plaatst nieuwe blocks (week 7, 5 dagen)
3. Update project deadline
4. Logt wijziging in audit trail
5. Maakt notification voor betrokkenen
```

### Ellen's Tools
```typescript
- get_current_planning(projectId) → CurrentPlanning
- analyze_impact(wijziging) → ImpactAnalysis
- calculate_new_deadline(wijziging) → Date
- check_alternative_slots(requirements) → TimeSlot[]
- apply_changes(wijziging) → { success: boolean, affectedTasks: Task[] }
- notify_stakeholders(wijziging) → { sent: boolean }
```

---

## 4. Verlof Workflow

### Huidige Situatie
**Status**: ⚠️ MOET VERBETERD - mist project context en backup

### Gewenste Data voor Ellen
```typescript
{
  // MEDEWERKER
  medewerker: "uuid",
  medewerkerNaam: "Sarah de Vries",

  // VERLOF TYPE
  verlofType: "vakantie" | "ziek" | "onbetaald" | "zwangerschapsverlof",
  verlofCategorie: "gepland" | "urgent",  // NIEUW

  // PERIODE
  startdatum: "2024-01-15",
  einddatum: "2024-01-19",
  reden: "Familievakantie",  // Optioneel

  // BACKUP (NIEUW)
  backupPersoon: "uuid" | null,  // Optioneel - wie neemt taken over?

  // AUTO-GEVULD (Ellen haalt op)
  betroffenProjecten: ["project_id1", "project_id2"]  // Readonly
}
```

### Ellen's Workflow

**Stap 1: Conflicterende Taken Ophalen**
```typescript
Ellen zoekt:
- Alle taken van Sarah in periode 15-19 jan
- Projecten waar Sarah aan werkt
- Deadlines die risico lopen
- Kritieke meetings waar Sarah bij hoort
```

**Stap 2: Impact Analyse**
```typescript
Ellen analyseert:
✓ 3 projecten beïnvloed
✓ 12 uur werk moet herverdeeld
✓ 1 klant presentatie (18 jan) - Sarah is lead!
⚠️ Project "Videoland_45678902" heeft deadline 20 jan
```

**Stap 3: Voorstel**
```typescript
Ellen reageert:
"Sarah heeft verlof 15-19 jan (5 dagen).

BETROKKEN PROJECTEN:
1. Selmore_12345601 - Fase 3 (6 uur)
2. Videoland_45678902 - Finale edit (8 uur) ⚠️ DEADLINE 20 jan!
3. Nike_11223344 - Review (4 uur)

KRITIEK:
⚠️ Presentatie 18 jan voor Selmore (Sarah is lead)

OPLOSSINGSOPTIES:
A. HERVERDELEN
   - Mark neemt Selmore Fase 3 over (heeft capaciteit)
   - Lisa doet Nike Review
   - Videoland deadline verschuiven naar 27 jan

B. BACKUP PERSOON
   - Wie kan Sarah vervangen voor Selmore presentatie?
   - Kies backup: [Mark] [Lisa] [Peter]

C. TAKEN UITSTELLEN
   - Alle taken verschuiven naar week na 19 jan
   - Deadlines aanpassen waar nodig

[Kies optie A] [Kies optie B] [Kies optie C] [Custom]"
```

**Stap 4: Uitvoering**
```typescript
Na keuze, Ellen:
1. Plaatst verlof record in database
2. Verwijdert/verschuift conflicterende taken
3. Wijst taken toe aan backup persoon (indien gekozen)
4. Past deadlines aan (indien nodig)
5. Blokkeert Sarah's agenda
6. Notificaties naar betrokken projecten
7. Email naar klant (indien presentatie verschoven)
```

### Ellen's Tools
```typescript
- get_employee_tasks(medewerker, dateRange) → Task[]
- find_conflicts(medewerker, verlofPeriode) → Conflict[]
- suggest_backup_person(tasks) → Employee[]
- redistribute_tasks(tasks, targetEmployee) → RedistributionPlan
- apply_verlof(verlofData) → { success: boolean, affectedTasks: Task[] }
- notify_affected_projects(projectIds) → { sent: boolean }
```

---

## 5. Ellen's Decision Tree

### Voor elk verzoek volgt Ellen deze stappen:

```
1. INTAKE
   ├─ Welk type verzoek? (Project/Meeting/Wijziging/Verlof)
   ├─ Zijn alle verplichte velden ingevuld?
   └─ Is er genoeg context?

2. CONTEXT LOADING
   ├─ Haal relevante projecten op (met titel!)
   ├─ Check team capaciteit
   ├─ Bekijk huidige planning
   └─ Identificeer constraints

3. ANALYSE
   ├─ Zijn er conflicten?
   ├─ Is het haalbaar binnen constraints?
   ├─ Wat is de impact?
   └─ Zijn er risico's?

4. OPLOSSING GENEREREN
   ├─ Primair voorstel (ideale oplossing)
   ├─ Alternatieven (indien primair niet mogelijk)
   ├─ Trade-offs expliciet maken
   └─ Risico's communiceren

5. PRESENTEREN
   ├─ Leg uit WAT je voorstelt
   ├─ Leg uit WAAROM (rationale)
   ├─ Toon IMPACT
   └─ Geef KEUZES (action buttons)

6. EXECUTIE
   ├─ Wacht op gebruiker bevestiging
   ├─ Voer tools uit (database updates)
   ├─ Verifieer success
   └─ Bevestig naar gebruiker
```

---

## 6. Template Verbeteringen voor Ellen

### Wat MOET toegevoegd worden:

**Meeting Template:**
- [ ] Vervang klanten dropdown door **ProjectSelector** (met titel!)
- [ ] Voeg "Doel van meeting" veld toe (textarea)
- [ ] Optioneel: Prioriteit dropdown

**Wijziging Template:**
- [ ] Fix **ExistingProjectSelector** om titel te tonen
- [ ] Voeg "Reden" dropdown toe
- [ ] Voeg "Huidige situatie" textarea toe
- [ ] Voeg "Gewenste situatie" textarea toe
- [ ] Voeg "Impact scope" dropdown toe
- [ ] Voeg "Urgentie" dropdown toe

**Verlof Template:**
- [ ] Voeg "Verlof categorie" dropdown toe (Gepland/Urgent)
- [ ] Voeg "Backup persoon" selector toe (optioneel)
- [ ] Toon betrokken projecten (auto-fetch, readonly)

### Data die Ellen ALTIJD nodig heeft:

**Voor alle templates:**
- ✅ **Project titel** - Identificatie (format: `{klantnaam}_{projectId}`)
- ✅ **Timing** - Datum/tijd/periode
- ✅ **Betrokkenen** - Medewerkers/team
- ❌ **Context** - Waarom deze actie? (nieuw veld)
- ❌ **Impact** - Hoe groot is de verandering? (nieuw veld)

---

## 7. Ellen Conversation Patterns

### Pattern 1: Happy Path
```
USER: "Plan een meeting voor Selmore_12345601"
ELLEN: "Ik zie dat je een meeting wilt plannen. Welk type meeting?"
USER: "Presentatie, volgende week dinsdag"
ELLEN: "✓ Dinsdag 23 jan, 14:00-15:30. Mark en Sarah beschikbaar. Bevestigen?"
USER: "Ja"
ELLEN: "✓ Meeting gepland! Agenda uitnodiging verstuurd."
```

### Pattern 2: Conflict
```
USER: "Plan een meeting voor Selmore_12345601"
ELLEN: "⚠️ Sarah heeft die dag al 2 meetings. Alternatief: woensdag 10:00?"
USER: "Oké, woensdag"
ELLEN: "✓ Meeting gepland voor woensdag 24 jan, 10:00-11:30"
```

### Pattern 3: Onvolledige Informatie
```
USER: "Wijzig project 12345601"
ELLEN: "Wat wil je wijzigen aan Selmore_12345601?"
USER: "Deadline verschuiven"
ELLEN: "Naar welke datum?"
USER: "15 maart"
ELLEN: "✓ Deadline verschoven. Impact: Fase 3 krijgt 2 extra dagen."
```

### Pattern 4: Onhaalbaar Verzoek
```
USER: "Nieuw project, deadline morgen"
ELLEN: "❌ Dat is niet haalbaar. Een typisch project duurt 3 weken.
       Vroegste realistische deadline: 15 februari. Wil je dit aanpassen?"
USER: "Ja, 15 feb is oké"
ELLEN: "✓ Ik maak een planning voor deadline 15 februari."
```

---

## Implementatie Volgorde

1. **Fix titel integratie** (alle templates)
2. **Bouw Ellen backend** (edge function + tools)
3. **Connect Meeting template** (eerste integration test)
4. **Test & iterate** (verfijn prompts)
5. **Roll out Wijziging** (tweede template)
6. **Roll out Verlof** (derde template)
7. **Optimize & scale** (proactive features)
