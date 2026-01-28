# Ellen Project - Start Here

## Overzicht

Deze folder bevat alle documentatie voor Ellen, de AI Planning Agent voor het AI Traffic Manager systeem.

## Roadmap

```
┌──────────────────────────────────────────────────────────────┐
│ FASE 1: DOCUMENTATIE (✓ DONE)                                │
├──────────────────────────────────────────────────────────────┤
│ - Ellen's rol en functionaliteit gedocumenteerd              │
│ - Architectuur uitgedacht                                     │
│ - Workflows beschreven                                        │
│ - Tools gedefinieerd                                          │
│ - Implementation plan gemaakt                                 │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ FASE 2: TEMPLATES & WORKFLOWS (← HUIDIGE STAP)               │
├──────────────────────────────────────────────────────────────┤
│ - Fix titel integratie (Meeting, Wijziging, Verlof)         │
│ - Voeg missing velden toe die Ellen nodig heeft              │
│ - Test data flow van template → data structuur              │
│ - Zorg dat alle benodigde context wordt verzameld           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ FASE 3: WIZARD OF OZ TEST                                     │
├──────────────────────────────────────────────────────────────┤
│ - Mock Ellen interface (chat UI zonder AI)                   │
│ - Mens speelt Ellen rol                                      │
│ - Test workflows met echte gebruikers                        │
│ - Verfijn prompts en responses                               │
│ - Valideer dat templates alle juiste data geven             │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ FASE 4: ECHTE ELLEN BOUWEN                                    │
├──────────────────────────────────────────────────────────────┤
│ - Supabase edge function met LangChain                       │
│ - Claude API integratie                                       │
│ - Tools implementeren                                         │
│ - Frontend koppelen                                           │
│ - Testen en deployen                                          │
└──────────────────────────────────────────────────────────────┘
```

## Documenten

### 1. [README.md](./README.md)
**Start hier!** Overzicht van wat Ellen is en wat ze doet.

**Lees dit voor:**
- Begrijpen van Ellen's kernfunctionaliteit
- Overzicht van use cases

---

### 2. [architecture.md](./architecture.md)
Technische architectuur en systeem design.

**Lees dit voor:**
- Begrijpen hoe Ellen werkt (frontend ↔ backend ↔ database)
- Technology stack (LangChain, Claude, Supabase)
- Data flow en component breakdown
- Security model

**Belangrijk voor:** Developers die Ellen gaan bouwen

---

### 3. [workflows.md](./workflows.md)
Hoe Ellen werkt met templates en welke data ze nodig heeft.

**Lees dit voor:**
- Template → Ellen flow voor Meeting, Wijziging, Verlof
- Welke velden Ellen nodig heeft per template
- Ellen's decision tree
- Conversation patterns (voorbeelden)

**Belangrijk voor:**
- Template ontwerp (Fase 2)
- Wizard of Oz test scripts (Fase 3)
- UX designers

---

### 4. [tools.md](./tools.md)
Alle tools die Ellen kan gebruiken.

**Lees dit voor:**
- Query tools (data ophalen)
- Action tools (planning wijzigen)
- Analysis tools (suggesties doen)
- Tool schemas en implementations

**Belangrijk voor:** Backend developers (Fase 4)

---

### 5. [implementation-plan.md](./implementation-plan.md)
Stap-voor-stap plan om Ellen te bouwen.

**Lees dit voor:**
- Gedetailleerde implementatie stappen
- Time estimates
- Code snippets
- Testing strategie

**Belangrijk voor:** Project planning (Fase 4)

---

### 6. [ellen-role-definition.md](./ellen-role-definition.md)
**KRITIEK DOCUMENT** - Ellen's exacte verantwoordelijkheden.

**Lees dit voor:**
- Wat Ellen WEL doet (Nieuw Project, Wijzigingen, Verlof conflicten)
- Wat Ellen NIET doet (Ad-hoc meetings, Team updates, Reistijd)
- Autonomie level (altijd voorstellen, nooit direct uitvoeren)
- Template → Ellen flow
- Status levels (CONCEPT vs VAST)

**Belangrijk voor:** Iedereen die met Ellen werkt

---

### 7. [detailed-workflows.md](./detailed-workflows.md)
**MEEST GEDETAILLEERD** - Stap-voor-stap flows voor elk scenario.

**Lees dit voor:**
- WORKFLOW 1: Nieuw Project (8 stappen met UI mockups)
- WORKFLOW 2: Wijzigingen (impact analyse)
- WORKFLOW 3: Ad-hoc Meeting (zonder Ellen)
- WORKFLOW 4: Verlof (preventief + reactief)
- Volledige conversation voorbeelden

**Belangrijk voor:** UX designers, Wizard of Oz testers

---

### 8. [template-specifications.md](./template-specifications.md)
Complete specificatie van alle template velden.

**Lees dit voor:**
- Exacte velden per template (NieuwProject, Meeting, Wijziging, Verlof)
- Validatie regels
- Data types en formats
- Missing velden die toegevoegd moeten worden
- UI/UX requirements

**Belangrijk voor:** Frontend developers (Fase 2)

---

### 9. [automation-workflows.md](./automation-workflows.md)
Workflows die ZONDER Ellen draaien (pure automation).

**Lees dit voor:**
- Pre-Ellen data fetching (Outlook, verlof, workload)
- Quick Add Meeting workflow
- Status updates (CONCEPT → VAST)
- Notification workflows
- Data sync (Outlook bidirectional)

**Belangrijk voor:** Backend developers, DevOps

---

### 10. [wizard-of-oz-test-scenarios.md](./wizard-of-oz-test-scenarios.md)
Test scenarios voor Wizard of Oz testing.

**Lees dit voor:**
- 7 complete test scenarios met expected responses
- Operator dashboard design
- Response templates
- Success criteria
- Test execution plan

**Belangrijk voor:** Test operators, UX researchers (Fase 3)

---

## Huidige Status

### ✅ FASE 1 VOLTOOID: Documentatie
- ✅ Ellen's rol en functionaliteit gedocumenteerd
- ✅ Architectuur uitgedacht
- ✅ Workflows beschreven (gedetailleerd)
- ✅ Tools gedefinieerd (alle 15+ tools)
- ✅ Implementation plan gemaakt
- ✅ Template specificaties compleet
- ✅ Automation workflows gedocumenteerd
- ✅ Wizard of Oz test scenarios klaar

**Totaal: 10 documenten, ~120 KB documentatie**

### 🔄 FASE 2 READY: Templates & Workflows
**Volgende stap:** Template updates implementeren

**Te doen:**
- [ ] Meeting.tsx: Replace klanten dropdown with ProjectSelector
- [ ] Meeting.tsx: Add locatie + reistijd fields
- [ ] Wijzigingsverzoek.tsx: Add context fields (reden, situaties, urgentie)
- [ ] Verlof.tsx: Add verlofCategorie + backupPersoon
- [ ] Database: Add beschikbaarheid column to klanten table
- [ ] Client Form: Add beschikbaarheid UI
- [ ] Test data flows end-to-end

### ⏳ FASE 3 TODO: Wizard of Oz Testing
- Setup mock Ellen interface
- Train operator
- Execute 7 test scenarios
- Iterate based on feedback

### ⏳ FASE 4 TODO: Echte Ellen Bouwen
- Supabase Edge Function + Claude API
- Implement all tools
- Frontend integration
- Deploy & test

---

## Volgende Stappen

### Voor Template Developers (Fase 2):
1. Lees [template-specifications.md](./template-specifications.md) volledig
2. Implementeer missing velden:
   - Meeting.tsx: ProjectSelector, locatie, reistijd
   - Wijzigingsverzoek.tsx: reden, situaties, urgentie
   - Verlof.tsx: categorie, backupPersoon
3. Database: Add beschikbaarheid to klanten table
4. Test data flows end-to-end
5. Checklist afwerken in template-specifications.md

### Voor UX/Product (Fase 3):
1. Lees [ellen-role-definition.md](./ellen-role-definition.md) - Ellen's persoonlijkheid
2. Lees [detailed-workflows.md](./detailed-workflows.md) - Conversation patterns
3. Lees [wizard-of-oz-test-scenarios.md](./wizard-of-oz-test-scenarios.md)
4. Setup mock Ellen interface
5. Train operator met response templates
6. Execute test scenarios
7. Itereer op basis van feedback

### Voor Backend Developers (Fase 4 - later):
1. Lees [architecture.md](./architecture.md)
2. Lees [tools.md](./tools.md) - Alle 15+ tool implementaties
3. Lees [automation-workflows.md](./automation-workflows.md)
4. Lees [implementation-plan.md](./implementation-plan.md)
5. Start met Supabase Edge Function + Claude API
6. Implement tools stap voor stap

---

## Wizard of Oz Test Plan

### Wat is Wizard of Oz Testing?
Een mens speelt Ellen's rol om de workflow te testen voordat de echte AI gebouwd wordt.

### Setup:
```
1. MOCK ELLEN INTERFACE
   - Chat UI (reuse EllenChat.tsx component)
   - Backend endpoint die berichten doorstuurt naar operator
   - Operator dashboard om responses te typen

2. TEST SCENARIOS
   - User vult Meeting template in
   - Navigeert naar Ellen chat
   - Operator (speelt Ellen) analyseert data
   - Operator stuurt response met suggesties
   - User confirmed actie
   - Check of correcte data in database komt

3. LEARNINGS
   - Missen er velden in templates?
   - Zijn Ellen's responses duidelijk?
   - Werkt confirmation flow goed?
   - Welke edge cases komen we tegen?

4. ITERATE
   - Verfijn templates op basis van feedback
   - Pas Ellen scripts aan
   - Herhaal test tot workflows soepel lopen
```

### Voordelen:
- ✅ Test workflows zonder AI te bouwen
- ✅ Goedkoper en sneller
- ✅ Ontdek problemen vroeg
- ✅ Verfijn prompts voor echte Ellen

---

## Checklist voor Wizard of Oz Test

### Templates Ready:
- [ ] Meeting template heeft ProjectSelector (met titel)
- [ ] Meeting template heeft "Doel" veld
- [ ] Wijziging template heeft titel support
- [ ] Wijziging template heeft reden, huidige/gewenste situatie, impact, urgentie
- [ ] Verlof template heeft categorie en backup persoon
- [ ] Alle templates geven volledige data door naar Ellen

### Ellen Scripts:
- [ ] Response patterns per template type
- [ ] Confirmation messages
- [ ] Error handling messages
- [ ] Alternative suggestion templates

### Technical Setup:
- [ ] Mock Ellen backend endpoint
- [ ] Operator dashboard
- [ ] Chat UI geïntegreerd met templates
- [ ] Data logging (voor analyse)

### Test Scenarios:
- [ ] Happy path - alles werkt perfect
- [ ] Conflict scenario - tijd niet beschikbaar
- [ ] Impact scenario - grote wijziging
- [ ] Error scenario - onvolledige data

---

## Vragen?

- **Wat doet Ellen precies?** → [ellen-role-definition.md](./ellen-role-definition.md)
- **Hoe werken de workflows?** → [detailed-workflows.md](./detailed-workflows.md)
- **Welke velden moet ik toevoegen?** → [template-specifications.md](./template-specifications.md)
- **Hoe test ik dit?** → [wizard-of-oz-test-scenarios.md](./wizard-of-oz-test-scenarios.md)
- **Over techniek:** → [architecture.md](./architecture.md)
- **Over automation:** → [automation-workflows.md](./automation-workflows.md)
- **Over implementatie:** → [implementation-plan.md](./implementation-plan.md)
- **Over tools:** → [tools.md](./tools.md)

---

## Contacts & Resources

- **Project folder:** `/docs/ellen/`
- **Templates:** `/src/pages/` (Meeting.tsx, Wijzigingsverzoek.tsx, Verlof.tsx)
- **Forms:** `/src/components/forms/`
- **Current automation:** `/src/lib/services/planningAutomation.ts`
- **Database:** Supabase (projecten, taken, meetings_en_presentaties, etc.)

---

**Last updated:** 2024-01-28
**Documentation Status:** ✅ FASE 1 COMPLEET
**Total Documentation:** 10 files, ~120 KB
