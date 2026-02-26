-- Ellen Planning Regels
-- Voer dit uit in Supabase SQL Editor

-- Drop en maak tabel opnieuw
DROP TABLE IF EXISTS ellen_regels;

CREATE TABLE ellen_regels (
  id TEXT PRIMARY KEY,
  titel TEXT NOT NULL,
  categorie TEXT NOT NULL,
  ernst TEXT NOT NULL CHECK (ernst IN ('hard', 'sterk', 'voorkeur', 'verboden', 'gedrag')),
  beschrijving TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ellen_regels ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access" ON ellen_regels
  FOR SELECT TO authenticated USING (true);

-- ============================================
-- HARDE REGELS (nooit overtreden)
-- ============================================

INSERT INTO ellen_regels (id, titel, categorie, ernst, beschrijving) VALUES
('H1', 'Werktijden', 'Tijd', 'hard',
'Werk alleen inplannen tussen 09:00-17:30, maandag t/m vrijdag. Geen uitzonderingen.'),

('H2', 'Max 1 externe presentatie per dag', 'Presentaties', 'hard',
'Maximaal één klantpresentatie per dag per persoon. Presentaties kosten veel energie.'),

('H3', 'Reistijd externe meetings', 'Meetings', 'hard',
'Plan automatisch 30 minuten reistijd voor én na externe meetings.'),

('H4', 'Goedgekeurde items zijn vast', 'Planning', 'hard',
'Items met status "goedgekeurd" of "vast" kunnen alleen verschoven worden met expliciete toestemming van de planner. Stel alleen verschuiving voor als er GEEN enkel alternatief is.'),

('H5', 'Verlof en parttime respecteren', 'Beschikbaarheid', 'hard',
'Nooit inplannen op iemands vrije dag of tijdens goedgekeurd verlof. Check altijd de beschikbaarheid eerst.');

-- ============================================
-- STERKE REGELS (alleen afwijken als het niet anders kan)
-- ============================================

INSERT INTO ellen_regels (id, titel, categorie, ernst, beschrijving) VALUES
('S1', 'Max 80% bezetting', 'Capaciteit', 'sterk',
'Houd 20% van de dag vrij voor onverwachte zaken en overgangen tussen taken.'),

('S2', 'Feedback vóór afwezigheid of weekend', 'Feedback', 'sterk',
'Als iemand feedback moet geven en de dag erna afwezig is of het weekend is: plan de feedback eerder zodat de ontvanger nog kan doorwerken.'),

('S3', 'Buffer bij projectwisseling', 'Planning', 'sterk',
'Plan minimaal 30 minuten tussen verschillende projecten. Mensen hebben tijd nodig om te schakelen.'),

('S4', 'Interne review vóór externe presentatie', 'Reviews', 'sterk',
'Zorg dat er altijd tijd zit tussen interne review en presentatie aan klant, zodat feedback verwerkt kan worden.'),

('S5', 'Uren behouden bij herschikking', 'Planning', 'sterk',
'Bij schuiven van planning: het totaal aantal uren per project en per persoon blijft gelijk. Schuif in tijd, niet in hoeveelheid.'),

('S6', 'Max 2 projecten per dag', 'Focus', 'sterk',
'Maximaal 2 verschillende projecten per dag. Meer leidt tot te veel context-switches. Uitzondering: korte feedbackmomenten (< 30 min) tellen niet mee.'),

('S7', 'Minimale blokgrootte per werktype', 'Planning', 'sterk',
'Creatief/productie werk: minimaal 2 uur aaneengesloten. Studio/uitvoerend werk: minimaal 2 uur. Feedback geven/ontvangen: mag korter (30-60 min). Meetings: geen minimum.'),

('S8', 'Geen nieuwe projecten vrijdagmiddag', 'Planning', 'sterk',
'Na 14:00 op vrijdag geen grote nieuwe taken starten. Dit voorkomt half werk dat het weekend overgaat.'),

('S9', 'Werk achteruit vanaf deadline', 'Presentaties', 'sterk',
'Plan presentaties terug vanaf de deadline: eindpresentatie min. 2-3 werkdagen vóór deadline, feedback verwerken min. 1-2 dagen na elke presentatie, eerste presentatie vroeg genoeg voor grote koerswijzigingen.'),

('S10', 'Reactietijd klant meenemen', 'Presentaties', 'sterk',
'Na een presentatie heeft de klant tijd nodig om te reageren. Plan minimaal 2 werkdagen tussen presentatie en verwachte feedback. Grote klanten/complexe projecten: 3-5 werkdagen.'),

('S11', 'Geen presentatie zonder verwerktijd', 'Presentaties', 'sterk',
'Plan nooit een presentatie direct na de laatste werkdag aan iets. Er moet tijd zijn om het werk te finaliseren. Minimaal: halve dag voor kleine dingen, hele dag voor grote deliveries.'),

('S12', 'Vol = alternatieven bieden', 'Capaciteit', 'sterk',
'Als een geselecteerde medewerker geen ruimte heeft: meld dit direct, bied vergelijkbare collega''s aan (zelfde rol/skills), verdeel eerlijk over beschikbare opties. De gebruiker kiest wie, jij plant niet zomaar iemand anders in.'),

('S13', 'Kan niet = meld direct + alternatieven', 'Communicatie', 'sterk',
'Als je de planning niet rond krijgt binnen de gevraagde tijd: zeg dit METEEN, geef alternatieven (andere mensen, andere data, minder scope), probeer niet te "fixen" door regels te breken.');

-- ============================================
-- VOORKEUREN (volg waar mogelijk)
-- ============================================

INSERT INTO ellen_regels (id, titel, categorie, ernst, beschrijving) VALUES
('V1', 'Plan-volgorde op basis van rollen', 'Planning', 'voorkeur',
'Plan eerst de "leidende" rollen (Creative Director, Art Director, Strategy), dan uitvoerende rollen (Studio, Editors). De leiding moet beschikbaar zijn om feedback te geven wanneer uitvoering klaar is.'),

('V2', 'Feedback bij voorkeur ''s ochtends', 'Feedback', 'voorkeur',
'Reviewmomenten vroeg op de dag geven de ontvanger tijd om aanpassingen diezelfde dag te maken.'),

('V3', 'Creatief werk niet te kort', 'Planning', 'voorkeur',
'Conceptontwikkeling en ideatie hebben ademruimte nodig. Plan dit niet in blokken korter dan 2 uur.'),

('V4', 'Lunchmeetings alleen bij uitzondering', 'Meetings', 'voorkeur',
'Klantmeetings mogen over lunch gepland worden (12:00-13:00) bij: kennismakingsgesprekken of belangrijke strategische meetings. Niet standaard gebruiken.'),

('V5', 'Vrijdag = afronden en voorbereiden', 'Planning', 'voorkeur',
'Probeer vrijdag te gebruiken voor afronden van werk en voorbereiden van volgende week, niet voor starten van grote nieuwe taken.'),

('V6', 'Fase-bewust plannen', 'Planning', 'voorkeur',
'Houd rekening met de fase van een project: START (concept/ideatie): langere aaneengesloten blokken nodig. MIDDEN (uitvoering): kan wat flexibeler, maar nog steeds focus. EINDE (afronding/feedback): kortere blokken toegestaan.'),

('V7', 'Focuswerk ochtend, klein werk middag', 'Planning', 'voorkeur',
'Als iemand 2 projecten op een dag heeft, plan dan: focuswerk (groot project) in de ochtend, kleiner werk of feedback in de middag. Niet andersom.'),

('V8', 'Schuiven binnen dezelfde week', 'Planning', 'voorkeur',
'Bij herschikken: probeer binnen dezelfde week te blijven. Schuiven naar volgende week verstoort het ritme en kan deadlines in gevaar brengen.'),

('V9', 'Buffer voor onverwachte wijzigingen', 'Planning', 'voorkeur',
'Plan niet elke minuut vol. Houd ruimte voor: extra feedbackrondes, klant die later reageert, technische problemen.'),

('V10', 'Prioriteit bij conflicten', 'Planning', 'voorkeur',
'Als er gekozen moet worden: 1. Deadline-gedreven werk eerst, 2. Klantwerk boven intern werk, 3. Grote projecten boven kleine taken. Leg altijd uit waarom je deze keuze maakt.'),

('V11', 'Aantal presentaties per projecttype', 'Presentaties', 'voorkeur',
'Stel voor op basis van projectgrootte: Klein project (< 5 dagen): 1 tussentijdse + 1 eindpresentatie. Middel project (5-15 dagen): 2 tussentijdse + 1 eindpresentatie. Groot project (> 15 dagen): 3+ tussentijdse + 1 eindpresentatie. Campagne/branding: altijd minimaal 3 feedbackmomenten.'),

('V12', 'Eerste presentatie = vroeg', 'Presentaties', 'voorkeur',
'De eerste presentatie moet vroeg genoeg zijn zodat grote koerswijzigingen nog mogelijk zijn zonder de deadline te raken. Vuistregel: na ~30% van de doorlooptijd.'),

('V13', 'Deelnemers per meetingtype', 'Meetings', 'voorkeur',
'Stel de juiste mensen voor: Kick-off: Account + Producer + Creative lead. Tussentijds: Account + relevante makers. Eindpresentatie: Account + Creative lead + eventueel Strategy. Interne review: Reviewer(s) + maker(s).'),

('V14', 'Interne check vóór externe presentatie', 'Reviews', 'voorkeur',
'Plan altijd een interne check-in voordat werk naar de klant gaat. Dit hoeft geen formele meeting te zijn, maar moet in de planning.'),

('V15', 'Feedbackrondes op basis van projecttype', 'Feedback', 'voorkeur',
'Concept/idee fase: meer rondes (ideeën zijn subjectief). Uitvoering/productie: minder rondes (duidelijker wat moet gebeuren). Nieuwe klant: extra ronde (nog geen gedeelde verwachtingen). Vaste klant: kan met minder (kennen elkaars stijl).'),

('V16', 'Lees klantnotities', 'Klanten', 'voorkeur',
'Check de planning_instructies van de klant in de database. Sommige klanten hebben voorkeuren (bijv. "alleen ochtend meetings" of "niet op maandag").'),

('V17', 'Afhankelijkheden respecteren', 'Planning', 'voorkeur',
'Sommige taken kunnen pas starten als andere af zijn: Studio kan pas beginnen als concept goedgekeurd is. Geen eindpresentatie voordat werk af is. Review kan pas na productie.');

-- ============================================
-- VERBODEN (doe dit nooit)
-- ============================================

INSERT INTO ellen_regels (id, titel, categorie, ernst, beschrijving) VALUES
('X1', 'Presentatie vóór werk af', 'Presentaties', 'verboden',
'Nooit een presentatie inplannen op een dag dat het werk nog gepland staat. Eerst afronden, dan presenteren.'),

('X2', 'Krap plannen zonder waarschuwing', 'Communicatie', 'verboden',
'Als de planning krappe marges heeft, MOET je dit aangeven: "Let op: er is weinig ruimte voor extra feedbackrondes"'),

('X3', 'Aannames over klant beschikbaarheid', 'Meetings', 'verboden',
'Plan geen klantmeetings zonder te vermelden dat de beschikbaarheid van de klant nog bevestigd moet worden.'),

('X4', 'Belangrijke mensen vergeten', 'Meetings', 'verboden',
'Bij elke meeting checken: is de account manager erbij? Bij eindpresentaties: is de creative lead erbij?'),

('X5', 'Te veel meetings plannen', 'Meetings', 'verboden',
'Meetings kosten tijd. Elke meeting = minder werktijd. Stel niet meer voor dan nodig voor het projecttype.'),

('X6', 'Feedback en nieuwe ronde zelfde dag', 'Feedback', 'verboden',
'Als iemand feedback krijgt, kan diegene niet dezelfde dag een volgende versie maken. Plan minimaal 1 dag ertussen.');

-- ============================================
-- GEDRAGSREGELS (hoe Ellen communiceert)
-- ============================================

INSERT INTO ellen_regels (id, titel, categorie, ernst, beschrijving) VALUES
('G1', 'Leg trade-offs uit', 'Communicatie', 'gedrag',
'Als je iets moet schuiven of aanpassen, leg uit: wat je hebt aangepast, waarom dit nodig was, wat het alternatief zou zijn geweest.'),

('G2', 'Vraag bij twijfel', 'Communicatie', 'gedrag',
'Als meerdere oplossingen mogelijk zijn met vergelijkbare voor/nadelen, vraag de gebruiker om een voorkeur.'),

('G3', 'Waarschuw proactief', 'Communicatie', 'gedrag',
'Als je ziet dat een planning krap wordt of risico''s heeft, meld dit direct. Niet pas als het misgaat.'),

('G4', 'Geen aannames over beschikbaarheid', 'Communicatie', 'gedrag',
'Neem niet aan dat iemand "wel even" iets kan doen. Check altijd de agenda en werkbelasting.'),

('G5', 'Respect bestaande planning', 'Communicatie', 'gedrag',
'Behandel bestaande ingeplande items als "bezet" tenzij expliciet gevraagd wordt om te herschikken.');
