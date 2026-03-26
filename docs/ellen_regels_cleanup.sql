-- Ellen Regels Cleanup — deactiveer engine-beheerde en redundante regels
-- Voer uit in Supabase SQL Editor
-- Resultaat: 42 → 15 regels (binnen LLM reliability range)

-- ── DEACTIVEER: engine doet dit al ────────────────────────────────────────────
UPDATE ellen_regels SET actief = false WHERE categorie = 'hard' AND prioriteit = 1;
-- Werktijden 09:00-17:30 → config.werkdag_start/eind handelt dit

UPDATE ellen_regels SET actief = false WHERE categorie = 'hard' AND prioriteit = 4;
-- goedgekeurd/vast niet verschuiven → CORE_PROMPT: "Hard-locked taken: alleen eigenaar mag wijzigen"

UPDATE ellen_regels SET actief = false WHERE categorie = 'hard' AND prioriteit IN (5, 6);
-- Verlof/vrije dag → heeftVerlofSync() in engine checkt dit al

UPDATE ellen_regels SET actief = false WHERE categorie = 'soft' AND prioriteit = 18;
-- Plan terug vanaf deadline → engine doet deadline-anchoring nu

-- ── DEACTIVEER: te vaag of micro voor LLM ────────────────────────────────────
UPDATE ellen_regels SET actief = false WHERE categorie = 'soft' AND prioriteit IN (7, 9, 11, 12, 14, 16, 17, 19, 20, 22);
-- 7: klantmeetings beschikbaarheid bevestigen → vage communicatieregel
-- 9: niet meer meetings dan nodig → te vaag, wanneer is dat?
-- 11: feedback voor weekend → low impact
-- 12: 30 min buffer projecten → LLM kan dit niet betrouwbaar toepassen
-- 14: bij schuiven uren behouden → te micro
-- 16: creatief min 2u → voorkeur 32 zegt hetzelfde
-- 17: na 14:00 vrijdag niet starten → low impact
-- 19: klant feedback 2 werkdagen → LLM controleert dit niet
-- 20: presentatie buffer → engine handelt dit af
-- 22: planning niet past melden → duplicaat van 21

UPDATE ellen_regels SET actief = false WHERE categorie = 'voorkeur' AND prioriteit IN (33, 36, 38, 39, 40, 41);
-- 33: lunchmeetings → te niche
-- 36: schuiven binnen zelfde week → te micro
-- 38: eerste presentatie na 30% → LLM past dit niet betrouwbaar toe
-- 39: kick-off attendees → low impact
-- 40: interne check voor klant → te vaag
-- 41: check planning_instructies → engine laadt dit al automatisch

-- ── VERIFICEER RESULTAAT ──────────────────────────────────────────────────────
SELECT categorie, COUNT(*) as actief_aantal
FROM ellen_regels
WHERE actief = true
GROUP BY categorie
ORDER BY categorie;

-- Verwacht: hard=2, soft=7, voorkeur=6 = 15 totaal

SELECT categorie, prioriteit, regel
FROM ellen_regels
WHERE actief = true
ORDER BY categorie, prioriteit;
