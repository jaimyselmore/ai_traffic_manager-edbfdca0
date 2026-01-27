# Project Titel Migratie

Deze migratie voegt project titels toe aan bestaande projecten.

## Stappen

### 1. Database Schema Updaten

Voer eerst het SQL migration script uit in Supabase SQL Editor:

```bash
# Open Supabase Dashboard → SQL Editor
# Plak en run: backend/migrations/add-titel-column.sql
```

Dit voegt de `titel` kolom toe aan beide `projecten` en `taken` tabellen.

### 2. Genereer Titels voor Bestaande Projecten

Run het TypeScript migratie script:

```bash
npm run migrate:titles
```

Of handmatig:

```bash
npx ts-node scripts/generate-project-titles.ts
```

### 3. Verifieer Resultaten

Check in Supabase SQL Editor:

```sql
-- Check projecten met titels
SELECT id, titel, projectnummer, klant_id
FROM projecten
WHERE titel IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Check hoeveel projecten nog geen titel hebben
SELECT COUNT(*) as projecten_zonder_titel
FROM projecten
WHERE titel IS NULL;
```

## Wat Doet De Migratie?

1. Haalt alle projecten op zonder `titel`
2. Voor elk project:
   - Haalt klantnaam op uit relatie
   - Combineert: `{klantnaam}_{projectnummer}`
   - Voorbeeld: "Selmore_12345601"
   - Slaat titel op in database
3. Toont samenvatting van resultaten

## Troubleshooting

### "Missing Supabase credentials"

Zorg dat `.env.local` bestaat met:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

### "No client relation found"

Sommige projecten hebben mogelijk geen klant relatie. Deze worden overgeslagen.

### "No projectnummer found"

Project mist projectnummer field. Deze worden overgeslagen.

## Rollback

Als de migratie moet worden teruggedraaid:

```sql
-- Verwijder titels
UPDATE projecten SET titel = NULL;
UPDATE taken SET project_titel = NULL;

-- Verwijder kolommen (optioneel)
ALTER TABLE projecten DROP COLUMN IF EXISTS titel;
ALTER TABLE taken DROP COLUMN IF EXISTS project_titel;
```
