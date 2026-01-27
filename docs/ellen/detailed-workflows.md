# Gedetailleerde Workflows

Dit document beschrijft EXACT hoe elke workflow werkt, stap voor stap, met alle details.

---

## WORKFLOW 1: NIEUW PROJECT PLANNING

### Overzicht
Planner vult Nieuw Project template → Workflows halen data op → Ellen legt planning puzzel → Planner kiest voorstel → Overlegt met klant → Planning wordt vast

---

### STAP 1: Template Invulling

**Scherm:** NieuwProject.tsx

**Planner vult in:**

```
┌────────────────────────────────────────────────────────┐
│ NIEUW PROJECT                                          │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Klant: [Dropdown: Selmore ▼]                         │
│                                                        │
│ Project omschrijving:                                  │
│ [Video productie voor nieuw product launch]          │
│                                                        │
│ Deadline: [📅 2024-03-15]                            │
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ FASES                                             │ │
│ ├──────────────────────────────────────────────────┤ │
│ │                                                   │ │
│ │ Fase 1: Conceptontwikkeling                       │ │
│ │ Mensen: [☑ Mark] [☑ Sarah]                       │ │
│ │ Dagen: [3]                                        │ │
│ │                                                   │ │
│ │ Fase 2: Productie                                 │ │
│ │ Mensen: [☑ Team A] [☑ Camera crew]              │ │
│ │ Dagen: [5]                                        │ │
│ │                                                   │ │
│ │ Fase 3: Edit                                      │ │
│ │ Mensen: [☑ Lisa] [☑ Peter]                       │ │
│ │ Dagen: [4]                                        │ │
│ │                                                   │ │
│ │ [+ Fase toevoegen]                                │ │
│ └──────────────────────────────────────────────────┘ │
│                                                        │
│ Vaste presentatiedata? (optioneel)                    │
│ [ ] Ja, data zijn al met klant afgesproken           │
│                                                        │
│ [Opslaan als concept]  [Planning laten maken] ──────► │
└────────────────────────────────────────────────────────┘
```

**Validatie bij submit:**
- ✅ Klant geselecteerd
- ✅ Deadline ingevuld
- ✅ Minimaal 1 fase met mensen + dagen
- ❌ Als niet compleet → Error message

---

### STAP 2: Workflow Triggers (Automatisch)

**Trigger:** Planner klikt "Planning laten maken"

**Backend process start:**

```typescript
async function handleNewProjectSubmit(templateData) {

  // Show loading state
  showLoadingScreen("Ellen analyseert beschikbaarheid...");

  // 1. Extract team members
  const teamMembers = extractTeamMembers(templateData.fases);
  // Bijv: ["mark@bureau.nl", "sarah@bureau.nl", "lisa@bureau.nl"]

  // 2. Parallel data fetching (workflows)
  const contextData = await Promise.all([

    // A. Outlook Calendars (via MS Graph API)
    fetchOutlookCalendars({
      users: teamMembers,
      startDate: new Date(),
      endDate: templateData.deadline
    }),
    // Returns: Busy times per person

    // B. Verlof
    supabase
      .from('verlof_aanvragen')
      .select('*')
      .in('werknemer_email', teamMembers)
      .gte('eind_datum', new Date())
      .eq('status', 'goedgekeurd'),
    // Returns: Approved leave per person

    // C. Beschikbaarheid (werkuren)
    supabase
      .from('medewerkers')
      .select('naam_werknemer, werkuren, beschikbaar')
      .in('email', teamMembers),
    // Returns: Work hours per person (bijv 40 uur/week)

    // D. Klant constraints
    supabase
      .from('klanten')
      .select('beschikbaarheid, voorkeur_tijden')
      .eq('id', templateData.klantId)
      .single(),
    // Returns: Klant kan niet op: ["woensdag", "vrijdag"]

    // E. Current workload
    supabase
      .from('taken')
      .select('werknemer_naam, project_titel, week_start, duur_uren')
      .in('werknemer_naam', getNamesList(teamMembers))
      .gte('week_start', new Date())
      .lte('week_start', templateData.deadline)
  ]);

  // 3. Format data for Ellen
  const ellenContext = {
    template: templateData,
    calendars: contextData[0],
    verlof: contextData[1].data,
    availability: contextData[2].data,
    klantConstraints: contextData[3].data,
    workload: contextData[4].data,
    timestamp: new Date().toISOString()
  };

  // 4. Trigger Ellen
  return await triggerEllen(ellenContext);
}
```

**Timing:** Dit moet snel (< 5 seconden)

---

### STAP 3: Ellen Analyse

**Input:** Ellen krijgt alle context data

**Ellen's denkproces:**

```
1. DEADLINE CHECK
   - Hoeveel weken tot deadline?
   - Hoeveel werkdagen beschikbaar?
   - Totaal benodigde dagen: 3 + 5 + 4 = 12 dagen
   - Conclusie: Haalbaar / Niet haalbaar

2. BESCHIKBAARHEID ANALYSE
   Per persoon:
   - Mark: 3 dagen nodig
     → Check verlof: Geen verlof
     → Check agenda: Meetings op wo 14:00
     → Check workload: 2 andere projecten, 20 uur/week bezet
     → Conclusie: 20 uur beschikbaar/week

   - Sarah: 2 dagen nodig
     → Check verlof: Verlof week 8-9
     → Check agenda: Drukke agenda (veel meetings)
     → Check workload: 3 projecten, 35 uur/week bezet
     → Conclusie: 5 uur beschikbaar/week, verlof week 8-9

   - etc. voor alle mensen

3. PLANNING BEREKENING
   Fase 1 (Concept): Mark 3d + Sarah 2d

   Wie eerst?
   - Sarah heeft minder beschikbaarheid
   - Sarah's verlof komt eraan (week 8-9)
   - Plan Sarah eerst: Week 3-4
   - Dan Mark: Week 4-5

   Fase 2 (Productie): 5 dagen
   - Kan niet tijdens Sarah/Mark verlof
   - Moet na Concept
   - Plan: Week 6-7

   Fase 3 (Edit): 4 dagen
   - Moet na Productie
   - Moet voor deadline (week 11)
   - Plan: Week 8-9

4. PRESENTATIEMOMENTEN
   Timeline: Week 3-9 (6 weken)
   Deadline: Week 11

   Logische momenten:
   - Na Concept (week 5): Presentatie 1
   - Na Productie (week 7): Presentatie 2
   - Voor deadline (week 10): Finale presentatie

   Check klant beschikbaarheid:
   - Klant kan NIET op woensdag, vrijdag
   - Plan alleen: ma, di, do

   Voorgestelde data:
   - Presentatie 1: Week 5, dinsdag 14:00
   - Presentatie 2: Week 7, donderdag 10:00
   - Presentatie 3: Week 10, maandag 15:00

5. FEEDBACKTIJD
   - Tussen P1 en start Productie: 1 week (OK)
   - Tussen P2 en start Edit: 1 week (OK)
   - Tussen P3 en deadline: 1 week (OK)

6. RISICO'S
   ⚠️ Sarah heeft weinig beschikbaarheid (5u/week)
   ⚠️ Verlof Sarah week 8-9 (tijdens Edit fase)
   ✓ Deadline is haalbaar
   ✓ Voldoende feedbacktijd

7. ALTERNATIEVE VOORSTELLEN
   Voorstel 1 (Optimaal):
   - Start week 3, eindigt week 10
   - 3 presentaties
   - Risico: Sarah weinig tijd

   Voorstel 2 (Veiliger):
   - Start week 2, eindigt week 9
   - 3 presentaties
   - Lisa ipv Sarah voor Concept (meer tijd)
   - Voordeel: Minder risico

   Voorstel 3 (Sneller):
   - Start week 4, eindigt week 10
   - 2 presentaties (ipv 3)
   - Minder feedbacktijd
   - Risico: Minder klant controle
```

**Output:** Ellen genereert 2-3 voorstellen met rationale

---

### STAP 4: Ellen Presenteert Voorstellen

**Scherm:** EllenChatPage.tsx

**Ellen's response:**

```
┌────────────────────────────────────────────────────────┐
│ 💬 ELLEN                                               │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Ik heb de planning geanalyseerd voor Selmore video    │
│ productie (deadline: 15 maart).                        │
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ VOORSTEL 1: OPTIMAAL                              │ │
│ ├──────────────────────────────────────────────────┤ │
│ │                                                   │ │
│ │ Timeline: 3 feb - 4 maart (6 weken)              │ │
│ │ Presentaties: 3x                                  │ │
│ │                                                   │ │
│ │ Week 3-4: Concept (Mark + Sarah)                 │ │
│ │ Week 5:   Presentatie 1 (di 14:00)               │ │
│ │ Week 6-7: Productie (Team A + crew)              │ │
│ │ Week 7:   Presentatie 2 (do 10:00)               │ │
│ │ Week 8-9: Edit (Lisa + Peter)                    │ │
│ │ Week 10:  Presentatie 3 (ma 15:00)               │ │
│ │ Deadline: Week 11 (1 week buffer)                │ │
│ │                                                   │ │
│ │ ⚠️ Let op: Sarah heeft weinig beschikbaarheid    │ │
│ │    (5 uur/week beschikbaar)                       │ │
│ │                                                   │ │
│ │ [Kies dit voorstel] ─────────────────────────────►│ │
│ └──────────────────────────────────────────────────┘ │
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ VOORSTEL 2: VEILIGER                              │ │
│ ├──────────────────────────────────────────────────┤ │
│ │                                                   │ │
│ │ Timeline: 27 jan - 25 feb (5 weken)              │ │
│ │ Presentaties: 3x                                  │ │
│ │                                                   │ │
│ │ Week 2-3: Concept (Mark + Lisa ipv Sarah)        │ │
│ │ Week 4:   Presentatie 1 (di 14:00)               │ │
│ │ Week 5-6: Productie (Team A + crew)              │ │
│ │ Week 6:   Presentatie 2 (do 10:00)               │ │
│ │ Week 7-8: Edit (Lisa + Peter)                    │ │
│ │ Week 9:   Presentatie 3 (ma 15:00)               │ │
│ │ Deadline: Week 11 (2 weken buffer!)              │ │
│ │                                                   │ │
│ │ ✓ Lisa heeft meer beschikbaarheid dan Sarah      │ │
│ │ ✓ Meer buffer tot deadline                        │ │
│ │                                                   │ │
│ │ [Kies dit voorstel] ─────────────────────────────►│ │
│ └──────────────────────────────────────────────────┘ │
│                                                        │
│ [Wijzig iets] [Opnieuw berekenen]                     │
└────────────────────────────────────────────────────────┘
```

---

### STAP 5: Planner Kiest Voorstel

**Actie:** Planner klikt "Kies dit voorstel" (bijv Voorstel 2)

**System:**
```
1. Markeer voorstel als gekozen
2. Status: CONCEPT
3. Insert in database:
   - Project record (status: concept)
   - Project_fases records
   - Taken records (planning blocks)
   - Meetings records (presentaties)
4. Navigeer naar Planner view
```

**Planner ziet nu:**
- Planning in planner grid (DOORZICHTIGE kleuren)
- Label: "CONCEPT - Nog niet bevestigd door klant"

---

### STAP 6: Planner Overlegt met Klant

**Buiten platform:**

```
Planner belt/mailt klant:

"Hoi Jan,

We hebben de planning gemaakt voor jullie video productie.
We stellen voor:

- Presentatie 1: Dinsdag 5 februari, 14:00 (concept)
- Presentatie 2: Donderdag 14 februari, 10:00 (eerste opnames)
- Presentatie 3: Maandag 25 februari, 15:00 (finale versie)

Kunnen jullie op deze data? Locatie: bij jullie of bij ons?

Groet,
Planner"
```

**Klant antwoordt:**

**Scenario A: Klant akkoord**
```
"Ja perfect! We doen het bij ons.
Zie jullie 5 februari!"

→ Ga naar STAP 7
```

**Scenario B: Klant wil andere data**
```
"5 feb kunnen we niet, kunnen we 6 feb doen?
Rest is prima."

→ Ga naar STAP 6B
```

---

### STAP 6B: Aanpassen op Klant Verzoek

**Planner gaat terug naar platform:**

**Optie 1: Kleine aanpassing (zelf doen)**
```
Planner gaat naar planning
Klikt op Presentatie 1 blok
Wijzigt datum: 5 feb → 6 feb
System checkt conflict
Als OK → Opgeslagen
```

**Optie 2: Grote aanpassing (via Ellen)**
```
Planner gaat naar Wijziging template
Selecteert project: Selmore video
Kiest: "Presentatie verzetten"
Vult in: P1 van 5 feb → 6 feb
Ellen herberekent:
→ Check impact (moet iets verschoven?)
→ Geeft nieuw voorstel
Planner bevestigt
```

**Daarna:** Terug naar klant met aangepaste planning
**Als klant OK:** Ga naar STAP 7

---

### STAP 7: Planning Wordt VAST

**In platform:**

```
Planner gaat naar project
Klikt: "Klant heeft goedgekeurd"

Modal opent:
┌──────────────────────────────────────────┐
│ Bevestig planning                        │
├──────────────────────────────────────────┤
│                                          │
│ Klant heeft de volgende data            │
│ goedgekeurd:                             │
│                                          │
│ - Presentatie 1: 6 feb, 14:00          │
│ - Presentatie 2: 14 feb, 10:00         │
│ - Presentatie 3: 25 feb, 15:00         │
│                                          │
│ Locatie: [Bij klant ▼]                 │
│                                          │
│ ☑ Klant akkoord gegeven                │
│                                          │
│ [Annuleren] [Bevestigen] ──────────────►│
└──────────────────────────────────────────┘
```

**Na bevestiging:**

```
1. Update project status: concept → vast
2. Update kleuren in planner: doorzichtig → vol
3. Verstuur notificaties:
   - Naar betrokken teamleden
   - "Je bent ingepland voor Selmore video"
4. Unlock team update mogelijkheid
5. Log in audit trail
```

**Planner ziet:**
- Planning in volle kleuren
- Label: "VAST"
- Button beschikbaar: "Team updates plannen"

---

### STAP 8: Team Updates Plannen (Handmatig)

**Planner klikt:** "Team updates plannen"

```
┌──────────────────────────────────────────┐
│ Team Updates                             │
├──────────────────────────────────────────┤
│                                          │
│ Per presentatie 1 team update:          │
│                                          │
│ Presentatie 1 (6 feb):                  │
│ Team update: [📅 5 feb] [⏰ 10:00]     │
│ Deelnemers: [☑ Mark] [☑ Lisa] [☑ Sarah]│
│                                          │
│ Presentatie 2 (14 feb):                 │
│ Team update: [📅 13 feb] [⏰ 15:00]    │
│ Deelnemers: [☑ Team A] [☑ Crew]        │
│                                          │
│ Presentatie 3 (25 feb):                 │
│ Team update: [📅 24 feb] [⏰ 11:00]    │
│ Deelnemers: [☑ Lisa] [☑ Peter]         │
│                                          │
│ [Opslaan] ──────────────────────────────►│
└──────────────────────────────────────────┘
```

**System:**
- Insert team update meetings in database
- Show in planner
- Verstuur notificaties

---

## WORKFLOW 2: WIJZIGING AANVRAGEN

### Trigger
Planning staat VAST → Iets moet wijzigen

---

### STAP 1: Wijziging Template Invullen

**Scherm:** Wijzigingsverzoek.tsx

```
┌────────────────────────────────────────────────────────┐
│ WIJZIGING AANVRAGEN                                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Welk project?                                          │
│ [Dropdown: Selmore_12345601 ▼]                        │
│                                                        │
│ Wat wil je wijzigen?                                   │
│ ( ) Persoon vervangen                                 │
│ ( ) Datum verschuiven                                 │
│ ( ) Uren aanpassen                                    │
│ (•) Presentatie verzetten                             │
│ ( ) Meerdere dingen                                   │
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ DETAILS (dynamisch, omdat "Presentatie" gekozen) │ │
│ ├──────────────────────────────────────────────────┤ │
│ │                                                   │ │
│ │ Welke presentatie?                                │ │
│ │ [Dropdown: Presentatie 1 (6 feb) ▼]             │ │
│ │                                                   │ │
│ │ Nieuwe datum:                                     │ │
│ │ [📅 8 februari]                                  │ │
│ │                                                   │ │
│ │ Nieuwe tijd:                                      │ │
│ │ [⏰ 15:00]                                        │ │
│ │                                                   │ │
│ └──────────────────────────────────────────────────┘ │
│                                                        │
│ Reden:                                                 │
│ [Dropdown: Klant verzoek ▼]                           │
│                                                        │
│ Urgentie:                                              │
│ (•) Normaal  ( ) Urgent                               │
│                                                        │
│ Extra toelichting: (optioneel)                         │
│ [Klant heeft andere afspraak op 6 feb]               │
│                                                        │
│ [Annuleren] [Wijziging indienen] ─────────────────────►│
└────────────────────────────────────────────────────────┘
```

---

### STAP 2: Ellen Analyseert Impact

**Ellen krijgt:**
- Project data (huidige planning)
- Wijziging verzoek
- Alle context (agenda's, verlof, etc.)

**Ellen analyseert:**

```
1. HUIDIGE SITUATIE
   Presentatie 1: 6 feb, 14:00
   Planning:
   - Week 1-2: Concept (al gepland)
   - Week 3: Presentatie 1 (6 feb)
   - Week 4-5: Productie (gepland na P1)

2. GEVRAAGDE WIJZIGING
   Presentatie 1: 6 feb → 8 feb (+2 dagen)

3. IMPACT ANALYSE
   Direct beïnvloed:
   - Presentatie 1 zelf (verschuift)

   Indirect beïnvloed:
   - Productie start (was gepland voor 10 feb)
   - Moet nu 12 feb worden (wachten op feedback)

   Domino effect:
   - Presentatie 2 (was 14 feb)
   - Moet nu 21 feb (na Productie)
   - Edit start verschuift
   - Presentatie 3 verschuift

4. DEADLINE CHECK
   Huidige deadline: 1 maart
   Met wijziging: 8 maart (+ 7 dagen)

   ⚠️ Deadline wordt overschreden!

5. ALTERNATIEVEN
   Optie A: Accepteer nieuwe deadline (8 maart)
   Optie B: Verkort Edit fase (4 → 3 dagen)
   Optie C: Overlap Productie en Edit (risicovol)

6. RISICO'S
   ⚠️ Deadline overschreden (+7 dagen)
   ⚠️ Team A heeft mogelijk andere commitment week 6
   ✓ Geen verlof conflicten
```

**Ellen's voorstel:**

```
┌────────────────────────────────────────────────────────┐
│ 💬 ELLEN - IMPACT ANALYSE                              │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Ik heb de impact geanalyseerd van Presentatie 1       │
│ verzetten naar 8 februari.                             │
│                                                        │
│ IMPACT:                                                │
│ ⚠️ DEADLINE IN GEVAAR                                 │
│                                                        │
│ Door 2 dagen verschuiving ontstaat domino effect:     │
│ - Productie start: 10 feb → 12 feb                   │
│ - Presentatie 2: 14 feb → 21 feb                     │
│ - Edit: verschuift 1 week                             │
│ - Nieuwe deadline: 8 maart (ipv 1 maart)             │
│                                                        │
│ BETROKKEN TAKEN: 12 blokken verschuiven              │
│ BETROKKEN MENSEN: 5 personen                          │
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ OPTIE A: ACCEPTEER NIEUWE DEADLINE                │ │
│ ├──────────────────────────────────────────────────┤ │
│ │ Deadline: 8 maart (+7 dagen)                      │ │
│ │ Alle fases behouden kwaliteit                     │ │
│ │ Voordeel: Geen haast, normale workflow           │ │
│ │ Nadeel: Moet klant akkoord geven                  │ │
│ │ [Kies deze optie] ────────────────────────────────►│ │
│ └──────────────────────────────────────────────────┘ │
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ OPTIE B: VERKORT EDIT FASE                        │ │
│ ├──────────────────────────────────────────────────┤ │
│ │ Edit: 4 dagen → 3 dagen                          │ │
│ │ Deadline: 1 maart (origineel)                     │ │
│ │ Voordeel: Deadline blijft staan                   │ │
│ │ ⚠️ Nadeel: Minder tijd voor edit, risico kwaliteit│ │
│ │ [Kies deze optie] ────────────────────────────────►│ │
│ └──────────────────────────────────────────────────┘ │
│                                                        │
│ [Annuleren] [Andere oplossing vragen]                 │
└────────────────────────────────────────────────────────┘
```

---

### STAP 3: Planner Kiest & Bevestigt

Planner kiest: "Optie A" (Nieuwe deadline)

**System:**
1. Update alle betrokken taken
2. Update deadline in project
3. Status blijft VAST (want klant moet nog akkoord)
4. Log wijziging in audit trail

**Planner moet:**
- Klant informeren over nieuwe deadline
- Klant akkoord krijgen
- In systeem bevestigen

---

## WORKFLOW 3: AD-HOC MEETING TOEVOEGEN

### Trigger
Planning staat vast → Extra meeting nodig (niet gepland)

---

### STAP 1: Meeting Template (Quick Add Mode)

**From:** Dashboard → Button "Snelle Meeting"

```
┌────────────────────────────────────────────────────────┐
│ SNELLE MEETING TOEVOEGEN                               │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Project: (optioneel)                                   │
│ [Dropdown: Selmore_12345601 ▼]                        │
│                                                        │
│ Onderwerp:                                             │
│ [Tussentijds overleg klant]                           │
│                                                        │
│ Type:                                                  │
│ [Dropdown: Overleg ▼]                                 │
│                                                        │
│ Datum: [📅 12 februari]                               │
│ Tijd: [⏰ 10:00] tot [⏰ 11:00]                       │
│                                                        │
│ Deelnemers:                                            │
│ [☑ Mark] [☑ Sarah] [ ] Lisa [ ] Peter                │
│                                                        │
│ Locatie:                                               │
│ ( ) Bij ons                                           │
│ (•) Bij klant                                         │
│                                                        │
│ Reistijd: [1 uur]                                     │
│ (tijd wordt automatisch geblokkeerd vóór meeting)     │
│                                                        │
│ [Annuleren] [Toevoegen] ───────────────────────────────►│
└────────────────────────────────────────────────────────┘
```

---

### STAP 2: Automation Check (GEEN Ellen)

**Backend workflow:**

```typescript
async function handleQuickMeetingAdd(meetingData) {

  // 1. Check conflicts
  const conflicts = await checkMeetingConflicts({
    deelnemers: meetingData.deelnemers,
    datum: meetingData.datum,
    starttijd: meetingData.starttijd,
    eindtijd: meetingData.eindtijd,
    reistijd: meetingData.reistijd // Blokkeer ook reistijd
  });

  if (conflicts.length > 0) {
    // Show conflict warning
    return {
      success: false,
      conflicts: conflicts,
      message: `${conflicts[0].naam} is al bezet op dit tijdstip`
    };
  }

  // 2. Insert meeting
  const { data: meeting, error } = await supabase
    .from('meetings & presentaties')
    .insert({
      project_id: meetingData.projectId,
      onderwerp: meetingData.onderwerp,
      type: meetingData.type,
      datum: meetingData.datum,
      start_tijd: meetingData.starttijd,
      eind_tijd: meetingData.eindtijd,
      locatie: meetingData.locatie,
      deelnemers: meetingData.deelnemers,
      created_by: currentUser.id
    });

  if (error) return { success: false, error };

  // 3. Create blocks in planner (per deelnemer)
  const blocks = meetingData.deelnemers.map(deelnemer => ({
    werknemer_naam: deelnemer,
    project_titel: meetingData.projectTitel,
    fase_naam: 'Meeting',
    datum: meetingData.datum,
    start_uur: getHour(meetingData.starttijd),
    duur_uren: calculateDuration(meetingData.starttijd, meetingData.eindtijd) + (meetingData.reistijd || 0),
    plan_status: 'vast',
    is_meeting: true
  }));

  await supabase.from('taken').insert(blocks);

  // 4. Send notifications
  await sendNotifications(meetingData.deelnemers, meeting);

  return { success: true, meetingId: meeting.id };
}
```

**Als conflict:**
```
┌────────────────────────────────────────────────────────┐
│ ⚠️ CONFLICT GEDETECTEERD                              │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Mark is al bezet op 12 feb, 10:00:                   │
│ - Project: Nike_11223344 (Edit)                      │
│ - Tijd: 09:00 - 12:00                                │
│                                                        │
│ Wil je:                                                │
│ [Andere tijd kiezen] [Toch inplannen] [Annuleren]    │
└────────────────────────────────────────────────────────┘
```

**Als OK:**
```
✓ Meeting toegevoegd!
→ Navigeer naar Planner
```

---

## WORKFLOW 4: VERLOF AANVRAGEN

### Scenario A: Preventief (bij nieuwe planning)

**Ellen checkt verlof automatisch bij nieuwe project planning**

Zie WORKFLOW 1, STAP 3 (Ellen Analyse) - punt 2 "Beschikbaarheid analyse"

---

### Scenario B: Reactief (verlof wordt ingevoerd)

### STAP 1: Verlof Template Invullen

```
┌────────────────────────────────────────────────────────┐
│ VERLOF AANVRAGEN                                       │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Medewerker:                                            │
│ [Dropdown: Sarah de Vries ▼]                          │
│                                                        │
│ Type:                                                  │
│ [Dropdown: Vakantie ▼]                                │
│                                                        │
│ Categorie:                                             │
│ (•) Gepland  ( ) Urgent                               │
│                                                        │
│ Periode:                                               │
│ Van: [📅 20 februari]                                 │
│ Tot: [📅 24 februari]                                 │
│                                                        │
│ Backup persoon: (optioneel)                            │
│ [Dropdown: Lisa ▼]                                    │
│                                                        │
│ Reden: (optioneel)                                     │
│ [Wintersport vakantie]                                │
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ BETROKKEN PROJECTEN (automatisch opgehaald)      │ │
│ ├──────────────────────────────────────────────────┤ │
│ │                                                   │ │
│ │ ⚠️ Sarah heeft taken in deze periode:            │ │
│ │                                                   │ │
│ │ - Selmore_12345601: Concept (2 dagen)           │ │
│ │ - Nike_11223344: Review meeting (21 feb)        │ │
│ │                                                   │ │
│ └──────────────────────────────────────────────────┘ │
│                                                        │
│ [Annuleren] [Verlof aanvragen] ────────────────────────►│
└────────────────────────────────────────────────────────┘
```

---

### STAP 2: Ellen Detecteert Conflict & Analyseert

**Ellen krijgt:**
- Verlof aanvraag
- Sarah's taken in die periode

**Ellen analyseert:**

```
1. CONFLICTERENDE TAKEN
   Sarah heeft 2 taken:
   - Selmore_12345601 Concept: 20-21 feb (2 dagen)
   - Nike_11223344 Review meeting: 21 feb 14:00

2. BACKUP PERSOON
   Gekozen: Lisa
   Check Lisa's beschikbaarheid:
   - Lisa heeft 10 uur beschikbaar week 8
   - Lisa heeft skills voor Concept werk
   ✓ Lisa kan Sarah's taken overnemen

3. ALTERNATIEVEN
   Optie A: Lisa neemt over (zoals gekozen)
   Optie B: Verschuif Concept naar week 9
   Optie C: Andere persoon (Mark/Peter)

4. IMPACT
   - Selmore planning blijft op schema
   - Lisa krijgt extra werk (2 dagen)
   - Nike meeting moet iemand anders doen
```

**Ellen's voorstel:**

```
┌────────────────────────────────────────────────────────┐
│ 💬 ELLEN - VERLOF CONFLICT ANALYSE                     │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Sarah heeft verlof 20-24 feb.                         │
│                                                        │
│ CONFLICTEN:                                            │
│ - Selmore Concept (20-21 feb, 2 dagen)               │
│ - Nike Review meeting (21 feb, 14:00)                │
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ VOORSTEL: LISA NEEMT OVER                         │ │
│ ├──────────────────────────────────────────────────┤ │
│ │                                                   │ │
│ │ Lisa is beschikbaar en heeft de juiste skills    │ │
│ │                                                   │ │
│ │ Wijzigingen:                                      │
│ │ - Selmore Concept: Sarah → Lisa                  │ │
│ │ - Nike meeting: Sarah → Mark (als backup)        │ │
│ │                                                   │ │
│ │ ✓ Geen impact op deadlines                       │ │
│ │ ✓ Lisa heeft voldoende capaciteit                │ │
│ │                                                   │ │
│ │ [Accepteer dit voorstel] ─────────────────────────►│ │
│ └──────────────────────────────────────────────────┘ │
│                                                        │
│ [Andere oplossing] [Annuleer verlof]                  │
└────────────────────────────────────────────────────────┘
```

---

### STAP 3: Planner Bevestigt

Planner klikt: "Accepteer dit voorstel"

**System:**
1. Insert verlof record
2. Update betrokken taken:
   - Selmore Concept: werknemer Sarah → Lisa
   - Nike meeting: deelnemer Sarah → Mark
3. Verstuur notificaties:
   - Lisa: "Je neemt taken over van Sarah (verlof)"
   - Mark: "Je vervangt Sarah bij Nike meeting"
   - Sarah: "Je verlof is goedgekeurd, taken overgedragen"
4. Log in audit trail

---

## SAMENVATTING WORKFLOWS

| Workflow | Ellen Betrokken? | Automation | Template |
|----------|------------------|------------|----------|
| **Nieuw Project** | ✅ Ja - Legt puzzel | Workflows halen data | NieuwProject |
| **Wijziging** | ✅ Ja - Analyseert impact | Workflows halen data | Wijziging |
| **Ad-hoc Meeting** | ❌ Nee - Direct insert | Conflict check only | Meeting (Quick) |
| **Team Update** | ❌ Nee - Handmatig | Geen | Handmatig |
| **Verlof (preventief)** | ✅ Ja - Checkt bij planning | Workflows halen verlof | (deel van NieuwProject) |
| **Verlof (reactief)** | ✅ Ja - Detecteert conflict | Workflows halen taken | Verlof |

---

## Belangrijke Details

### Kleuren in Planner

```
CONCEPT (doorzichtig):
- opacity: 0.4
- border: dashed
- Label: "CONCEPT"

VAST (vol):
- opacity: 1.0
- border: solid
- Label: "VAST"
```

### Notificaties

**Wanneer versturen:**
- Planning wordt VAST: Notificeer betrokken team
- Wijziging doorgevoerd: Notificeer betrokkenen
- Verlof goedgekeurd: Notificeer medewerker + backup
- Meeting toegevoegd: Notificeer deelnemers

**Via:**
- In-app notificatie (tabel: notificaties)
- Email (optioneel, later)

### Audit Trail

**Log altijd:**
- Wie heeft actie gedaan
- Wat is er veranderd (voor/na)
- Wanneer
- Reden (indien opgegeven)

**Tabel:** `audit_log`
