# ProjectSelector Component

Component voor het selecteren van bestaande projecten. Gebruikt in meeting/presentatie templates waar je een bestaand project wilt koppelen in plaats van een nieuw project aan te maken.

## Gebruik

### Basic Voorbeeld

```tsx
import { ProjectSelector, ProjectSelectorData, emptyProjectSelectorData } from '@/components/forms/ProjectSelector';
import { useState } from 'react';

function MeetingTemplate() {
  const [projectData, setProjectData] = useState<ProjectSelectorData>(emptyProjectSelectorData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <ProjectSelector
      value={projectData.projectId}
      onChange={(data) => setProjectData(data || emptyProjectSelectorData)}
      error={errors.projectId}
    />
  );
}
```

### Met Filter op Status

```tsx
// Alleen projecten met status "vast" tonen
<ProjectSelector
  value={projectData.projectId}
  onChange={handleProjectChange}
  filterStatus="vast"
  label="Selecteer actief project"
  placeholder="Kies een project"
/>
```

## Props

| Prop | Type | Default | Beschrijving |
|------|------|---------|--------------|
| `value` | `string?` | - | Geselecteerd project ID |
| `onChange` | `(data: ProjectSelectorData \| null) => void` | - | Callback bij selectie |
| `error` | `string?` | - | Error message om te tonen |
| `label` | `string?` | "Selecteer project *" | Label boven dropdown |
| `placeholder` | `string?` | "Kies een bestaand project" | Placeholder tekst |
| `filterStatus` | `'concept' \| 'vast' \| 'afgerond'?` | - | Filter op project status |

## ProjectSelectorData Interface

```typescript
interface ProjectSelectorData {
  projectId: string;        // UUID van project
  projectTitel: string;     // "Selmore_12345601"
  projectNummer: string;    // "12345601"
  klantId: string;         // UUID van klant
  klantNaam: string;       // "Selmore"
  omschrijving: string;    // Project beschrijving
}
```

## Use Cases

### 1. Meeting Inplannen voor Bestaand Project

```tsx
function MeetingForm() {
  const [formData, setFormData] = useState({
    project: emptyProjectSelectorData,
    meetingType: 'presentatie',
    datum: '',
    tijd: '',
    deelnemers: [],
  });

  const handleSubmit = async () => {
    // Gebruik projectTitel in de meeting
    await createMeeting({
      project_id: formData.project.projectId,
      project_titel: formData.project.projectTitel,
      meeting_type: formData.meetingType,
      // ...
    });
  };

  return (
    <>
      <ProjectSelector
        value={formData.project.projectId}
        onChange={(data) => setFormData({ ...formData, project: data || emptyProjectSelectorData })}
      />
      {/* Andere meeting velden */}
    </>
  );
}
```

### 2. Presentatie Template

```tsx
function PresentatieTemplate() {
  const [projectData, setProjectData] = useState<ProjectSelectorData>(emptyProjectSelectorData);

  return (
    <>
      <ProjectSelector
        value={projectData.projectId}
        onChange={setProjectData}
        filterStatus="vast" // Alleen vaste projecten
        label="Project voor presentatie *"
      />

      {/* Toon project info */}
      {projectData.projectId && (
        <div>
          <h3>Presentatie voor: {projectData.projectTitel}</h3>
          <p>Klant: {projectData.klantNaam}</p>
        </div>
      )}
    </>
  );
}
```

### 3. Wijziging Template

```tsx
function WijzigingTemplate() {
  const [projectData, setProjectData] = useState<ProjectSelectorData>(emptyProjectSelectorData);

  return (
    <ProjectSelector
      value={projectData.projectId}
      onChange={setProjectData}
      label="Welk project wil je wijzigen? *"
      placeholder="Selecteer project om te wijzigen"
    />
  );
}
```

## Features

✅ **Automatisch titel weergave** - Toont project titel (bijv. "Selmore_12345601") of fallback naar klant + nummer
✅ **Zoekbaar** - Dropdown is doorzoekbaar
✅ **Loading state** - Toont loader tijdens data ophalen
✅ **Empty state** - Toont bericht als geen projecten gevonden
✅ **Error handling** - Kan error messages tonen
✅ **Status filtering** - Filter op concept/vast/afgerond
✅ **Project info preview** - Toont geselecteerd project onder dropdown

## Database Query

Haalt projecten op met:
- Project details (id, nummer, titel, omschrijving)
- Klant naam via relatie
- Gesorteerd op nieuwste eerst

```sql
SELECT
  projecten.*,
  klanten.naam,
  klanten.klantnummer
FROM projecten
LEFT JOIN klanten ON projecten.klant_id = klanten.id
WHERE status = 'vast' -- optioneel
ORDER BY created_at DESC
```

## Verschil met ProjectHeader

| Aspect | ProjectHeader | ProjectSelector |
|--------|--------------|-----------------|
| **Doel** | Nieuw project aanmaken | Bestaand project selecteren |
| **Input** | Klant + volgnummer | Dropdown met projecten |
| **Output** | Nieuwe project data | Bestaande project data |
| **Titel** | Wordt gegenereerd | Wordt opgehaald |
| **Gebruik** | Nieuw Project template | Meeting/Presentatie templates |
