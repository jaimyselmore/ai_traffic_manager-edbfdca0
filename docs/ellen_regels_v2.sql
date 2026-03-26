-- ═══════════════════════════════════════════════════════════════════════
-- Ellen Regels v2 — DELETE redundante regels, voeg nieuwe toe
-- Voer uit in Supabase SQL Editor
-- Resultaat: 13 actief → ~18 actief (alle inactieve weg)
-- ═══════════════════════════════════════════════════════════════════════

-- ── STAP 1: VERWIJDER alle inactieve regels (geen graveyard) ─────────
-- Inactieve regels zijn engine/core-prompt overlaps die nooit bij Ellen horen.
DELETE FROM ellen_regels WHERE actief = false;

-- ── STAP 2: VERWIJDER engine-overlaps die nog actief staan ───────────
-- (voor het geval stap 1 ze niet raakte)
-- Werktijden, verlof, hard-lock → engine handelt dit deterministisch af
DELETE FROM ellen_regels WHERE categorie = 'hard' AND prioriteit IN (1, 4, 5, 6);

-- ── STAP 3: VOEG NIEUWE regels toe die Ellen slimmer maken ───────────

-- Capacity intelligence — multi-project overload
INSERT INTO ellen_regels (categorie, prioriteit, regel, rationale, actief)
VALUES (
  'soft', 50,
  'Als dezelfde persoon op meer dan 3 projecten tegelijk staat: waarschuw voor context-switching en stel herverdeling voor',
  'Multi-project overload is een agency-probleem dat de engine niet kan beoordelen',
  true
);

-- Impact check bij nieuw inplannen
INSERT INTO ellen_regels (categorie, prioriteit, regel, rationale, actief)
VALUES (
  'soft', 51,
  'Bij een nieuw project: check altijd de impact op bestaande planningen vóór je iets inplant — benoem conflicten proactief',
  'Voorkomt het "ja, en alles elders valt om" probleem',
  true
);

-- Spoedherkenning
INSERT INTO ellen_regels (categorie, prioriteit, regel, rationale, actief)
VALUES (
  'soft', 52,
  'Als een klantdeadline minder dan 2 werkdagen weg is: markeer als spoed en vermeld dit expliciet',
  'Urgentieclassificatie die Ellen actief moet benoemen zodat de planner een beslissing kan nemen',
  true
);

-- Transparantie bij herplannen
INSERT INTO ellen_regels (categorie, prioriteit, regel, rationale, actief)
VALUES (
  'soft', 53,
  'Bij herplannen: benoem altijd wat er verschuift en wat het directe effect is op andere projecten of deadlines',
  'Transparantie maakt Ellen betrouwbaar als traffic manager — de planner moet weten wat de domino-effecten zijn',
  true
);

-- Proactieve herverdeling bij overbelasting
INSERT INTO ellen_regels (categorie, prioriteit, regel, rationale, actief)
VALUES (
  'soft', 54,
  'Als één persoon overbelast is: stel proactief voor om werk te herverdelen naar collega''s met capaciteit',
  'Dit is de kernverantwoordelijkheid van een traffic manager — niet alleen signaleren maar ook oplossing bieden',
  true
);

-- ── STAP 4: VERIFICEER RESULTAAT ─────────────────────────────────────
SELECT categorie, COUNT(*) AS actief_aantal
FROM ellen_regels
WHERE actief = true
GROUP BY categorie
ORDER BY categorie;

-- Verwacht: hard=2, soft=10-11, voorkeur=4-6 ≈ 18 totaal

SELECT categorie, prioriteit, regel
FROM ellen_regels
WHERE actief = true
ORDER BY categorie, prioriteit;
