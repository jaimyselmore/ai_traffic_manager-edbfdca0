# Wizard of Oz Test Scenarios

Dit document bevat test scenarios voor Ellen's Wizard of Oz testing. Een mens (operator) speelt Ellen's rol om workflows te testen voordat de echte AI gebouwd wordt.

## Wat is Wizard of Oz Testing?

Een "operator" achter de schermen speelt Ellen's rol:
- Operator ziet template data + context
- Operator schrijft responses volgens Ellen's logica
- Gebruiker ziet "Ellen's" antwoord
- Test of workflows logisch zijn, templates complete data geven, en edge cases ontdekken

## Test Setup

### Technische Requirements:

1. **Mock Ellen Interface**
   - Hergebruik EllenChat.tsx component
   - Backend endpoint stuurt berichten door naar operator dashboard
   - Operator dashboard waar operator responses kan typen

2. **Data Logging**
   - Log alle template input
   - Log alle context data (workflows)
   - Log operator responses
   - Log user confirmations/rejections

3. **Operator Dashboard**
   ```
   ┌──────────────────────────────────────────────────────────┐
   │ ELLEN OPERATOR DASHBOARD                                  │
   ├──────────────────────────────────────────────────────────┤
   │                                                           │
   │ ■ NIEUWE AANVRAAG: NieuwProject                          │
   │                                                           │
   │ Template Data:                                           │
   │   Klant: Selmore (123456)                                │
   │   Project: Video campagne                                │
   │   Deadline: 2024-03-01                                   │
   │   Fases:                                                 │
   │     - Concept: Sarah (3 dagen)                           │
   │     - Productie: Mark (5 dagen)                          │
   │     - Edit: Lisa (2 dagen)                               │
   │                                                           │
   │ Context Data:                                            │
   │   Sarah verlof: 2024-02-20 t/m 2024-02-24               │
   │   Mark workload: 28/40 uur week 8                        │
   │   Klant beschikbaar: ma, di, do, vr (NIET wo)           │
   │                                                           │
   │ ─────────────────────────────────────────────────────── │
   │                                                           │
   │ Ellen Response:                                          │
   │ ┌─────────────────────────────────────────────────────┐  │
   │ │ [Operator types Ellen's response here...]           │  │
   │ │                                                      │  │
   │ └─────────────────────────────────────────────────────┘  │
   │                                                           │
   │ Response Templates: [Load Template ▼]                    │
   │   - Happy Path: Planning mogelijk                        │
   │   - Conflict: Overbelasting                              │
   │   - Error: Onvoldoende data                              │
   │                                                           │
   │               [Verstuur naar gebruiker]                   │
   └──────────────────────────────────────────────────────────┘
   ```

---

## Test Scenarios

### Scenario 1: Nieuw Project - Happy Path

**Goal:** Test of Ellen correct plant wanneer alles mogelijk is

**Setup:**
- Klant: Selmore
- Project: Video campagne
- Deadline: 2024-03-15 (4 weken vanaf nu)
- Fases:
  - Concept: Sarah, 3 dagen
  - Productie: Mark, 5 dagen
  - Edit: Lisa, 2 dagen
- Geen verlof, geen conflicten
- Team heeft capaciteit

**Template Input:**
```json
{
  "projectHeader": {
    "klantId": "uuid-selmore",
    "klantNaam": "Selmore",
    "projectTitel": "Selmore_12345601",
    "projectomschrijving": "Video campagne Q1",
    "deadline": "2024-03-15"
  },
  "projecttype": "Video productie",
  "fases": [
    { "naam": "Concept", "medewerkers": ["uuid-sarah"], "inspanningDagen": 3 },
    { "naam": "Productie", "medewerkers": ["uuid-mark"], "inspanningDagen": 5 },
    { "naam": "Edit", "medewerkers": ["uuid-lisa"], "inspanningDagen": 2 }
  ]
}
```

**Context Data:**
```json
{
  "calendars": [
    { "employee": "Sarah", "events": [] },
    { "employee": "Mark", "events": [] },
    { "employee": "Lisa", "events": [] }
  ],
  "verlof": [],
  "workload": [
    { "employee": "Sarah", "weeklyHours": 20 },
    { "employee": "Mark", "weeklyHours": 25 },
    { "employee": "Lisa", "weeklyHours": 15 }
  ],
  "klantConstraints": {
    "beschikbaar": ["maandag", "dinsdag", "donderdag", "vrijdag"]
  }
}
```

**Expected Operator Response (Ellen):**

```markdown
Ik heb een planning gemaakt voor project **Selmore_12345601**.

## 📋 VOORSTEL 1: Optimaal

**Timeline:**
- **Week 5 (feb 5-9):** Concept fase (Sarah, 3 dagen)
- **Week 6 (feb 12-16):** Productie fase (Mark, 5 dagen)
- **Week 7 (feb 19-23):** Edit fase (Lisa, 2 dagen)

**Presentaties:**
- **P1: Concept presentatie** - donderdag 8 feb, 14:00
- **P2: Productie review** - dinsdag 13 feb, 10:00
- **P3: Finale presentatie** - vrijdag 23 feb, 11:00

**Analyse:**
✅ Binnen deadline (23 feb vs 15 mrt)
✅ Team heeft capaciteit
✅ Presentaties op klant-beschikbare dagen (geen woensdag)
✅ Logische volgorde: concept → productie → edit
✅ Voldoende feedbacktijd tussen presentaties (1 week)

**Risico's:**
⚠️ Geen risico's gedetecteerd

---

## 📋 VOORSTEL 2: Conservatief (meer marge)

**Timeline:**
- **Week 6:** Concept (Sarah, 3 dagen)
- **Week 7-8:** Productie (Mark, 5 dagen)
- **Week 9:** Edit (Lisa, 2 dagen)

**Voordeel:** Meer buffertijd tussen fases
**Nadeel:** Later opgeleverd (1 mrt vs 23 feb)

---

Welke planning wil je gebruiken?
```

**Test Validatie:**
- [ ] Operator kon response maken met beschikbare data
- [ ] Planning is logisch (volgorde klopt)
- [ ] Deadline wordt gerespecteerd
- [ ] Klant constraints worden gerespecteerd
- [ ] User begrijpt de voorstellen
- [ ] User kan kiezen en bevestigen

---

### Scenario 2: Nieuw Project - Verlof Conflict

**Goal:** Test of Ellen verlof detecteert en alternatief voorstelt

**Setup:**
- Zelfde project als Scenario 1
- **MAAR:** Sarah heeft verlof week 5 (20-24 feb)

**Context Data (aangepast):**
```json
{
  "verlof": [
    {
      "employee": "Sarah",
      "startDatum": "2024-02-20",
      "eindDatum": "2024-02-24",
      "verlofType": "vakantie"
    }
  ]
}
```

**Expected Operator Response:**

```markdown
⚠️ Ik heb een **verlof conflict** gedetecteerd.

**Probleem:**
Sarah heeft verlof van **20-24 feb (week 5)**, maar moet volgens planning in week 5 aan het concept werken.

## 📋 VOORSTEL 1: Sarah in week 6

**Aangepaste timeline:**
- **Week 6 (feb 26 - mrt 1):** Concept fase (Sarah, 3 dagen)
- **Week 7 (mrt 4-8):** Productie fase (Mark, 5 dagen)
- **Week 8 (mrt 11-15):** Edit fase (Lisa, 2 dagen)

**Impact:**
⚠️ Oplevering verschuift van 23 feb naar 15 maart (precies op deadline)
⚠️ Geen marge meer voor vertragingen

---

## 📋 VOORSTEL 2: Vervang Sarah

**Alternative team:**
- **Week 5:** Concept fase (**Emma** vervangt Sarah, 3 dagen)
- **Week 6:** Productie fase (Mark, 5 dagen)
- **Week 7:** Edit fase (Lisa, 2 dagen)

**Voordeel:** Originele timeline behouden
**Risico:** Emma is minder ervaren met deze klant

---

Wat wil je doen?
```

**Test Validatie:**
- [ ] Verlof conflict wordt gedetecteerd
- [ ] Operator stelt alternatieven voor
- [ ] Impact wordt duidelijk uitgelegd
- [ ] User kan kiezen tussen opties

---

### Scenario 3: Nieuw Project - Onhaalbare Deadline

**Goal:** Test of Ellen waarschuwt bij te strakke deadline

**Setup:**
- Klant: TestBedrijf
- Project: Website redesign
- Deadline: **2024-02-10** (1 week vanaf nu!)
- Fases:
  - Design: Sarah, 5 dagen
  - Development: Mark, 10 dagen
  - Testing: Lisa, 3 dagen
- **Totaal: 18 dagen werk, deadline is over 7 dagen**

**Expected Operator Response:**

```markdown
❌ **Deadline is niet haalbaar**

**Analyse:**
- Gevraagde inspanning: **18 werkdagen**
- Beschikbare tijd tot deadline: **7 kalenderdagen** (5 werkdagen)
- **Tekort: 13 werkdagen**

**Waarom niet haalbaar:**
1. Team werkt sequentieel (design → development → testing)
2. Parallel werken is niet mogelijk (dependencies)
3. Zelfs met fulltime inzet team: minimaal 18 dagen nodig

---

## 💡 VOORSTELLEN:

### Optie 1: Realistische deadline
**Nieuwe deadline: 15 maart** (4 weken vanaf nu)

Planning:
- Week 5-6: Design (Sarah, 5 dagen)
- Week 7-8: Development (Mark, 10 dagen)
- Week 9: Testing (Lisa, 3 dagen)

✅ Haalbaar
✅ Voldoende tijd voor kwaliteit
✅ Geen overbelasting team

---

### Optie 2: Beperkte scope
**Behoud deadline 10 feb, maar reduceer scope:**

Minimum Viable Product:
- Design: 2 dagen (alleen homepage + 1 pagina)
- Development: 4 dagen (basic versie)
- Testing: 1 dag

⚠️ Beperkte functionaliteit
⚠️ Moet later uitgebreid worden

---

### Optie 3: Externe resources
Team uitbreiden met freelancers om parallel te werken.

**Kosten:** Inschatting €5.000-7.000 extra
**Risico:** Nieuwe mensen moeten onboarded worden

---

Wat wil je doen?
```

**Test Validatie:**
- [ ] Deadline feasibility wordt gecheckt
- [ ] Duidelijke waarschuwing bij onhaalbare deadline
- [ ] Concrete alternatieven worden voorgesteld
- [ ] User begrijpt waarom het niet kan

---

### Scenario 4: Wijziging - Persoon Vervangen

**Goal:** Test wijzigingsflow met impact analyse

**Setup:**
- Bestaand project: Selmore_12345601 (uit Scenario 1)
- Status: VAST (planning is goedgekeurd)
- **Wijziging:** Mark (productie) moet vervangen worden
- **Reden:** Mark is ziek geworden

**Template Input:**
```json
{
  "projectId": "uuid-selmore-project",
  "wijzigingsType": "persoon_vervangen",
  "reden": "Mark is ziek geworden, kan productie niet doen",
  "huidigeSituatie": "Mark staat ingepland voor productie week 6, 5 dagen",
  "gewensteSituatie": "Andere videograaf inplannen voor productie",
  "urgentie": "hoog"
}
```

**Expected Operator Response:**

```markdown
⚠️ **Wijzigingsverzoek ontvangen**

**Project:** Selmore_12345601
**Type:** Persoon vervangen
**Urgentie:** Hoog

---

## 📊 IMPACT ANALYSE:

**Huidige planning:**
- Productie fase: **Mark**, week 6 (12-16 feb), 5 dagen
- Presentatie: dinsdag 13 feb, 10:00 (Mark aanwezig)

**Betrokken taken:**
- 5 planning blocks (12, 13, 14, 15, 16 feb)
- 1 client presentatie

---

## 💡 VOORSTELLEN:

### Voorstel 1: Emma vervangt Mark
**Timeline blijft gelijk**

- Productie fase: **Emma**, week 6, 5 dagen
- Presentatie: Emma doet presentatie (of Sarah ondersteunt)

**Check:**
✅ Emma heeft capaciteit week 6 (20/40 uur bezet)
✅ Emma is videograaf (zelfde discipline)
⚠️ Emma heeft nog niet met Selmore gewerkt

**Actie:**
- Mark's 5 blocks vervangen door Emma
- Emma briefen over Selmore
- Mogelijk Sarah bij presentatie (kent klant)

---

### Voorstel 2: Verschuif productie 1 week
**Wacht tot Mark beter is**

- Concept: week 5 (zoals gepland)
- **Productie: week 7** (verschoven, Mark doet het alsnog)
- Edit: week 8 (verschoven)

**Impact:**
⚠️ Oplevering verschuift van 23 feb naar 1 maart
✅ Nog steeds binnen deadline (15 maart)
⚠️ Presentaties moeten verzet worden (klant informeren)

---

### Voorstel 3: Freelance videograaf inhuren
**Externe resource**

**Voordeel:** Timeline blijft gelijk, geen interne disruption
**Nadeel:** Extra kosten (€2.500-3.500 inschatting)

---

Welke optie wil je?
```

**Test Validatie:**
- [ ] Bestaand project wordt correct opgehaald
- [ ] Impact op planning wordt berekend
- [ ] Alternatieve personen worden voorgesteld
- [ ] Urgentie wordt meegewogen in voorstellen

---

### Scenario 5: Meeting - Vraag Ellen

**Goal:** Test meeting scheduling met constraints

**Setup:**
- Project: Selmore_12345601
- Meeting type: Presentatie concept
- Deelnemers: Sarah, Mark, + klant
- Voorkeur: Deze week of volgende week
- **Constraints:**
  - Klant kan NIET op woensdag
  - Sarah heeft dinsdag andere meeting 14:00-15:30
  - Mark heeft vrijdag hele dag shoot

**Template Input:**
```json
{
  "projectId": "uuid-selmore",
  "onderwerp": "Concept presentatie",
  "meetingType": "Presentatie concept",
  "deelnemers": ["uuid-sarah", "uuid-mark"],
  "locatie": "Bij klant",
  "reistijd": 30,
  "voorkeursData": ["2024-02-08", "2024-02-09"]
}
```

**Expected Operator Response:**

```markdown
📅 **Beschikbare tijden voor Concept Presentatie**

Ik heb de agenda's gecheckt van Sarah en Mark, en de klant beschikbaarheid.

---

## ✅ BESCHIKBARE OPTIES:

### Optie 1: Donderdag 8 feb, 10:00-11:00
**Locatie:** Bij klant (Selmore kantoor)
**Reistijd:** 30 min voor + 30 min na

**Deelnemers:**
- ✅ Sarah: beschikbaar
- ✅ Mark: beschikbaar
- ✅ Klant: kan op donderdag

**Tijdlijn:**
- 09:30: Vertrek (reistijd)
- 10:00-11:00: Presentatie
- 11:00-11:30: Terugreis

---

### Optie 2: Maandag 12 feb, 14:00-15:00
**Locatie:** Bij klant

**Voordeel:** Meer voorbereidingstijd (weekend ertussen)
**Deelnemers:** Allemaal beschikbaar

---

### ⚠️ Optie 3: Vrijdag 9 feb, NIET mogelijk
**Reden:** Mark heeft hele dag shoot (andere klant)

---

### ⚠️ Woensdag algemeen NIET mogelijk
**Reden:** Klant beschikbaarheid staat woensdag uit

---

Welke optie past het beste?
```

**Test Validatie:**
- [ ] Beschikbaarheid wordt correct gecheckt
- [ ] Klant constraints worden gerespecteerd
- [ ] Conflicts worden gedetecteerd
- [ ] Reistijd wordt meegenomen in planning
- [ ] Duidelijke opties met rationale

---

### Scenario 6: Verlof - Reactief (Urgent)

**Goal:** Test urgent verlof met directe impact

**Setup:**
- Sarah belt in ziek (urgent verlof)
- **Vandaag:** 12 februari
- Sarah heeft VANDAAG taken:
  - 14:00-17:00: Shoot bij klant X (locatie-gebonden)
- Sarah heeft DEZE WEEK:
  - Woensdag: Edit project Y (2 dagen)
  - Vrijdag: Presentatie project Z

**Template Input:**
```json
{
  "medewerkerId": "uuid-sarah",
  "startDatum": "2024-02-12",
  "eindDatum": "2024-02-12",
  "verlofType": "ziekte",
  "verlofCategorie": "urgent"
}
```

**Expected Operator Response:**

```markdown
🚨 **URGENT: Sarah is ziek**

## ⚠️ TAKEN VANDAAG (12 feb):

### 1. Shoot bij Client X - 14:00-17:00
**Locatie:** Bij klant (niet uitstellen!)

**ACTIE VEREIST NU:**
- ☎️ Bel Emma: Kan zij overnemen? (zelfde discipline)
- 📸 Check backup camera gear beschikbaar is
- 📞 Informeer klant over persoon wijziging

**Als Emma niet kan:**
- Freelance videograaf inhuren (spoed)
- Alternatief: Verzet shoot (klant bellen!)

---

## ⚠️ TAKEN DEZE WEEK:

### 2. Edit Project Y - Woensdag 14 feb (2 dagen)
**Impact:** Medium

**Suggestie:** Verschuif naar volgende week maandag-dinsdag
- Lisa heeft capaciteit volgende week
- Of: Emma kan donderdag-vrijdag (deze week)

---

### 3. Presentatie Project Z - Vrijdag 16 feb, 11:00
**Impact:** Hoog (klant verwacht Sarah)

**Opties:**
- Mark doet presentatie (kent project ook)
- Verzet presentatie naar volgende week dinsdag (klant bellen)
- Sarah komt alleen voor presentatie (als ze dan beter is)

---

## 🎯 AANBEVOLEN ACTIE:

**DIRECT (nu):**
1. ☎️ Bel Emma voor shoot vandaag
2. 📞 Bel klant X (persoon wijziging melden)

**LATER VANDAAG:**
3. Besluit over presentatie vrijdag (afhankelijk van Sarah's herstel)
4. Plan edit werk Y opnieuw in

**Wil je dat ik de planning aanpas zodra je beslissing hebt genomen?**
```

**Test Validatie:**
- [ ] Urgent verlof wordt gedetecteerd
- [ ] Taken van VANDAAG worden geprioriteerd
- [ ] Concrete actiestappen worden voorgesteld
- [ ] Operator maakt onderscheid tussen urgent/later
- [ ] User begrijpt wat NU moet gebeuren

---

### Scenario 7: Edge Case - Overbelasting

**Goal:** Test of Ellen overbelasting detecteert

**Setup:**
- Nieuw project aanvraag
- Mark moet ingepland (10 dagen productie)
- **MAAR:** Mark is al 80% bezet komende 3 weken

**Context Data:**
```json
{
  "workload": [
    {
      "employee": "Mark",
      "weeklyBreakdown": [
        { "week": "2024-02-05", "hours": 32, "utilization": 80 },
        { "week": "2024-02-12", "hours": 35, "utilization": 87.5 },
        { "week": "2024-02-19", "hours": 30, "utilization": 75 }
      ]
    }
  ]
}
```

**Expected Operator Response:**

```markdown
⚠️ **Capaciteitsprobleem gedetecteerd**

**Probleem:**
Mark moet 10 dagen productie doen, maar is al **80-87% bezet** de komende 3 weken.

**Analyse:**
- Mark's normale capaciteit: 40 uur/week (5 dagen)
- Huidige belasting: 30-35 uur/week
- Beschikbaar: 5-10 uur/week
- Nodig voor dit project: 80 uur (10 dagen)

**➜ Niet haalbaar binnen gewenste tijdlijn zonder overbelasting**

---

## 💡 VOORSTELLEN:

### Optie 1: Verdeel werk tussen Mark en Emma
**Hybride team**

- Mark: 5 dagen productie (wat hij kan)
- Emma: 5 dagen productie (rest overnemen)

**Voordeel:** Binnen timeline
**Risico:** Coördinatie tussen twee videografen nodig

---

### Optie 2: Verschuif project 2 weken
**Wacht tot Mark meer capaciteit heeft**

- Start project week 9 (ipv week 6)
- Mark heeft vanaf week 9 meer ruimte (40% bezet)

**Impact:** Deadline verschuift van 1 maart naar 15 maart

---

### Optie 3: Freelance videograaf
**Externe resource inhuren**

**Kosten:** Inschatting €4.000-6.000
**Voordeel:** Mark wordt niet verder belast

---

**⚠️ WAARSCHUWING:**
Als we Mark nu verder belasten (>90%), risico op:
- Burnout
- Kwaliteit lijdt
- Andere projecten vertragen

**Wat wil je doen?**
```

**Test Validatie:**
- [ ] Overbelasting wordt gedetecteerd
- [ ] Workload percentage wordt berekend
- [ ] Waarschuwing voor burnout/kwaliteit
- [ ] Alternatieve oplossingen (verdelen, uitstellen, extern)
- [ ] User begrijpt de risico's

---

## Test Execution Plan

### Fase 1: Operator Training (1 dag)

1. **Operator leert Ellen's logica:**
   - Lees [ellen-role-definition.md](ellen-role-definition.md)
   - Lees [detailed-workflows.md](detailed-workflows.md)
   - Bestudeer response templates

2. **Practice runs:**
   - Operator doorloopt scenario 1-3 zonder gebruiker
   - Verfijn responses
   - Check timing (hoe lang duurt het om response te schrijven?)

---

### Fase 2: User Testing (3-5 dagen)

**Per scenario:**
1. User vult template in
2. Workflows fetchen data (automation)
3. Operator ziet data in dashboard
4. Operator schrijft Ellen response (5-10 min)
5. User ziet response, maakt keuze
6. Log resultaten

**Metrics:**
- Tijd per scenario
- Aantal vragen van user
- Aantal keer dat operator vastloopt (missing data)
- User satisfaction (schaal 1-5)

---

### Fase 3: Iteration (2 dagen)

1. **Analyseer logs:**
   - Welke velden missen in templates?
   - Welke context data is nuttig/niet nuttig?
   - Welke responses waren verwarrend?

2. **Update documentatie:**
   - Pas template specs aan
   - Verfijn Ellen's decision tree
   - Update response templates

3. **Herhaal problematische scenarios**

---

## Success Criteria

### Templates zijn goed als:
- [ ] Operator heeft ALLE data nodig om response te schrijven
- [ ] Geen "ik weet het niet" responses door missing data
- [ ] Operator kan binnen 10 min complete response maken

### Workflows zijn goed als:
- [ ] User begrijpt Ellen's voorstellen
- [ ] User kan beslissing maken zonder extra vragen
- [ ] Flow voelt natuurlijk (niet geforceerd)

### Ready voor Echte Ellen als:
- [ ] Alle 7 scenarios succesvol doorlopen
- [ ] Operator heeft geen "edge cases" meer ontdekt
- [ ] User tevreden met speed en kwaliteit
- [ ] Templates en workflows zijn stabiel

---

## Response Templates voor Operator

### Template: Happy Path
```markdown
✅ Planning is mogelijk!

## 📋 VOORSTEL:

[Timeline hier]

**Analyse:**
✅ [Wat gaat goed]
✅ [Wat gaat goed]

**Risico's:**
⚠️ [Eventuele waarschuwingen]

---

Wil je deze planning gebruiken?
```

### Template: Conflict Detected
```markdown
⚠️ [Type] conflict gedetecteerd

**Probleem:**
[Beschrijf probleem]

## 💡 VOORSTELLEN:

### Optie 1: [Naam]
[Beschrijving]

**Impact:** [Consequenties]

### Optie 2: [Naam]
[Beschrijving]

**Impact:** [Consequenties]

---

Wat wil je doen?
```

### Template: Error / Cannot Proceed
```markdown
❌ Kan geen planning maken

**Reden:**
[Waarom niet]

**Ontbrekende data:**
- [Wat mist]
- [Wat mist]

**Actie:**
[Wat user moet doen]
```

---

**Last Updated**: 2024-01-28
**Version**: 1.0
**Status**: Ready for Wizard of Oz testing setup
