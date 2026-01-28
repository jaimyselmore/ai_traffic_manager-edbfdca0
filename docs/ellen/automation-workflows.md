# Automation Workflows (Zonder Ellen)

Dit document beschrijft alle automation workflows die ZONDER Ellen draaien - pure automation zonder AI.

## Inhoudsopgave

1. [Pre-Ellen Data Fetching Workflows](#1-pre-ellen-data-fetching-workflows)
2. [Quick Add Meeting Workflow](#2-quick-add-meeting-workflow)
3. [Status Update Workflows](#3-status-update-workflows)
4. [Notification Workflows](#4-notification-workflows)
5. [Data Sync Workflows](#5-data-sync-workflows)

---

## 1. Pre-Ellen Data Fetching Workflows

Deze workflows draaien VOOR Ellen wordt getriggered, om alle benodigde context te verzamelen.

### Workflow: Fetch Context Data

**Trigger:** Template submit (NieuwProject, Wijziging, Meeting, Verlof)

**Doel:** Verzamel alle data die Ellen nodig heeft voor analyse

**Duration:** ~2-5 seconden

**Implementation:**

```typescript
// File: /src/lib/services/ellenDataFetcher.ts

export async function fetchEllenContext(
  templateType: 'nieuw_project' | 'wijziging' | 'meeting' | 'verlof',
  templateData: any
): Promise<EllenContextData> {

  // Extract relevant IDs from template
  const teamMemberIds = extractTeamMemberIds(templateData);
  const klantId = templateData.klantId || templateData.projectHeader?.klantId;
  const projectId = templateData.projectId;

  // Parallel data fetching (Promise.all for speed)
  const [
    outlookData,
    verlofData,
    beschikbaarheidData,
    klantConstraints,
    workloadData,
    projectDetails
  ] = await Promise.all([
    fetchOutlookCalendars(teamMemberIds),
    fetchVerlofData(teamMemberIds),
    fetchBeschikbaarheid(teamMemberIds),
    fetchKlantConstraints(klantId),
    fetchCurrentWorkload(teamMemberIds),
    projectId ? fetchProjectDetails(projectId) : null
  ]);

  return {
    template: templateData,
    templateType,
    calendars: outlookData,
    verlof: verlofData,
    availability: beschikbaarheidData,
    klantConstraints,
    workload: workloadData,
    projectDetails
  };
}
```

---

### 1.1 Fetch Outlook Calendars

**Purpose:** Haal Outlook agenda's op van betrokken teamleden

**API:** Microsoft Graph API

**Implementation:**

```typescript
async function fetchOutlookCalendars(
  employeeIds: string[]
): Promise<OutlookCalendarData[]> {

  const results = await Promise.all(
    employeeIds.map(async (employeeId) => {
      // Get employee email from database
      const { data: employee } = await supabase
        .from('medewerkers')
        .select('email, naam')
        .eq('id', employeeId)
        .single();

      if (!employee?.email) {
        return { employeeId, email: null, events: [] };
      }

      // Fetch calendar events for next 3 months
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3);

      try {
        const events = await graphClient
          .api(`/users/${employee.email}/calendar/events`)
          .filter(`start/dateTime ge '${startDate.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`)
          .select('subject,start,end,isAllDay,showAs')
          .get();

        return {
          employeeId,
          employeeName: employee.naam,
          email: employee.email,
          events: events.value.map((event: any) => ({
            subject: event.subject,
            start: event.start.dateTime,
            end: event.end.dateTime,
            isAllDay: event.isAllDay,
            status: event.showAs // 'busy', 'free', 'tentative', 'outOfOffice'
          }))
        };
      } catch (error) {
        console.error(`Failed to fetch calendar for ${employee.email}:`, error);
        return {
          employeeId,
          employeeName: employee.naam,
          email: employee.email,
          events: [],
          error: error.message
        };
      }
    })
  );

  return results;
}
```

**Output Format:**

```typescript
interface OutlookCalendarData {
  employeeId: string;
  employeeName: string;
  email: string;
  events: Array<{
    subject: string;
    start: string; // ISO datetime
    end: string;
    isAllDay: boolean;
    status: 'busy' | 'free' | 'tentative' | 'outOfOffice';
  }>;
  error?: string;
}
```

---

### 1.2 Fetch Verlof Data

**Purpose:** Haal verlof aanvragen op van teamleden

**Implementation:**

```typescript
async function fetchVerlofData(
  employeeIds: string[]
): Promise<VerlofData[]> {

  const { data: verlofAanvragen, error } = await supabase
    .from('verlof_aanvragen')
    .select(`
      id,
      werknemer_id,
      start_datum,
      eind_datum,
      verlof_type,
      status,
      medewerkers (
        naam,
        discipline
      )
    `)
    .in('werknemer_id', employeeIds)
    .gte('eind_datum', new Date().toISOString()) // Alleen toekomstig verlof
    .eq('status', 'approved'); // Alleen goedgekeurd verlof

  if (error) throw error;

  return verlofAanvragen.map(v => ({
    employeeId: v.werknemer_id,
    employeeName: v.medewerkers.naam,
    discipline: v.medewerkers.discipline,
    startDatum: v.start_datum,
    eindDatum: v.eind_datum,
    verlofType: v.verlof_type,
    aantalWerkdagen: calculateWorkdays(v.start_datum, v.eind_datum)
  }));
}
```

**Output Format:**

```typescript
interface VerlofData {
  employeeId: string;
  employeeName: string;
  discipline: string;
  startDatum: string; // ISO date
  eindDatum: string;
  verlofType: string;
  aantalWerkdagen: number;
}
```

---

### 1.3 Fetch Beschikbaarheid (Werkuren)

**Purpose:** Haal werkuren en contracturen op

**Implementation:**

```typescript
async function fetchBeschikbaarheid(
  employeeIds: string[]
): Promise<BeschikbaarheidData[]> {

  const { data: medewerkers, error } = await supabase
    .from('medewerkers')
    .select('id, naam, werkuren_per_week, contract_type, discipline')
    .in('id', employeeIds);

  if (error) throw error;

  return medewerkers.map(m => ({
    employeeId: m.id,
    employeeName: m.naam,
    discipline: m.discipline,
    werkurenPerWeek: m.werkuren_per_week || 40,
    contractType: m.contract_type, // 'fulltime', 'parttime', 'freelance'
    beschikbareDagen: calculateAvailableDays(m.werkuren_per_week)
  }));
}

function calculateAvailableDays(werkurenPerWeek: number): number[] {
  // Als 40 uur → [0, 1, 2, 3, 4] (ma-vr)
  // Als 32 uur → [0, 1, 2, 3] (ma-do)
  // Als 24 uur → [0, 1, 2] (ma-wo)
  const dagenPerWeek = Math.floor(werkurenPerWeek / 8);
  return Array.from({ length: dagenPerWeek }, (_, i) => i);
}
```

**Output Format:**

```typescript
interface BeschikbaarheidData {
  employeeId: string;
  employeeName: string;
  discipline: string;
  werkurenPerWeek: number;
  contractType: 'fulltime' | 'parttime' | 'freelance';
  beschikbareDagen: number[]; // 0 = maandag, 4 = vrijdag
}
```

---

### 1.4 Fetch Klant Constraints

**Purpose:** Haal klant beschikbaarheid en constraints op

**Implementation:**

```typescript
async function fetchKlantConstraints(
  klantId: string
): Promise<KlantConstraintsData | null> {

  if (!klantId) return null;

  const { data: klant, error } = await supabase
    .from('klanten')
    .select('id, naam, klantnummer, beschikbaarheid')
    .eq('id', klantId)
    .single();

  if (error) throw error;

  // Parse beschikbaarheid JSON
  const beschikbaarheid = klant.beschikbaarheid || {
    maandag: true,
    dinsdag: true,
    woensdag: true,
    donderdag: true,
    vrijdag: true,
    blokkades: []
  };

  return {
    klantId: klant.id,
    klantNaam: klant.naam,
    klantnummer: klant.klantnummer,
    beschikbaarheid: {
      ...beschikbaarheid,
      beschikbareDagen: Object.entries(beschikbaarheid)
        .filter(([key, value]) =>
          ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag'].includes(key) && value
        )
        .map(([key]) => key)
    }
  };
}
```

**Output Format:**

```typescript
interface KlantConstraintsData {
  klantId: string;
  klantNaam: string;
  klantnummer: string;
  beschikbaarheid: {
    maandag: boolean;
    dinsdag: boolean;
    woensdag: boolean;
    donderdag: boolean;
    vrijdag: boolean;
    blokkades?: Array<{
      startDatum: string;
      eindDatum: string;
      reden: string;
    }>;
    beschikbareDagen: string[]; // ['maandag', 'dinsdag', ...]
  };
}
```

---

### 1.5 Fetch Current Workload

**Purpose:** Haal huidige planning en workload op van teamleden

**Implementation:**

```typescript
async function fetchCurrentWorkload(
  employeeIds: string[]
): Promise<WorkloadData[]> {

  // Get date range (nu tot 3 maanden vooruit)
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 3);

  const { data: taken, error } = await supabase
    .from('taken')
    .select(`
      id,
      werknemer_id,
      werknemer_naam,
      project_titel,
      fase_naam,
      week_start,
      duur_uren,
      plan_status,
      projecten (
        deadline,
        status
      )
    `)
    .in('werknemer_id', employeeIds)
    .gte('week_start', startDate.toISOString().split('T')[0])
    .lte('week_start', endDate.toISOString().split('T')[0])
    .in('plan_status', ['concept', 'vast']);

  if (error) throw error;

  // Group by employee and calculate totals per week
  const workloadByEmployee = employeeIds.map(employeeId => {
    const employeeTaken = taken.filter(t => t.werknemer_id === employeeId);

    // Group by week
    const weeklyWorkload = new Map<string, number>();
    employeeTaken.forEach(taak => {
      const week = taak.week_start;
      const current = weeklyWorkload.get(week) || 0;
      weeklyWorkload.set(week, current + taak.duur_uren);
    });

    // Calculate total hours planned
    const totalHoursPlanned = employeeTaken.reduce((sum, t) => sum + t.duur_uren, 0);

    return {
      employeeId,
      employeeName: employeeTaken[0]?.werknemer_naam || '',
      totalHoursPlanned,
      projectCount: new Set(employeeTaken.map(t => t.project_titel)).size,
      weeklyBreakdown: Array.from(weeklyWorkload.entries()).map(([week, hours]) => ({
        week,
        hours,
        utilization: (hours / 40) * 100 // Percentage van 40-urige werkweek
      })),
      tasks: employeeTaken.map(t => ({
        projectTitel: t.project_titel,
        faseNaam: t.fase_naam,
        weekStart: t.week_start,
        duurUren: t.duur_uren,
        planStatus: t.plan_status,
        projectDeadline: t.projecten?.deadline
      }))
    };
  });

  return workloadByEmployee;
}
```

**Output Format:**

```typescript
interface WorkloadData {
  employeeId: string;
  employeeName: string;
  totalHoursPlanned: number;
  projectCount: number;
  weeklyBreakdown: Array<{
    week: string; // ISO date (monday of week)
    hours: number;
    utilization: number; // percentage
  }>;
  tasks: Array<{
    projectTitel: string;
    faseNaam: string;
    weekStart: string;
    duurUren: number;
    planStatus: 'concept' | 'vast';
    projectDeadline?: string;
  }>;
}
```

---

## 2. Quick Add Meeting Workflow

**Scenario:** Planner wil snel een meeting toevoegen zonder Ellen

**Wanneer gebruiken:**
- Planning staat al VAST
- Simpele meeting, datum/tijd al bekend
- Snelheid belangrijker dan optimalisatie

**Flow:**

```
User vult Meeting template in (Quick Add mode)
        ↓
Frontend validatie
        ↓
Check conflict (automation)
        ↓
Insert in database
        ↓
Done
```

### Implementation:

```typescript
// File: /src/lib/services/quickAddMeeting.ts

export async function quickAddMeeting(
  meetingData: MeetingData
): Promise<QuickAddResult> {

  // 1. Validate input
  const validationErrors = validateMeetingData(meetingData);
  if (validationErrors.length > 0) {
    return {
      success: false,
      errors: validationErrors
    };
  }

  // 2. Check for conflicts
  const conflicts = await checkMeetingConflicts({
    deelnemers: meetingData.deelnemers,
    datum: meetingData.datum,
    startTijd: meetingData.startTijd,
    duurMinuten: meetingData.duur + (meetingData.reistijd ? meetingData.reistijd * 2 : 0)
  });

  if (conflicts.length > 0) {
    return {
      success: false,
      conflicts,
      suggestion: 'Kies een ander tijdstip of vraag Ellen voor suggesties'
    };
  }

  // 3. Create meeting record
  const { data: meeting, error: meetingError } = await supabase
    .from('meetings_en_presentaties')
    .insert({
      project_id: meetingData.projectId,
      onderwerp: meetingData.onderwerp,
      meeting_type: meetingData.meetingType,
      datum: meetingData.datum,
      start_tijd: meetingData.startTijd,
      eind_tijd: calculateEndTime(meetingData.startTijd, meetingData.duur),
      locatie: meetingData.locatie,
      deelnemers: meetingData.deelnemers,
      created_by: getCurrentUserId()
    })
    .select()
    .single();

  if (meetingError) {
    return {
      success: false,
      errors: [meetingError.message]
    };
  }

  // 4. Create planning blocks for deelnemers
  const blocks = await createMeetingBlocks({
    meetingId: meeting.id,
    projectId: meetingData.projectId,
    projectTitel: meetingData.projectTitel,
    deelnemers: meetingData.deelnemers,
    datum: meetingData.datum,
    startTijd: meetingData.startTijd,
    duurMinuten: meetingData.duur,
    reistijdMinuten: meetingData.reistijd,
    locatie: meetingData.locatie
  });

  // 5. Send notifications (optional)
  if (meetingData.sendNotifications !== false) {
    await sendMeetingNotifications({
      meetingId: meeting.id,
      deelnemers: meetingData.deelnemers,
      onderwerp: meetingData.onderwerp,
      datum: meetingData.datum,
      startTijd: meetingData.startTijd
    });
  }

  return {
    success: true,
    meetingId: meeting.id,
    blocksCreated: blocks.length,
    message: `Meeting "${meetingData.onderwerp}" succesvol aangemaakt`
  };
}
```

### Check Meeting Conflicts:

```typescript
async function checkMeetingConflicts(params: {
  deelnemers: string[];
  datum: string;
  startTijd: string;
  duurMinuten: number;
}): Promise<ConflictInfo[]> {

  const { deelnemers, datum, startTijd, duurMinuten } = params;

  // Calculate time range
  const startDateTime = new Date(`${datum}T${startTijd}`);
  const endDateTime = new Date(startDateTime.getTime() + duurMinuten * 60000);

  // Check taken tabel for overlapping blocks
  const { data: overlappingTaken, error } = await supabase
    .from('taken')
    .select(`
      id,
      werknemer_id,
      werknemer_naam,
      project_titel,
      fase_naam,
      datum,
      start_uur,
      duur_uren
    `)
    .in('werknemer_id', deelnemers)
    .eq('datum', datum);

  if (error) throw error;

  // Find actual conflicts
  const conflicts = overlappingTaken.filter(taak => {
    const taakStart = new Date(`${taak.datum}T${String(taak.start_uur).padStart(2, '0')}:00`);
    const taakEnd = new Date(taakStart.getTime() + taak.duur_uren * 3600000);

    // Check if time ranges overlap
    return (
      (startDateTime >= taakStart && startDateTime < taakEnd) ||
      (endDateTime > taakStart && endDateTime <= taakEnd) ||
      (startDateTime <= taakStart && endDateTime >= taakEnd)
    );
  });

  return conflicts.map(c => ({
    employeeId: c.werknemer_id,
    employeeName: c.werknemer_naam,
    conflictingTask: {
      projectTitel: c.project_titel,
      faseNaam: c.fase_naam,
      startTijd: `${c.start_uur}:00`,
      duurUren: c.duur_uren
    }
  }));
}
```

### Create Meeting Blocks:

```typescript
async function createMeetingBlocks(params: {
  meetingId: string;
  projectId: string;
  projectTitel: string;
  deelnemers: string[];
  datum: string;
  startTijd: string;
  duurMinuten: number;
  reistijdMinuten?: number;
  locatie: string;
}): Promise<PlanningBlock[]> {

  const blocks: PlanningBlock[] = [];
  const { datum, startTijd, duurMinuten, reistijdMinuten, locatie } = params;

  // Voor elke deelnemer: create planning block(s)
  for (const medewerkerId of params.deelnemers) {
    // Get medewerker naam
    const { data: medewerker } = await supabase
      .from('medewerkers')
      .select('naam')
      .eq('id', medewerkerId)
      .single();

    // Als bij klant: ook reistijd blokken maken
    if (locatie === 'Bij klant' && reistijdMinuten) {
      // REISTIJD HEEN
      const reisHeenStart = calculateTimeBeforeMeeting(startTijd, reistijdMinuten);
      const reisHeenBlock = await createPlanningBlock({
        werknemerId: medewerkerId,
        werknemer Naam: medewerker.naam,
        projectId: params.projectId,
        projectTitel: params.projectTitel,
        faseNaam: 'Reistijd',
        datum,
        startUur: parseFloat(reisHeenStart.replace(':', '.')),
        duurUren: reistijdMinuten / 60,
        planStatus: 'vast',
        type: 'reistijd',
        meetingId: params.meetingId
      });
      blocks.push(reisHeenBlock);
    }

    // MEETING ZELF
    const meetingBlock = await createPlanningBlock({
      werknemerId: medewerkerId,
      werknemer Naam: medewerker.naam,
      projectId: params.projectId,
      projectTitel: params.projectTitel,
      faseNaam: 'Meeting',
      datum,
      startUur: parseFloat(startTijd.replace(':', '.')),
      duurUren: duurMinuten / 60,
      planStatus: 'vast',
      type: 'meeting',
      meetingId: params.meetingId
    });
    blocks.push(meetingBlock);

    // REISTIJD TERUG
    if (locatie === 'Bij klant' && reistijdMinuten) {
      const reisTerugStart = calculateTimeAfterMeeting(startTijd, duurMinuten);
      const reisTerugBlock = await createPlanningBlock({
        werknemerId: medewerkerId,
        werknemer Naam: medewerker.naam,
        projectId: params.projectId,
        projectTitel: params.projectTitel,
        faseNaam: 'Reistijd',
        datum,
        startUur: parseFloat(reisTerugStart.replace(':', '.')),
        duurUren: reistijdMinuten / 60,
        planStatus: 'vast',
        type: 'reistijd',
        meetingId: params.meetingId
      });
      blocks.push(reisTerugBlock);
    }
  }

  // Bulk insert in database
  const { data: insertedBlocks, error } = await supabase
    .from('taken')
    .insert(blocks.map(b => ({
      werknemer_id: b.werknemerId,
      werknemer_naam: b.werknemer Naam,
      project_id: b.projectId,
      project_titel: b.projectTitel,
      fase_naam: b.faseNaam,
      datum: b.datum,
      week_start: getMonday(b.datum),
      dag_van_week: getDayOfWeek(b.datum),
      start_uur: b.startUur,
      duur_uren: b.duurUren,
      plan_status: b.planStatus,
      type: b.type,
      meeting_id: b.meetingId,
      created_by: getCurrentUserId()
    })))
    .select();

  if (error) throw error;

  return insertedBlocks;
}
```

---

## 3. Status Update Workflows

### 3.1 CONCEPT → VAST

**Trigger:** Planner klikt "Planning Vast" button

**Conditions:**
- Planning moet status 'concept' hebben
- Klant moet akkoord hebben gegeven (buiten systeem)

**Implementation:**

```typescript
async function setPlanningVast(projectId: string): Promise<void> {
  // 1. Update project status
  await supabase
    .from('projecten')
    .update({ status: 'vast' })
    .eq('id', projectId);

  // 2. Update alle taken status
  await supabase
    .from('taken')
    .update({ plan_status: 'vast' })
    .eq('project_id', projectId)
    .eq('plan_status', 'concept');

  // 3. Send notifications to team
  await sendTeamNotifications({
    projectId,
    message: 'Planning is definitief geworden'
  });

  // 4. Update planner UI (volle kleuren)
  // Frontend reactivity handles this automatically
}
```

---

### 3.2 Auto-Archive Completed Projects

**Trigger:** Cron job (dagelijks)

**Logic:** Als deadline is gepasseerd EN alle taken zijn afgerond → archiveer

**Implementation:**

```typescript
// Supabase Edge Function: /functions/auto-archive-projects/index.ts

export async function autoArchiveProjects() {
  const today = new Date().toISOString().split('T')[0];

  // Find projects that should be archived
  const { data: completedProjects } = await supabase
    .from('projecten')
    .select('id, project_titel')
    .eq('status', 'vast')
    .lt('deadline', today);

  for (const project of completedProjects) {
    // Check if all tasks are completed
    const { data: openTasks } = await supabase
      .from('taken')
      .select('id')
      .eq('project_id', project.id)
      .neq('status', 'afgerond');

    if (openTasks.length === 0) {
      // All tasks done, archive project
      await supabase
        .from('projecten')
        .update({ status: 'afgerond' })
        .eq('id', project.id);

      console.log(`✓ Archived project: ${project.project_titel}`);
    }
  }
}
```

---

## 4. Notification Workflows

### 4.1 Upcoming Meeting Reminders

**Trigger:** Cron job (elke ochtend 09:00)

**Logic:** Stuur reminder voor meetings vandaag

**Implementation:**

```typescript
export async function sendDailyMeetingReminders() {
  const today = new Date().toISOString().split('T')[0];

  const { data: todaysMeetings } = await supabase
    .from('meetings_en_presentaties')
    .select(`
      id,
      onderwerp,
      start_tijd,
      locatie,
      deelnemers
    `)
    .eq('datum', today);

  for (const meeting of todaysMeetings) {
    await sendNotification({
      recipients: meeting.deelnemers,
      title: `Meeting vandaag: ${meeting.onderwerp}`,
      message: `${meeting.start_tijd} - ${meeting.locatie}`,
      type: 'meeting_reminder'
    });
  }
}
```

---

### 4.2 Deadline Warnings

**Trigger:** Cron job (dagelijks)

**Logic:** Waarschuw als project binnen 3 dagen deadline heeft

**Implementation:**

```typescript
export async function sendDeadlineWarnings() {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const { data: urgentProjects } = await supabase
    .from('projecten')
    .select(`
      id,
      project_titel,
      deadline,
      klant_id,
      klanten (naam)
    `)
    .eq('status', 'vast')
    .lte('deadline', threeDaysFromNow.toISOString().split('T')[0]);

  for (const project of urgentProjects) {
    // Get project team
    const { data: teamMembers } = await supabase
      .from('project_fases')
      .select('medewerkers')
      .eq('project_id', project.id);

    const allMembers = [...new Set(teamMembers.flatMap(f => f.medewerkers))];

    await sendNotification({
      recipients: allMembers,
      title: `⚠️ Deadline nadert: ${project.project_titel}`,
      message: `Deadline: ${project.deadline} (${project.klanten.naam})`,
      type: 'deadline_warning',
      priority: 'high'
    });
  }
}
```

---

## 5. Data Sync Workflows

### 5.1 Sync Outlook Calendar (Bidirectional)

**Trigger:** Cron job (elk uur) OF real-time webhook

**Logic:**
- Planning block aangemaakt → Maak Outlook event
- Outlook event gewijzigd → Update planning block (indien van ons)

**Implementation:**

```typescript
// Direction 1: Planning → Outlook
export async function syncPlanningToOutlook(taakId: string) {
  const { data: taak } = await supabase
    .from('taken')
    .select(`
      *,
      medewerkers (email)
    `)
    .eq('id', taakId)
    .single();

  if (!taak.medewerkers?.email) return;

  // Create Outlook event
  const event = await graphClient
    .api(`/users/${taak.medewerkers.email}/calendar/events`)
    .post({
      subject: `${taak.project_titel} - ${taak.fase_naam}`,
      start: {
        dateTime: `${taak.datum}T${String(taak.start_uur).padStart(2, '0')}:00`,
        timeZone: 'Europe/Amsterdam'
      },
      end: {
        dateTime: calculateEndTime(taak.datum, taak.start_uur, taak.duur_uren),
        timeZone: 'Europe/Amsterdam'
      },
      showAs: 'busy',
      categories: ['AI Traffic Manager'],
      body: {
        content: `Project: ${taak.project_titel}\nFase: ${taak.fase_naam}`,
        contentType: 'text'
      }
    });

  // Save Outlook event ID for future sync
  await supabase
    .from('taken')
    .update({ outlook_event_id: event.id })
    .eq('id', taakId);
}

// Direction 2: Outlook → Planning (via webhook)
export async function handleOutlookWebhook(notification: any) {
  // Outlook sends webhook when event changes
  // Check if event is one of ours (has category 'AI Traffic Manager')
  // If yes, update corresponding taak in database
  // Implementation depends on Microsoft Graph webhook setup
}
```

---

### 5.2 Verlof Expiry Check

**Trigger:** Cron job (dagelijks)

**Logic:** Verwijder verlof dat in het verleden ligt

**Implementation:**

```typescript
export async function cleanupExpiredVerlof() {
  const today = new Date().toISOString().split('T')[0];

  const { data: expiredVerlof } = await supabase
    .from('verlof_aanvragen')
    .select('id')
    .lt('eind_datum', today)
    .eq('status', 'approved');

  // Update status to 'completed' instead of deleting (voor archief)
  await supabase
    .from('verlof_aanvragen')
    .update({ status: 'completed' })
    .in('id', expiredVerlof.map(v => v.id));

  console.log(`✓ Cleaned up ${expiredVerlof.length} expired verlof records`);
}
```

---

## Summary: Automation vs Ellen

### Pure Automation (NO Ellen):
- ✅ Quick Add Meeting (conflict check + insert)
- ✅ Status updates (CONCEPT → VAST)
- ✅ Notifications (reminders, warnings)
- ✅ Data sync (Outlook calendar)
- ✅ Cleanup jobs (expired verlof, etc.)
- ✅ Pre-Ellen data fetching

### Ellen (AI Agent):
- 🤖 Nieuw Project planning (puzzle leggen)
- 🤖 Wijzigingen analyseren (impact berekenen)
- 🤖 Verlof conflict resolution (herverdeling)
- 🤖 Meeting suggesties (optimale tijden vinden)
- 🤖 Capacity analysis (overbelasting detecteren)

### Hybrid (Automation + Ellen):
- Meeting: Quick Add (automation) OF Vraag Ellen (AI)
- Project: Automation fetches data → Ellen analyzes → Automation executes

---

**Last Updated**: 2024-01-28
**Version**: 1.0
**Status**: Ready for implementation
