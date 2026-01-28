# Template Specificaties voor Ellen

Dit document beschrijft EXACT welke velden elk template moet hebben om Ellen optimaal te laten functioneren.

## Inhoudsopgave

1. [NieuwProject Template](#1-nieuwproject-template)
2. [Meeting Template](#2-meeting-template)
3. [Wijziging Template](#3-wijziging-template)
4. [Verlof Template](#4-verlof-template)
5. [Client Settings](#5-client-settings)
6. [Validatie Regels](#6-validatie-regels)
7. [Data Flow Diagram](#7-data-flow-diagram)
8. [UI/UX Requirements](#8-uiux-requirements)

---

## 1. NieuwProject Template

### Huidige Status: ✅ Grotendeels compleet

### File: `/src/pages/NieuwProject.tsx`

### Benodigde Velden:

#### Sectie 1: Project Header (ProjectHeader.tsx)

| Veld | Type | Required | Validatie | Ellen Gebruikt Voor |
|------|------|----------|-----------|---------------------|
| `klantId` | UUID (dropdown) | ✅ Ja | Moet bestaande klant zijn | Klant constraints ophalen, beschikbaarheid checken |
| `klantIdBasis` | string (auto) | ✅ Ja | 6 cijfers | Deel van projectnummer berekening |
| `projectVolgnummer` | string | ✅ Ja | 2 cijfers, uniek per klant | Projectnummer generatie |
| `volledigProjectId` | string (auto) | ✅ Ja | Format: `{klantnummer}{volgnummer}` | Unieke identificatie |
| `projectTitel` | string (auto) | ✅ Ja | Format: `{klantnaam}_{volledigProjectId}` | Ellen gebruikt dit voor communicatie |
| `projectomschrijving` | string | ✅ Ja | Min 10 karakters | Context voor Ellen |
| `datumAanvraag` | date | ✅ Ja | Vandaag of eerder | Planning start punt |
| `deadline` | date | ✅ Ja | Na vandaag | HEILIGE constraint voor Ellen |
| `opmerkingen` | text | ❌ Nee | - | Extra context voor Ellen |

**Status**: ✅ Alle velden aanwezig en werkend

---

#### Sectie 2: Projecttype Selectie (ProjectTypeSelector.tsx)

| Veld | Type | Required | Validatie | Ellen Gebruikt Voor |
|------|------|----------|-----------|---------------------|
| `projecttype` | dropdown | ✅ Ja | Een van voorgedefinieerde types | Template matching voor inspanning schatting |

**Opties:**
- Video productie
- Fotoshoot
- Campagne ontwikkeling
- Website ontwikkeling
- Social media content
- Event coverage
- Algemeen

**Status**: ✅ Werkend

---

#### Sectie 3: Fases (PhaseSelection.tsx)

**Array van fase objecten:**

| Veld | Type | Required | Validatie | Ellen Gebruikt Voor |
|------|------|----------|-----------|---------------------|
| `faseNaam` | string | ✅ Ja | Voorgedefinieerde namen | Volgorde bepalen |
| `medewerkers` | UUID[] | ✅ Ja | Min 1 medewerker | Wie moet ingepland |
| `inspanningDagen` | number | ✅ Ja | > 0 | Hoeveel tijd nodig |
| `discipline` | string (auto) | ❌ Nee | Van medewerker data | Team samenstelling valideren |

**Standaard Fases:**
- Concept
- Pre-productie
- Productie
- Post-productie
- Afronding

**Status**: ✅ Werkend, maar medewerker multi-select moet duidelijk zijn

---

#### Sectie 4: Presentatie Planning (PresentationPlanning.tsx)

| Veld | Type | Required | Validatie | Ellen Gebruikt Voor |
|------|------|----------|-----------|---------------------|
| `presentatieMomenten` | array | ❌ Nee | - | Pre-agreed presentatie data |
| `presentatieMomenten[].datum` | date | ✅ Ja (als array bestaat) | Na vandaag, voor deadline | Fixed dates die Ellen MOET respecteren |
| `presentatieMomenten[].fase` | string | ✅ Ja | Moet bestaande fase zijn | Koppeling aan fase |
| `presentatieMomenten[].opmerking` | text | ❌ Nee | - | Context |

**Ellen's gedrag:**
- Als `presentatieMomenten` leeg: Ellen berekent optimale momenten
- Als `presentatieMomenten` gevuld: Ellen respecteert deze data en plant eromheen

**Status**: ⚠️ Check of dit veld bestaat en correct wordt doorgegeven

---

### Data Output Format:

```typescript
interface NieuwProjectData {
  projectHeader: {
    klantId: string;
    klantIdBasis: string;
    klantNaam: string; // ← NEW: Ellen heeft klantnaam nodig
    projectVolgnummer: string;
    volledigProjectId: string;
    projectTitel: string;
    projectomschrijving: string;
    datumAanvraag: string; // ISO date
    deadline: string; // ISO date
    opmerkingen?: string;
  };
  projecttype: string;
  fases: Array<{
    naam: string;
    medewerkers: string[]; // UUIDs
    medewerkersNamen: string[]; // ← NEW: Ellen heeft namen nodig
    inspanningDagen: number;
  }>;
  presentatieMomenten?: Array<{
    datum: string; // ISO date
    fase: string;
    opmerking?: string;
  }>;
}
```

**Missing Data Points:**
1. `klantNaam` - Moet uit klanten tabel gehaald worden bij selectie
2. `medewerkersNamen` - Moet uit medewerkers tabel gehaald worden

---

## 2. Meeting Template

### Huidige Status: ⚠️ Needs Major Updates

### File: `/src/pages/Meeting.tsx`

### Probleem:
Gebruikt momenteel `klanten` dropdown in plaats van `ProjectSelector`. Meeting moet aan bestaand project gekoppeld worden.

### Benodigde Velden:

| Veld | Type | Required | Validatie | Ellen Gebruikt Voor |
|------|------|----------|-----------|---------------------|
| `projectId` | UUID (ProjectSelector) | ✅ Ja | Moet bestaand project zijn | Context ophalen, planning checken |
| `projectTitel` | string (auto from selector) | ✅ Ja | - | Display in chat |
| `onderwerp` | string | ✅ Ja | Min 5 karakters | Meeting doel begrijpen |
| `meetingType` | dropdown | ✅ Ja | Voorgedefinieerde types | Duur inschatten |
| `voorkeursData` | date[] | ❌ Nee | Max 5 opties | Ellen checkt deze eerst |
| `deelnemers` | UUID[] (multi-select) | ✅ Ja | Min 1 medewerker | Beschikbaarheid checken |
| `locatie` | dropdown | ✅ Ja | 'Bij klant' / 'Op kantoor' / 'Online' | Reistijd berekenen |
| `reistijd` | number (minutes) | ❌ Nee (conditie) | Alleen als locatie = 'Bij klant' | Tijd blokkeren voor/na meeting |
| `duur` | number (minutes) | ❌ Nee | Default per type | Meeting block size |
| `opmerkingen` | text | ❌ Nee | - | Extra context |

**Meeting Types en Default Duur:**
- Kickoff meeting (90 min)
- Presentatie concept (60 min)
- Presentatie productie (60 min)
- Presentatie edit (60 min)
- Evaluatie meeting (45 min)
- Team update (30 min)
- Client call (30 min)
- Custom (planner vult duur in)

**Reistijd Logic:**
```typescript
if (locatie === 'Bij klant') {
  // Toon reistijd veld
  // Ellen blokkeert [reistijd] voor meeting + [reistijd] na meeting
} else {
  // Geen reistijd nodig
}
```

### UI Flow:

```
┌──────────────────────────────────────────────────────────┐
│ MEETING TEMPLATE                                          │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Project:  [ProjectSelector met titel ▼]                  │
│           → Shows: "Selmore_12345601 - Video campagne"   │
│                                                           │
│ Onderwerp: [___________________________________]          │
│                                                           │
│ Type:      [Presentatie concept ▼]                       │
│            → Auto-fill duur: 60 min                       │
│                                                           │
│ Deelnemers: [☑ Sarah  ☑ Mark  ☐ Lisa  ▼]                │
│                                                           │
│ Locatie:   [Bij klant ▼]                                 │
│            → Shows reistijd veld:                         │
│            Reistijd: [30] minuten                         │
│                                                           │
│ Voorkeursdatum (optioneel):                              │
│   [+ Datum toevoegen]                                    │
│   • 2024-02-15 14:00  [x]                                │
│   • 2024-02-16 10:00  [x]                                │
│                                                           │
│ Opmerkingen: [____________________________]              │
│                                                           │
│         [Quick Add]  [Vraag Ellen]                       │
└──────────────────────────────────────────────────────────┘
```

### Two Modes:

#### Mode 1: Quick Add (Zonder Ellen)
**Wanneer**: Planning staat al VAST, simpele meeting toevoegen

**Flow:**
1. Planner vult template in
2. Klikt "Quick Add"
3. Automation workflow:
   - Check conflict in selected tijdslot
   - Insert in database
   - Done
4. Navigeert terug naar planner

**Geen Ellen, pure automation.**

#### Mode 2: Vraag Ellen
**Wanneer**: Planner weet niet wanneer het kan, wil suggesties

**Flow:**
1. Planner vult template in (zonder datum/tijd)
2. Klikt "Vraag Ellen"
3. Ellen analyseert:
   - Beschikbaarheid deelnemers
   - Klant beschikbaarheid
   - Presentatie logica (na welke fase)
4. Ellen stelt 2-3 opties voor
5. Planner kiest en bevestigt

### Data Output Format:

```typescript
interface MeetingData {
  projectId: string;
  projectTitel: string;
  onderwerp: string;
  meetingType: string;
  deelnemers: string[]; // UUIDs
  deelnemersNamen: string[]; // ← NEW
  locatie: 'Bij klant' | 'Op kantoor' | 'Online';
  reistijd?: number; // minutes, alleen als bij klant
  duur: number; // minutes
  voorkeursData?: string[]; // ISO datetime
  opmerkingen?: string;
}
```

### Required Changes:

**File: `/src/pages/Meeting.tsx`**

**VOOR (huidige code):**
```typescript
// Line ~147-164
<div className="space-y-2">
  <label className="text-sm font-medium text-gray-700">
    Klant *
  </label>
  <Select
    value={formData.klantId}
    onValueChange={(value) => handleInputChange('klantId', value)}
  >
    <SelectTrigger>
      <SelectValue placeholder="Selecteer een klant" />
    </SelectTrigger>
    <SelectContent>
      {clients.map((client) => (
        <SelectItem key={client.id} value={client.id}>
          {client.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

**NA (nieuwe code):**
```typescript
import { ProjectSelector } from '@/components/forms/ProjectSelector';

// In component state:
const [selectedProject, setSelectedProject] = useState<{
  id: string;
  titel: string;
  klantNaam: string;
} | null>(null);

// In JSX:
<div className="space-y-2">
  <label className="text-sm font-medium text-gray-700">
    Project *
  </label>
  <ProjectSelector
    value={formData.projectId}
    onChange={(projectId, projectData) => {
      handleInputChange('projectId', projectId);
      setSelectedProject(projectData);
      // projectData bevat: { id, titel, klantNaam }
    }}
    placeholder="Selecteer een project"
  />
  {selectedProject && (
    <div className="text-sm text-gray-500">
      {selectedProject.klantNaam} - {selectedProject.titel}
    </div>
  )}
</div>
```

**Nieuwe velden toevoegen:**
```typescript
// Locatie dropdown met reistijd conditie
<div className="space-y-2">
  <label className="text-sm font-medium text-gray-700">
    Locatie *
  </label>
  <Select
    value={formData.locatie}
    onValueChange={(value) => {
      handleInputChange('locatie', value);
      if (value !== 'Bij klant') {
        handleInputChange('reistijd', undefined);
      }
    }}
  >
    <SelectTrigger>
      <SelectValue placeholder="Selecteer locatie" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="Op kantoor">Op kantoor</SelectItem>
      <SelectItem value="Bij klant">Bij klant</SelectItem>
      <SelectItem value="Online">Online</SelectItem>
    </SelectContent>
  </Select>
</div>

{formData.locatie === 'Bij klant' && (
  <div className="space-y-2">
    <label className="text-sm font-medium text-gray-700">
      Reistijd (minuten) *
    </label>
    <Input
      type="number"
      min="0"
      step="15"
      placeholder="Bijv. 30"
      value={formData.reistijd || ''}
      onChange={(e) => handleInputChange('reistijd', parseInt(e.target.value))}
    />
    <p className="text-xs text-gray-500">
      Deze tijd wordt voor en na de meeting geblokkeerd
    </p>
  </div>
)}
```

---

## 3. Wijziging Template

### Huidige Status: ⚠️ Needs Major Updates

### File: `/src/pages/Wijzigingsverzoek.tsx`

### Probleem:
Mist cruciale context velden die Ellen nodig heeft voor impact analyse.

### Benodigde Velden:

| Veld | Type | Required | Validatie | Ellen Gebruikt Voor |
|------|------|----------|-----------|---------------------|
| `projectId` | UUID (ProjectSelector) | ✅ Ja | Moet bestaand project zijn | Welk project wordt gewijzigd |
| `projectTitel` | string (auto) | ✅ Ja | - | Display |
| `wijzigingsType` | dropdown | ✅ Ja | Voorgedefinieerde types | Impact inschatten |
| `reden` | text | ✅ Ja | Min 20 karakters | Context begrijpen |
| `huidigeSituatie` | text | ✅ Ja | Min 20 karakters | Wat is er nu |
| `gewensteSituatie` | text | ✅ Ja | Min 20 karakters | Wat moet het worden |
| `urgentie` | dropdown | ✅ Ja | Laag/Midden/Hoog | Prioriteit bepalen |
| `gewensteDeadline` | date | ❌ Nee | - | Nieuwe deadline (optioneel) |
| `betrokkenMedewerkers` | UUID[] | ❌ Nee | - | Wie wordt geraakt |
| `opmerkingen` | text | ❌ Nee | - | Extra context |

**Wijzigings Types:**
- Deadline verschuiven
- Persoon vervangen
- Uren aanpassen (meer/minder)
- Fase toevoegen/verwijderen
- Presentatie verzetten
- Scope wijziging
- Anders (specificeer)

**Urgentie Levels:**
- **Laag**: Kan wachten, niet urgent
- **Midden**: Moet binnen een week geregeld
- **Hoog**: Asap, blokkeert voortgang

### UI Flow:

```
┌──────────────────────────────────────────────────────────┐
│ WIJZIGINGSVERZOEK                                         │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Project:  [ProjectSelector ▼]                            │
│           → Shows: "Selmore_12345601"                     │
│                                                           │
│ Type wijziging: [Persoon vervangen ▼]                    │
│                                                           │
│ Urgentie:  [○ Laag  ● Midden  ○ Hoog]                    │
│                                                           │
│ Reden: *                                                  │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Sarah heeft verlof aangevraagd in week 8           │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│ Huidige situatie: *                                       │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Sarah staat ingepland voor productie fase,         │  │
│ │ 3 dagen, week 8                                     │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│ Gewenste situatie: *                                      │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Andere videograaf inplannen in week 8              │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│ Betrokken medewerkers (optioneel):                       │
│   [☑ Sarah  ☐ Mark  ☐ Lisa  ▼]                          │
│                                                           │
│ Nieuwe deadline (optioneel):                             │
│   [2024-03-15]                                           │
│                                                           │
│ Opmerkingen: [____________________________]              │
│                                                           │
│               [Indienen bij Ellen]                        │
└──────────────────────────────────────────────────────────┘
```

### Ellen's Analyse Flow:

1. **Ellen ontvangt wijziging**
2. **Haalt project op** met alle planning
3. **Analyseert impact:**
   - Welke taken worden geraakt?
   - Wie is betrokken?
   - Wordt deadline in gevaar?
   - Zijn er domino effecten?
4. **Maakt voorstel:**
   - Nieuwe planning
   - Alternatieve personen (bij vervangen)
   - Aangepaste tijdlijn
   - Risico's en waarschuwingen
5. **Planner bevestigt**
6. **Pas daarna wordt planning aangepast**

### Data Output Format:

```typescript
interface WijzigingData {
  projectId: string;
  projectTitel: string;
  wijzigingsType:
    | 'deadline_verschuiven'
    | 'persoon_vervangen'
    | 'uren_aanpassen'
    | 'fase_wijzigen'
    | 'presentatie_verzetten'
    | 'scope_wijziging'
    | 'anders';
  reden: string;
  huidigeSituatie: string;
  gewensteSituatie: string;
  urgentie: 'laag' | 'midden' | 'hoog';
  gewensteDeadline?: string; // ISO date
  betrokkenMedewerkers?: string[]; // UUIDs
  betrokkenMedewerkersNamen?: string[]; // ← NEW
  opmerkingen?: string;
}
```

### Required Changes:

**File: `/src/pages/Wijzigingsverzoek.tsx`**

Vervang huidige `ExistingProjectSelector` door `ProjectSelector`:

```typescript
import { ProjectSelector } from '@/components/forms/ProjectSelector';

// Add nieuwe velden:
const [formData, setFormData] = useState({
  projectId: '',
  projectTitel: '',
  wijzigingsType: '',
  reden: '',
  huidigeSituatie: '',
  gewensteSituatie: '',
  urgentie: 'midden' as 'laag' | 'midden' | 'hoog',
  gewensteDeadline: '',
  betrokkenMedewerkers: [] as string[],
  opmerkingen: ''
});
```

Voeg nieuwe veld UI toe (volledig nieuwe component structuur nodig).

---

## 4. Verlof Template

### Huidige Status: ⚠️ Needs Updates

### File: `/src/pages/Verlof.tsx`

### Benodigde Velden:

| Veld | Type | Required | Validatie | Ellen Gebruikt Voor |
|------|------|----------|-----------|---------------------|
| `medewerkerId` | UUID (dropdown) | ✅ Ja | Bestaande medewerker | Wie heeft verlof |
| `medewerkerNaam` | string (auto) | ✅ Ja | - | Display |
| `startDatum` | date | ✅ Ja | >= vandaag | Begin verlof |
| `eindDatum` | date | ✅ Ja | >= startDatum | Einde verlof |
| `verlofType` | dropdown | ✅ Ja | Voorgedefinieerde types | Impact bepalen |
| `verlofCategorie` | radio | ✅ Ja | 'gepland' / 'urgent' | Ellen's response strategie |
| `backupPersoon` | UUID (dropdown) | ❌ Nee | Andere medewerker, zelfde discipline | Ellen's suggestie start punt |
| `reden` | text | ❌ Nee | - | Context (privacy-sensitief) |
| `opmerkingen` | text | ❌ Nee | - | Extra info |

**Verlof Types:**
- Vakantie
- Ziekte
- Persoonlijk verlof
- Studie/training
- Ouderschapsverlof
- Onbetaald verlof

**Verlof Categorie:**
- **Gepland**: Vooraf aangevraagd, Ellen kan preventief checken
- **Urgent**: Nu/vandaag, Ellen moet reactief handelen

### UI Flow:

```
┌──────────────────────────────────────────────────────────┐
│ VERLOFAANVRAAG                                            │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Medewerker: [Sarah van Dam ▼] *                          │
│                                                           │
│ Type: [Vakantie ▼] *                                      │
│                                                           │
│ Categorie: *                                              │
│   ● Gepland verlof (vooraf aangevraagd)                  │
│   ○ Urgent verlof (nu/vandaag)                           │
│                                                           │
│ Periode: *                                                │
│   Van:  [2024-02-20]                                     │
│   Tot:  [2024-02-24]                                     │
│   → 5 werkdagen                                          │
│                                                           │
│ Backup persoon (optioneel):                              │
│   [Mark Jansen (Videograaf) ▼]                           │
│   ℹ️ Ellen gebruikt dit als startpunt voor herverdeling  │
│                                                           │
│ Reden (optioneel, privé):                                │
│   [________________________________]                     │
│                                                           │
│               [Indienen bij Ellen]                        │
└──────────────────────────────────────────────────────────┘
```

### Ellen's Verlof Flow:

#### Scenario A: Gepland Verlof (Preventief)

```
1. Medewerker dient verlof in (vooraf)
2. Ellen checkt: Heeft deze persoon geplande taken in deze periode?

   ALS GEEN CONFLICTEN:
   → Ellen: "✅ Geen conflicten, verlof goedgekeurd"
   → Verlof wordt direct geregistreerd

   ALS WEL CONFLICTEN:
   → Ellen analyseert:
     - Welke projecten worden geraakt?
     - Welke taken moeten herverdeeld?
     - Wie kan overnemen? (check capaciteit)
   → Ellen stelt herverdelingsplan voor:
     "⚠️ Sarah heeft 3 taken gepland in deze periode:

     1. Project Selmore_12345601 - Productie (3 dagen, week 8)
        → Suggestie: Mark heeft capaciteit, zelfde discipline

     2. Project Client2_78901202 - Edit (2 dagen, week 8)
        → Suggestie: Lisa heeft capaciteit

     Opties:
     A. Accepteer herverdeling zoals voorgesteld
     B. Kies andere backup personen
     C. Weiger verlof (planning is kritiek)"

   → Planner kiest optie
   → Ellen voert uit NA bevestiging
```

#### Scenario B: Urgent Verlof (Reactief)

```
1. Medewerker is ziek (urgent)
2. Ellen checkt: Heeft deze persoon taken VANDAAG of DEZE WEEK?

   → Ellen: "🚨 URGENT: Sarah is ziek

   Taken VANDAAG:
   - Project Selmore - Shoot om 14:00 (locatie: bij klant)
     → Suggestie: Mark bellen, backup camera crew regelen

   Taken DEZE WEEK:
   - Project Selmore - Edit (2 dagen)
     → Suggestie: Verschuif naar volgende week

   - Project Client2 - Presentatie vrijdag 10:00
     → Suggestie: Verzet naar volgende week OF Mark doet presentatie

   Wat wil je doen?"

   → Planner neemt direct actie (mogelijk buiten systeem, telefonisch)
   → Ellen past planning aan op basis van keuze
```

### Data Output Format:

```typescript
interface VerlofData {
  medewerkerId: string;
  medewerkerNaam: string;
  medewerkerDiscipline: string; // ← NEW: Ellen heeft dit nodig
  startDatum: string; // ISO date
  eindDatum: string; // ISO date
  verlofType:
    | 'vakantie'
    | 'ziekte'
    | 'persoonlijk'
    | 'studie'
    | 'ouderschapsverlof'
    | 'onbetaald';
  verlofCategorie: 'gepland' | 'urgent';
  backupPersoon?: string; // UUID
  backupPersoonNaam?: string; // ← NEW
  reden?: string;
  opmerkingen?: string;

  // Computed fields (voor display):
  aantalWerkdagen: number;
  conflicterende_taken?: number; // Ellen vult dit in bij analyse
}
```

### Required Changes:

**File: `/src/pages/Verlof.tsx`**

Voeg nieuwe velden toe:

```typescript
// Verlof categorie radio buttons
<div className="space-y-2">
  <label className="text-sm font-medium text-gray-700">
    Categorie *
  </label>
  <RadioGroup
    value={formData.verlofCategorie}
    onValueChange={(value) => handleInputChange('verlofCategorie', value)}
  >
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="gepland" id="gepland" />
      <label htmlFor="gepland" className="text-sm">
        Gepland verlof (vooraf aangevraagd)
      </label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="urgent" id="urgent" />
      <label htmlFor="urgent" className="text-sm">
        Urgent verlof (nu/vandaag)
      </label>
    </div>
  </RadioGroup>
</div>

// Backup persoon selector
<div className="space-y-2">
  <label className="text-sm font-medium text-gray-700">
    Backup persoon (optioneel)
  </label>
  <Select
    value={formData.backupPersoon}
    onValueChange={(value) => handleInputChange('backupPersoon', value)}
  >
    <SelectTrigger>
      <SelectValue placeholder="Selecteer backup" />
    </SelectTrigger>
    <SelectContent>
      {medewerkers
        .filter(m => m.id !== formData.medewerkerId) // Niet zichzelf
        .filter(m => m.discipline === selectedMedewerkerDiscipline) // Zelfde discipline
        .map((medewerker) => (
          <SelectItem key={medewerker.id} value={medewerker.id}>
            {medewerker.naam} ({medewerker.discipline})
          </SelectItem>
        ))}
    </SelectContent>
  </Select>
  <p className="text-xs text-gray-500">
    Ellen gebruikt dit als startpunt voor taak herverdeling
  </p>
</div>
```

---

## 5. Client Settings

### Huidige Status: ❌ Missing Critical Field

### File: `/src/components/forms/ClientForm.tsx` (mogelijk) of client settings pagina

### Probleem:
Ellen kan niet checken wanneer klant WEL beschikbaar is voor presentaties.

### Benodigde Velden:

#### In `klanten` tabel:

| Veld | Type | Required | Validatie | Ellen Gebruikt Voor |
|------|------|----------|-----------|---------------------|
| `naam` | string | ✅ Ja | - | Display |
| `klantnummer` | string | ✅ Ja | 6 cijfers, uniek | Projectnummer basis |
| `contactpersoon` | string | ❌ Nee | - | - |
| `email` | string | ❌ Nee | Email format | - |
| `telefoon` | string | ❌ Nee | - | - |
| `beschikbaarheid` | JSON | ❌ Nee | Valid JSON structure | **NIEUW: Presentatie planning** |

**Beschikbaarheid Structure:**

```typescript
interface KlantBeschikbaarheid {
  // Per dag van de week
  maandag: boolean;
  dinsdag: boolean;
  woensdag: boolean;
  donderdag: boolean;
  vrijdag: boolean;

  // Optioneel: specifieke blokkades
  blokkades?: Array<{
    datum: string; // ISO date
    reden: string; // "Vakantie directie", "Beursdag", etc.
  }>;

  // Optioneel: voorkeurstijden
  voorkeursTijden?: {
    ochtend: boolean; // 09:00 - 12:00
    middag: boolean;  // 13:00 - 17:00
  };
}
```

**Default Value:**
```json
{
  "maandag": true,
  "dinsdag": true,
  "woensdag": true,
  "donderdag": true,
  "vrijdag": true,
  "blokkades": []
}
```

### UI voor Klant Instellingen:

```
┌──────────────────────────────────────────────────────────┐
│ KLANT: Selmore                                            │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Basis Informatie:                                        │
│   Naam: Selmore BV                                       │
│   Nummer: 123456                                         │
│   Contact: Jan Smit                                      │
│                                                           │
│ ─────────────────────────────────────────────────────── │
│                                                           │
│ Beschikbaarheid voor Presentaties:                      │
│                                                           │
│ De klant kan presentaties bijwonen op:                  │
│   ☑ Maandag                                              │
│   ☑ Dinsdag                                              │
│   ☐ Woensdag (klant is woensdags niet beschikbaar)      │
│   ☑ Donderdag                                            │
│   ☑ Vrijdag                                              │
│                                                           │
│ Voorkeurstijden:                                         │
│   ☑ Ochtend (09:00 - 12:00)                              │
│   ☑ Middag (13:00 - 17:00)                               │
│                                                           │
│ Specifieke blokkades:                                    │
│   • 2024-07-15 t/m 2024-08-05: Zomervakantie directie   │
│   • 2024-12-24 t/m 2024-01-02: Kerstvakantie            │
│   [+ Blokkade toevoegen]                                 │
│                                                           │
│               [Opslaan]                                   │
└──────────────────────────────────────────────────────────┘
```

### Ellen's Gebruik:

```typescript
// Ellen checkt beschikbaarheid bij presentatie planning:

const klantBeschikbaarheid = await getKlantBeschikbaarheid(klant_id);

// Filter voorgestelde data:
const mogelijkePresentatieDatums = potentialDates.filter(datum => {
  const dagVanWeek = getDayOfWeek(datum); // 'maandag', 'dinsdag', etc.

  // Check algemene beschikbaarheid
  if (!klantBeschikbaarheid[dagVanWeek]) {
    return false; // Klant kan niet op deze dag
  }

  // Check specifieke blokkades
  const isGeblokeerd = klantBeschikbaarheid.blokkades?.some(blokkade => {
    return datum >= blokkade.startDatum && datum <= blokkade.eindDatum;
  });

  return !isGeblokeerd;
});

// Ellen stelt ALLEEN beschikbare dagen voor
```

### Database Migration Needed:

```sql
-- Add beschikbaarheid column to klanten table
ALTER TABLE klanten
ADD COLUMN beschikbaarheid JSONB DEFAULT '{
  "maandag": true,
  "dinsdag": true,
  "woensdag": true,
  "donderdag": true,
  "vrijdag": true,
  "blokkades": []
}'::jsonb;
```

---

## 6. Validatie Regels

### Frontend Validatie (voor submit):

#### NieuwProject:
```typescript
const validateNieuwProject = (data: NieuwProjectData): string[] => {
  const errors: string[] = [];

  if (!data.projectHeader.klantId) {
    errors.push('Klant is verplicht');
  }

  if (!data.projectHeader.projectVolgnummer) {
    errors.push('Projectvolgnummer is verplicht');
  } else if (!/^\d{2}$/.test(data.projectHeader.projectVolgnummer)) {
    errors.push('Projectvolgnummer moet 2 cijfers zijn');
  }

  if (!data.projectHeader.deadline) {
    errors.push('Deadline is verplicht');
  } else if (new Date(data.projectHeader.deadline) <= new Date()) {
    errors.push('Deadline moet in de toekomst zijn');
  }

  if (!data.projecttype) {
    errors.push('Projecttype is verplicht');
  }

  if (!data.fases || data.fases.length === 0) {
    errors.push('Minimaal 1 fase is verplicht');
  }

  data.fases.forEach((fase, index) => {
    if (!fase.naam) {
      errors.push(`Fase ${index + 1}: Naam is verplicht`);
    }
    if (!fase.medewerkers || fase.medewerkers.length === 0) {
      errors.push(`Fase ${index + 1}: Minimaal 1 medewerker is verplicht`);
    }
    if (!fase.inspanningDagen || fase.inspanningDagen <= 0) {
      errors.push(`Fase ${index + 1}: Inspanning moet > 0 zijn`);
    }
  });

  return errors;
};
```

#### Meeting:
```typescript
const validateMeeting = (data: MeetingData): string[] => {
  const errors: string[] = [];

  if (!data.projectId) {
    errors.push('Project is verplicht');
  }

  if (!data.onderwerp || data.onderwerp.length < 5) {
    errors.push('Onderwerp is verplicht (min 5 karakters)');
  }

  if (!data.deelnemers || data.deelnemers.length === 0) {
    errors.push('Minimaal 1 deelnemer is verplicht');
  }

  if (!data.locatie) {
    errors.push('Locatie is verplicht');
  }

  if (data.locatie === 'Bij klant' && !data.reistijd) {
    errors.push('Reistijd is verplicht bij meeting bij klant');
  }

  return errors;
};
```

#### Wijziging:
```typescript
const validateWijziging = (data: WijzigingData): string[] => {
  const errors: string[] = [];

  if (!data.projectId) {
    errors.push('Project is verplicht');
  }

  if (!data.wijzigingsType) {
    errors.push('Type wijziging is verplicht');
  }

  if (!data.reden || data.reden.length < 20) {
    errors.push('Reden is verplicht (min 20 karakters)');
  }

  if (!data.huidigeSituatie || data.huidigeSituatie.length < 20) {
    errors.push('Huidige situatie is verplicht (min 20 karakters)');
  }

  if (!data.gewensteSituatie || data.gewensteSituatie.length < 20) {
    errors.push('Gewenste situatie is verplicht (min 20 karakters)');
  }

  if (!data.urgentie) {
    errors.push('Urgentie is verplicht');
  }

  return errors;
};
```

#### Verlof:
```typescript
const validateVerlof = (data: VerlofData): string[] => {
  const errors: string[] = [];

  if (!data.medewerkerId) {
    errors.push('Medewerker is verplicht');
  }

  if (!data.startDatum) {
    errors.push('Startdatum is verplicht');
  } else if (new Date(data.startDatum) < new Date()) {
    errors.push('Startdatum kan niet in het verleden zijn');
  }

  if (!data.eindDatum) {
    errors.push('Einddatum is verplicht');
  } else if (data.startDatum && new Date(data.eindDatum) < new Date(data.startDatum)) {
    errors.push('Einddatum moet na startdatum zijn');
  }

  if (!data.verlofType) {
    errors.push('Verloftype is verplicht');
  }

  if (!data.verlofCategorie) {
    errors.push('Verlofcategorie is verplicht');
  }

  return errors;
};
```

---

## 7. Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                      USER FILLS TEMPLATE                        │
│  (NieuwProject / Meeting / Wijziging / Verlof)                │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     │ Submit button clicked
                     ▼
┌────────────────────────────────────────────────────────────────┐
│                   FRONTEND VALIDATION                           │
│  - Check required fields                                       │
│  - Validate formats (dates, numbers)                           │
│  - Business logic (deadline > today, etc.)                     │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     │ If valid
                     ▼
┌────────────────────────────────────────────────────────────────┐
│              WORKFLOW TRIGGERS (Automation)                     │
│  Parallel data fetching:                                       │
│  ├─ fetchOutlookCalendars(teamMembers)                         │
│  ├─ fetchVerlof(teamMembers)                                   │
│  ├─ fetchBeschikbaarheid(teamMembers)                          │
│  ├─ fetchKlantConstraints(klantId)                             │
│  └─ fetchCurrentWorkload(teamMembers)                          │
│                                                                 │
│  Duration: ~2-5 seconds                                        │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     │ All data collected
                     ▼
┌────────────────────────────────────────────────────────────────┐
│                   ELLEN IS TRIGGERED                            │
│  Input:                                                         │
│  {                                                              │
│    template: { ... template data ... },                        │
│    calendars: { ... outlook data ... },                        │
│    verlof: [ ... verlof records ... ],                         │
│    availability: { ... werkuren ... },                         │
│    klantConstraints: { beschikbaarheid: {...} },               │
│    workload: { ... huidige projecten ... }                     │
│  }                                                              │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     │ Ellen analyzes
                     ▼
┌────────────────────────────────────────────────────────────────┐
│                   ELLEN PROCESSING                              │
│  1. Load context (get_current_projects, etc.)                  │
│  2. Analyze constraints                                        │
│  3. Calculate capacity                                         │
│  4. Generate 2-3 proposals                                     │
│  5. Format response with rationale                             │
│                                                                 │
│  Uses tools: get_employee_capacity,                            │
│              check_deadline_feasibility, etc.                  │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     │ Proposals ready
                     ▼
┌────────────────────────────────────────────────────────────────┐
│              ELLEN CHAT UI - SHOW PROPOSALS                     │
│                                                                 │
│  Ellen: "Ik heb 3 voorstellen voor dit project:               │
│                                                                 │
│  📋 VOORSTEL 1: Optimaal (deadline 1 maart)                    │
│    - Sarah: week 5-6 (concept, 3 dagen)                       │
│    - Mark: week 7-8 (productie, 5 dagen)                      │
│    - Lisa: week 9 (edit, 2 dagen)                             │
│    - Presentaties: week 6, week 8, week 10                    │
│    ✅ Binnen deadline                                          │
│    ⚠️ Mark is week 7 al 70% bezet                             │
│                                                                 │
│  [Accepteer Voorstel 1] [Bekijk Voorstel 2] [Aanpassen]"      │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     │ User clicks "Accepteer"
                     ▼
┌────────────────────────────────────────────────────────────────┐
│                   CONFIRMATION DIALOG                           │
│                                                                 │
│  ⚠️ Je gaat de volgende wijzigingen doorvoeren:               │
│                                                                 │
│  • Nieuw project aanmaken: "Selmore_12345601"                 │
│  • 10 planning blokken aanmaken                                │
│  • 3 presentaties inplannen                                    │
│  • Status: CONCEPT (doorzichtig in planner)                   │
│                                                                 │
│  [Annuleren]  [Bevestigen]                                     │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     │ User confirms
                     ▼
┌────────────────────────────────────────────────────────────────┐
│                DATABASE MUTATIONS (RLS Protected)               │
│  1. Insert into projecten                                      │
│  2. Insert into project_fases                                  │
│  3. Insert into taken (planning blocks)                        │
│  4. Insert into meetings & presentaties                        │
│  5. Set status = 'concept'                                     │
│                                                                 │
│  Transaction: All or nothing                                   │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     │ Success
                     ▼
┌────────────────────────────────────────────────────────────────┐
│                   SUCCESS FEEDBACK                              │
│                                                                 │
│  ✅ Planning aangemaakt!                                       │
│                                                                 │
│  Project "Selmore_12345601" staat nu in de planner.           │
│  Status: CONCEPT (doorzichtig)                                │
│                                                                 │
│  Volgende stappen:                                             │
│  1. Bespreek planning met klant                                │
│  2. Klik "Planning Vast" als klant akkoord is                 │
│                                                                 │
│  [Naar Planner]  [Nieuw Project]                               │
└────────────────────────────────────────────────────────────────┘
```

---

## 8. UI/UX Requirements

### 8.1 Consistent Button Placement

**Alle templates:**
```
[Annuleren]  [Opslaan als Concept]  [Vraag Ellen]
```

**Quick Add templates (Meeting ad-hoc):**
```
[Annuleren]  [Quick Add]  [Vraag Ellen]
```

### 8.2 Loading States

**During workflow triggers:**
```
┌──────────────────────────────────────────────┐
│  ⏳ Data ophalen...                          │
│                                               │
│  ✅ Agenda's geladen                         │
│  ✅ Verlof gecontroleerd                     │
│  ⏳ Beschikbaarheid checken...               │
│  ⏳ Huidige workload ophalen...              │
│                                               │
│  [Annuleren]                                  │
└──────────────────────────────────────────────┘
```

**During Ellen processing:**
```
┌──────────────────────────────────────────────┐
│  🤖 Ellen aan het werk...                    │
│                                               │
│  Planning mogelijkheden aan het berekenen... │
│                                               │
│  Dit kan 10-30 seconden duren.               │
└──────────────────────────────────────────────┘
```

### 8.3 Error Handling

**Validation errors:**
```
┌──────────────────────────────────────────────┐
│  ❌ Kan niet indienen                        │
│                                               │
│  • Deadline is verplicht                     │
│  • Fase "Productie" heeft geen medewerkers   │
│  • Projectvolgnummer moet 2 cijfers zijn     │
│                                               │
│  [OK]                                         │
└──────────────────────────────────────────────┘
```

**Ellen errors:**
```
┌──────────────────────────────────────────────┐
│  ⚠️ Ellen kan geen planning maken            │
│                                               │
│  Reden: Team heeft onvoldoende capaciteit    │
│  in week 5-8 voor deze deadline.             │
│                                               │
│  Opties:                                      │
│  • Deadline verschuiven naar 15 maart        │
│  • Externe resources inzetten                │
│  • Andere projecten uitstellen               │
│                                               │
│  [Terug]  [Aanpassen]                        │
└──────────────────────────────────────────────┘
```

### 8.4 Status Indicators

**In Planner:**

CONCEPT status (doorzichtig):
```css
.planning-block-concept {
  background: rgba(59, 130, 246, 0.3); /* 30% opacity */
  border: 2px dashed rgb(59, 130, 246);
}
```

VAST status (vol):
```css
.planning-block-vast {
  background: rgb(59, 130, 246); /* 100% opacity */
  border: 2px solid rgb(37, 99, 235);
}
```

### 8.5 Responsive Design

**Mobile considerations:**
- Templates should be scrollable
- Ellen chat should be full-screen on mobile
- Confirmation dialogs should be bottom-sheet style
- Dropdown menus should use native selects on mobile

### 8.6 Accessibility

- All form fields must have labels
- Error messages must be associated with fields (aria-describedby)
- Focus management in modals
- Keyboard navigation support
- Screen reader friendly status updates

---

## Summary: Implementation Priority

### Phase 1: Critical Updates (Before Wizard of Oz)

1. ✅ **Meeting.tsx**: Replace klanten dropdown with ProjectSelector
2. ✅ **Meeting.tsx**: Add locatie + reistijd fields
3. ✅ **Wijzigingsverzoek.tsx**: Add all context fields (reden, huidige/gewenste situatie, urgentie)
4. ✅ **Verlof.tsx**: Add verlofCategorie + backupPersoon
5. ✅ **Database**: Add `beschikbaarheid` column to `klanten` table
6. ✅ **Client Form**: Add beschikbaarheid UI

### Phase 2: Data Flow (Before Wizard of Oz)

7. ✅ Verify all template data is correctly passed to automation service
8. ✅ Test data structure matches Ellen's expected input
9. ✅ Create mock Ellen responses for Wizard of Oz testing

### Phase 3: Wizard of Oz Testing

10. ⏳ Human operator tests all workflows
11. ⏳ Refine templates based on feedback
12. ⏳ Document edge cases discovered

### Phase 4: Build Real Ellen

13. ⏳ Implement Ellen backend (Supabase Edge Function + Claude)
14. ⏳ Implement Ellen tools
15. ⏳ Connect frontend to real Ellen
16. ⏳ Testing and deployment

---

**Last Updated**: 2024-01-28
**Version**: 1.0
**Status**: Ready for implementation Phase 1
