# Login Fix - Gebruikersnaam Implementatie

## Status
✅ Code aangepast (lokaal + gepusht naar GitHub)
⏳ Database migratie nodig (SQL script uitvoeren in Supabase)
⏳ Edge function deployment (automatisch via GitHub push)

## Wat is er aangepast?

### 1. Edge Function: `supabase/functions/custom-login/index.ts`
- Accepteert nu `username` parameter in plaats van alleen `email`
- Zoekt gebruiker op basis van `gebruikersnaam` kolom (met email als fallback)
- Alle error messages aangepast naar "gebruikersnaam"

### 2. Frontend: `src/contexts/AuthContext.tsx`
- `signIn` functie accepteert nu `username` parameter
- Stuurt `username` naar edge function

### 3. Frontend: `src/pages/Login.tsx`
- Label aangepast naar "Gebruikersnaam"
- Input placeholder: "jaimywals"
- Gebruikt `username` state variable

### 4. SQL Script: `backend/scripts/fix-rls-policies.sql`
- Bevat migration om `gebruikersnaam` kolom toe te voegen aan users tabel
- Migreert bestaande email data (verwijdert @selmore.com)
- Bevat ook RLS policy fixes voor security

## Stappen om login werkend te maken

### Stap 1: Run SQL Migratie Script in Supabase ⚠️ BELANGRIJK

1. **Open Supabase Dashboard**
   - Ga naar https://supabase.com/dashboard
   - Open project: mrouohttlvirnvmdmwqj

2. **Open SQL Editor**
   - Klik op "SQL Editor" in het linkermenu
   - Klik op "New query"

3. **Kopieer en plak het script**
   - Open bestand: `backend/scripts/fix-rls-policies.sql`
   - Kopieer de VOLLEDIGE inhoud
   - Plak in de SQL Editor

4. **Voer het script uit**
   - Klik op "Run" (of Cmd/Ctrl + Enter)
   - Wacht tot alle queries zijn uitgevoerd
   - Check de output onderaan - je zou geen errors moeten zien

5. **Verifieer de migratie**
   De laatste queries in het script tonen:
   - Alle RLS policies (moet policies voor users en klanten tonen)
   - Alle users met hun gebruikersnaam waarde (moet @selmore.com verwijderd hebben)

### Stap 2: Controleer Edge Function Deployment

De edge function is automatisch gedeployed via GitHub push. Check of deze actief is:

1. **Open Supabase Dashboard → Edge Functions**
2. **Zoek "custom-login"**
3. **Check deployment status** - moet "Deployed" zijn
4. **Als niet deployed:** Klik op "Deploy" of wacht 1-2 minuten

### Stap 3: Test de Login

1. **Open de applicatie** (Lovable preview of lokaal)
2. **Ga naar login pagina**
3. **Test met:**
   - Gebruikersnaam: `jaimywals` (zonder @selmore.com)
   - Wachtwoord: `selmore2026`

4. **Verwacht resultaat:**
   - ✅ Succesvol inloggen
   - ✅ Redirect naar dashboard
   - ✅ Zie "Welkom, Jaimy" (of andere naam)

### Stap 4: Test met andere gebruikers

Test ook met andere planner accounts (als deze bestaan in de database)

## Troubleshooting

### Error: "Ongeldige gebruikersnaam of wachtwoord"

**Mogelijke oorzaken:**
1. SQL script is nog niet uitgevoerd → Ga naar Stap 1
2. Gebruikersnaam kolom bestaat maar is leeg → Check in Supabase Table Editor:
   - Open "users" tabel
   - Check of kolom "gebruikersnaam" bestaat
   - Check of waarden gevuld zijn (zonder @selmore.com)

**Fix:**
```sql
-- Voer dit uit in SQL Editor als gebruikersnaam kolom leeg is:
UPDATE users 
SET gebruikersnaam = REPLACE(email, '@selmore.com', '')
WHERE email IS NOT NULL AND gebruikersnaam IS NULL;
```

### Error: Column "gebruikersnaam" does not exist

**Oorzaak:** SQL script niet uitgevoerd
**Fix:** Ga terug naar Stap 1 en voer het volledige script uit

### Edge function geeft 500 error

**Oorzaak:** Edge function niet correct gedeployed
**Fix:** 
1. Check Supabase Dashboard → Edge Functions → custom-login
2. Klik op "Deploy" als status niet "Deployed" is
3. Check logs voor errors

### Login werkt nog steeds met email

**Dit is OK!** De edge function accepteert beide:
- ✅ `jaimywals` (zonder @selmore.com) ← NIEUW
- ✅ `jaimywals@selmore.com` ← Werkt ook nog

## Technische Details

### Database Schema Wijziging
```sql
ALTER TABLE users 
ADD COLUMN gebruikersnaam TEXT UNIQUE;

UPDATE users 
SET gebruikersnaam = REPLACE(email, '@selmore.com', '')
WHERE email IS NOT NULL;
```

### Edge Function Query
```typescript
// VOOR:
.eq('email', email.toLowerCase().trim())

// NA:
.or(`gebruikersnaam.eq.${loginIdentifier},email.eq.${loginIdentifier}`)
```

### Frontend Changes
```typescript
// VOOR:
signIn: (email: string, password: string)
body: { email, password }

// NA:
signIn: (username: string, password: string)
body: { username, password }
```

## Verwachte Testdata

Na het uitvoeren van het SQL script:

| Naam | Email (oud) | Gebruikersnaam (nieuw) |
|------|-------------|------------------------|
| Jaimy | jaimywals@selmore.com | jaimywals |
| Andere planners | email@selmore.com | email |

## Volgende Stappen (na succesvolle login)

1. ✅ Login werkt met gebruikersnaam
2. → Test Admin panel (Medewerkers, Rollen, Disciplines, Klanten tabs)
3. → Verify dat CRUD operaties werken
4. → Test RLS policies (security)

## Support

Als er problemen zijn:
1. Check Supabase logs (Database → Logs)
2. Check Edge Function logs (Edge Functions → custom-login → Logs)
3. Check browser console (F12 → Console tab)
4. Deel error messages voor debugging
