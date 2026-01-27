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

## Huidige Status

### ✅ Voltooid
- Documentatie compleet
- Architectuur beslissingen gemaakt
- Tools gedefinieerd
- Planning automation service werkt al

### 🔄 Bezig (Fase 2)
- Titel integratie in templates fixen
- Missing velden toevoegen
- Template data flows testen

### ⏳ Nog te doen
- Wizard of Oz test opzetten (Fase 3)
- Echte Ellen bouwen (Fase 4)

---

## Volgende Stappen

### Voor Template Developers:
1. Lees [workflows.md](./workflows.md) secties 2, 3, 4
2. Check welke velden missen in templates
3. Fix titel integratie (Meeting.tsx, Wijzigingsverzoek.tsx)
4. Voeg extra velden toe (reden, impact, etc.)

### Voor UX/Product:
1. Lees [workflows.md](./workflows.md) sectie 7 (Conversation Patterns)
2. Bedenk Wizard of Oz test scenarios
3. Schrijf Ellen scripts voor test
4. Ontwerp user journey

### Voor Backend Developers (later):
1. Lees [architecture.md](./architecture.md)
2. Lees [tools.md](./tools.md)
3. Lees [implementation-plan.md](./implementation-plan.md)
4. Start met Fase 1: Backend Foundation

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

- **Over workflows:** Check [workflows.md](./workflows.md) sectie 5 (Ellen's Decision Tree)
- **Over techniek:** Check [architecture.md](./architecture.md)
- **Over implementatie:** Check [implementation-plan.md](./implementation-plan.md)
- **Over tools:** Check [tools.md](./tools.md)

---

## Contacts & Resources

- **Project folder:** `/docs/ellen/`
- **Templates:** `/src/pages/` (Meeting.tsx, Wijzigingsverzoek.tsx, Verlof.tsx)
- **Forms:** `/src/components/forms/`
- **Current automation:** `/src/lib/services/planningAutomation.ts`

---

**Last updated:** 2024-01-27
