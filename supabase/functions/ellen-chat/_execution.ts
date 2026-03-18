// ===== TOOL UITVOERING =====
// Alle tool-implementaties. Elke tool is een eigen case, makkelijk te vinden en aan te passen.

import { PlanningConfig, SupabaseClient } from './_types.ts';
import {
  getMonday, getDayOfWeekNumber, isWeekend,
  bepaalDiscipline, isMeetingFase, isFeedbackFase,
  findBestNameMatch,
  PlanningContext,
  heeftVerlofSync, isParttimeDagSync,
  vindEersteVrijeSlotSync, vindMeetingSlotSync,
  registreerBlokInContext,
} from './_planning.ts';

function sanitize(term: string): string {
  return term.replace(/[,().\\]/g, '').substring(0, 100);
}

export async function executeTool(
  supabase: SupabaseClient,
  config: PlanningConfig,
  toolName: string,
  // deno-lint-ignore no-explicit-any
  args: Record<string, any>
): Promise<string> {
  try {
    switch (toolName) {

      // ── ZOEKEN ──────────────────────────────────────────────────────────────

      case 'zoek_klanten': {
        const term = sanitize(args.zoekterm || '');
        const { data, error } = await supabase
          .from('klanten')
          .select('id, klantnummer, naam, contactpersoon, email, telefoon, adres, beschikbaarheid, interne_notities, planning_instructies')
          .or(`naam.ilike.%${term}%,klantnummer.ilike.%${term}%`)
          .limit(10);
        if (error) return `Fout: ${error.message}`;
        if (!data?.length) return 'Geen klanten gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'zoek_projecten': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase
          .from('projecten')
          .select('id, projectnummer, omschrijving, projecttype, deadline, status, datum_aanvraag, opmerkingen');
        if (args.zoekterm) query = query.or(`projectnummer.ilike.%${sanitize(args.zoekterm)}%,omschrijving.ilike.%${sanitize(args.zoekterm)}%`);
        if (args.status) query = query.eq('status', args.status);
        const { data, error } = await query.order('deadline', { ascending: true }).limit(10);
        if (error) return `Fout: ${error.message}`;
        if (!data?.length) return 'Geen projecten gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'zoek_medewerkers': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase
          .from('medewerkers')
          .select('werknemer_id, naam_werknemer, primaire_rol, tweede_rol, discipline, werkuren, parttime_dag, duo_team, beschikbaar, notities');
        const zoekterm = args.zoekterm ? sanitize(args.zoekterm) : '';
        if (zoekterm) query = query.ilike('naam_werknemer', `%${zoekterm}%`);
        if (args.discipline) query = query.ilike('discipline', `%${sanitize(args.discipline)}%`);
        const { data, error } = await query.order('naam_werknemer').limit(20);
        if (error) return `Fout: ${error.message}`;

        if ((!data || data.length === 0) && zoekterm) {
          const { data: allen } = await supabase.from('medewerkers')
            .select('werknemer_id, naam_werknemer, primaire_rol, tweede_rol, discipline, werkuren, parttime_dag, duo_team, beschikbaar, notities')
            .order('naam_werknemer');
          if (allen?.length) {
            const fuzzy = findBestNameMatch(zoekterm, allen, 0.5);
            if (fuzzy) return JSON.stringify({ fuzzy_match: true, bedoelde_je: fuzzy.naam_werknemer, resultaat: [fuzzy] }, null, 2);
          }
          return `Geen medewerker gevonden met naam "${zoekterm}".`;
        }
        if (!data?.length) return 'Geen medewerkers gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'zoek_taken': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase
          .from('taken')
          .select('id, werknemer_naam, klant_naam, project_nummer, fase_naam, werktype, discipline, week_start, dag_van_week, start_uur, duur_uren, plan_status');
        if (args.werknemer_naam) query = query.ilike('werknemer_naam', `%${sanitize(args.werknemer_naam)}%`);
        if (args.project_nummer) query = query.ilike('project_nummer', `%${sanitize(args.project_nummer)}%`);
        if (args.week_start) query = query.eq('week_start', args.week_start);
        const { data, error } = await query.order('week_start', { ascending: true }).limit(20);
        if (error) return `Fout: ${error.message}`;
        if (!data?.length) return 'Geen taken gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'zoek_meetings': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase
          .from('meetings & presentaties')
          .select('datum, start_tijd, eind_tijd, onderwerp, type, locatie, deelnemers, status');
        if (args.datum_van) query = query.gte('datum', args.datum_van);
        if (args.datum_tot) query = query.lte('datum', args.datum_tot);
        const { data, error } = await query.order('datum', { ascending: true }).limit(15);
        if (error) return `Fout: ${error.message}`;
        if (!data?.length) return 'Geen meetings gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'zoek_verlof': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase
          .from('beschikbaarheid_medewerkers')
          .select('id, werknemer_naam, type, start_datum, eind_datum, reden, status');
        if (args.werknemer_naam) query = query.ilike('werknemer_naam', `%${sanitize(args.werknemer_naam)}%`);
        if (args.datum_van) query = query.gte('start_datum', args.datum_van);
        if (args.datum_tot) query = query.lte('eind_datum', args.datum_tot);
        const { data, error } = await query.order('start_datum', { ascending: true }).limit(15);
        if (error) return `Fout: ${error.message}`;
        if (!data?.length) return 'Geen verlof gevonden.';
        return JSON.stringify(data, null, 2);
      }

      case 'check_beschikbaarheid': {
        const medewerkers = args.medewerkers as string[];
        const { start_datum, eind_datum } = args;
        if (!medewerkers?.length || !start_datum || !eind_datum) {
          return 'Ongeldige parameters: medewerkers, start_datum en eind_datum zijn verplicht.';
        }
        const resultaten: Record<string, unknown> = {};
        for (const mw of medewerkers) {
          const { data: blokken } = await supabase.from('taken')
            .select('week_start, dag_van_week, start_uur, duur_uren')
            .eq('werknemer_naam', mw).gte('week_start', start_datum).lte('week_start', eind_datum);
          const { data: verlof } = await supabase.from('beschikbaarheid_medewerkers')
            .select('start_datum, eind_datum, type, reden').eq('werknemer_naam', mw)
            .eq('status', 'goedgekeurd').or(`start_datum.lte.${eind_datum},eind_datum.gte.${start_datum}`);
          const totaal = (blokken || []).reduce((sum: number, b: { duur_uren: number }) => sum + b.duur_uren, 0);
          resultaten[mw] = {
            ingeplande_uren: totaal,
            verlof_periodes: verlof || [],
            beschikbaar: (verlof?.length || 0) === 0 ? 'Ja, geen verlof' : `Let op: ${verlof?.length} verlofperiode(s)`,
          };
        }
        return JSON.stringify({ periode: `${start_datum} t/m ${eind_datum}`, medewerkers: resultaten }, null, 2);
      }

      // ── PLANNEN ──────────────────────────────────────────────────────────────

      case 'plan_project': {
        const { klant_naam, project_naam, projecttype = 'algemeen', reasoning = '', deadline } = args;
        const fases = args.fases as Array<{
          fase_naam: string; medewerkers: string[]; start_datum: string; duur_dagen: number;
          uren_per_dag?: number; verdeling?: 'aaneengesloten' | 'per_week' | 'laatste_week'; dagen_per_week?: number;
          fase_deadline?: string; // Per-fase deadline — overschrijft globale deadline voor deze fase
          type?: string; // Expliciet type: 'presentatie', 'meeting', etc.
        }>;

        if (!klant_naam || !project_naam || !fases?.length) {
          return 'Ongeldige parameters: klant_naam, project_naam en fases zijn verplicht.';
        }

        const { data: klant, error: klantErr } = await supabase.from('klanten')
          .select('id, naam, planning_instructies').ilike('naam', `%${klant_naam}%`).limit(1).maybeSingle();
        if (klantErr || !klant) return `Kon klant "${klant_naam}" niet vinden.`;

        // ── PRE-FETCH: 3 queries in parallel i.p.v. ~150 sequentieel ────────────
        const alleeMedewerkers = [...new Set(fases.flatMap(f => f.medewerkers))];
        const startStr = fases[0].start_datum;
        const endDate = deadline
          ? new Date(deadline + 'T00:00:00')
          : new Date(new Date(startStr + 'T00:00:00').getTime() + 90 * 24 * 60 * 60 * 1000);
        const endStr = endDate.toISOString().split('T')[0];

        const [verlofRes, mwRes, takenRes] = await Promise.all([
          supabase.from('beschikbaarheid_medewerkers')
            .select('werknemer_naam, start_datum, eind_datum')
            .in('werknemer_naam', alleeMedewerkers)
            .eq('status', 'goedgekeurd')
            .lte('start_datum', endStr)
            .gte('eind_datum', startStr),
          supabase.from('medewerkers')
            .select('naam_werknemer, parttime_dag')
            .in('naam_werknemer', alleeMedewerkers),
          supabase.from('taken')
            .select('werknemer_naam, week_start, dag_van_week, start_uur, duur_uren')
            .in('werknemer_naam', alleeMedewerkers)
            .gte('week_start', startStr)
            .lte('week_start', endStr),
        ]);

        // Build in-memory Maps voor O(1) lookups
        const verlofMap = new Map<string, Array<{ start_datum: string; eind_datum: string }>>();
        for (const v of verlofRes.data || []) {
          const lijst = verlofMap.get(v.werknemer_naam) || [];
          lijst.push({ start_datum: v.start_datum, eind_datum: v.eind_datum });
          verlofMap.set(v.werknemer_naam, lijst);
        }

        const parttimeMap = new Map<string, string | null>();
        for (const m of mwRes.data || []) {
          parttimeMap.set(m.naam_werknemer, m.parttime_dag || null);
        }

        const takenMap = new Map<string, Array<{ start_uur: number; duur_uren: number }>>();
        for (const t of takenRes.data || []) {
          const key = `${t.werknemer_naam}-${t.week_start}-${t.dag_van_week}`;
          const lijst = takenMap.get(key) || [];
          lijst.push({ start_uur: t.start_uur, duur_uren: t.duur_uren });
          takenMap.set(key, lijst);
        }

        const planCtx: PlanningContext = { verlofMap, parttimeMap, takenMap };
        // ── EINDE PRE-FETCH ───────────────────────────────────────────────────

        const projectNummer = `P-${Date.now().toString().slice(-6)}`;
        const taken: Array<{
          werknemer_naam: string; fase_naam: string; discipline: string; werktype: string;
          week_start: string; dag_van_week: number; start_uur: number; duur_uren: number;
        }> = [];
        const samenvattingParts: string[] = [];
        const warnings: string[] = [];
        const firstStartDate = new Date(fases[0].start_datum + 'T00:00:00');

        function planBlok(medewerker: string, datum: Date, fase: typeof fases[0], isMeeting: boolean): boolean {
          const urenPerDag = fase.uren_per_dag || 8;
          if (heeftVerlofSync(planCtx, medewerker, datum)) { warnings.push(`${medewerker} heeft verlof op ${datum.toISOString().split('T')[0]}`); return false; }
          if (isParttimeDagSync(planCtx, medewerker, datum)) { warnings.push(`${medewerker} werkt niet op ${datum.toISOString().split('T')[0]} (parttime)`); return false; }

          const slot = isMeeting
            ? vindMeetingSlotSync(planCtx, config, medewerker, datum, urenPerDag)
            : vindEersteVrijeSlotSync(planCtx, config, medewerker, datum, urenPerDag);

          if (slot) {
            const dagNamen = ['ma', 'di', 'wo', 'do', 'vr'];
            const dagVanWeek = getDayOfWeekNumber(datum);
            const weekNum = Math.ceil((datum.getTime() - firstStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
            taken.push({ werknemer_naam: medewerker, fase_naam: fase.fase_naam, discipline: bepaalDiscipline(fase.fase_naam), werktype: fase.fase_naam, week_start: getMonday(datum), dag_van_week: dagVanWeek, start_uur: slot.startUur, duur_uren: slot.duurUren });
            samenvattingParts.push(`  ${medewerker}: wk${weekNum} ${dagNamen[dagVanWeek]} ${slot.startUur}:00-${slot.startUur + slot.duurUren}:00`);
            // Registreer het nieuwe blok zodat volgende slots geen conflict krijgen
            registreerBlokInContext(planCtx, medewerker, datum, slot.startUur, slot.duurUren);
            return true;
          }
          warnings.push(`Geen slot voor ${medewerker} op ${datum.toISOString().split('T')[0]}`);
          return false;
        }

        for (const fase of fases) {
          const verdeling = fase.verdeling || 'aaneengesloten';
          const dagenPerWeek = fase.dagen_per_week || 1;
          const isMeeting = fase.type === 'presentatie' || fase.type === 'meeting' || isMeetingFase(fase.fase_naam);
          const isFeedback = isFeedbackFase(fase.fase_naam, fase.uren_per_dag);
          const faseStart = new Date(fase.start_datum + 'T00:00:00');
          // Gebruik fase_deadline als die er is, anders de globale deadline
          const faseDeadline = fase.fase_deadline || deadline;
          samenvattingParts.push(`\n${fase.fase_naam} (${verdeling}):`);

          if (verdeling === 'laatste_week' && faseDeadline) {
            const deadlineDate = new Date(faseDeadline + 'T00:00:00');
            const startDate = new Date(deadlineDate);
            startDate.setDate(startDate.getDate() - 7);
            while (isWeekend(startDate) || getDayOfWeekNumber(startDate) !== 0) startDate.setDate(startDate.getDate() + 1);
            let dagenGepland = 0;

            if (isMeeting && fase.duur_dagen <= 2) {
              // Presentaties: voorkeur donderdag(3) of vrijdag(4), scan de laatste week
              const kandidaten: Date[] = [];
              for (let di = 0; di < 5; di++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + di);
                if (!isWeekend(d) && d < deadlineDate) kandidaten.push(d);
              }
              // Sorteer: do(3)/vr(4) eerst, daarna overige dagen — later in de week is beter
              kandidaten.sort((a, b) => {
                const aPref = getDayOfWeekNumber(a) >= 3 ? 0 : 1;
                const bPref = getDayOfWeekNumber(b) >= 3 ? 0 : 1;
                if (aPref !== bPref) return aPref - bPref;
                return b.getTime() - a.getTime(); // later = dichter bij deadline
              });
              for (const dag of kandidaten) {
                if (dagenGepland >= fase.duur_dagen) break;
                for (const mw of fase.medewerkers) planBlok(mw, dag, fase, true);
                dagenGepland++;
              }
            } else {
              let huidigeDatum = new Date(startDate);
              while (dagenGepland < fase.duur_dagen && huidigeDatum < deadlineDate) {
                while (isWeekend(huidigeDatum)) huidigeDatum.setDate(huidigeDatum.getDate() + 1);
                if (huidigeDatum >= deadlineDate) break;
                for (const mw of fase.medewerkers) planBlok(mw, huidigeDatum, fase, isMeeting);
                dagenGepland++; huidigeDatum.setDate(huidigeDatum.getDate() + 1);
              }
            }
          } else if (verdeling === 'per_week') {
            const totaalWeken = Math.ceil(fase.duur_dagen / dagenPerWeek);
            let huidigeDatum = new Date(faseStart), dagenGepland = 0;
            for (let week = 0; week < totaalWeken && dagenGepland < fase.duur_dagen; week++) {
              let dagenDezeWeek = 0;
              const weekStart = new Date(huidigeDatum);
              if (isFeedback && getDayOfWeekNumber(huidigeDatum) < 3) {
                while (getDayOfWeekNumber(huidigeDatum) !== 3) huidigeDatum.setDate(huidigeDatum.getDate() + 1);
              }
              while (dagenDezeWeek < dagenPerWeek && dagenGepland < fase.duur_dagen) {
                while (isWeekend(huidigeDatum)) huidigeDatum.setDate(huidigeDatum.getDate() + 1);
                if (faseDeadline && huidigeDatum >= new Date(faseDeadline + 'T00:00:00')) break;
                for (const mw of fase.medewerkers) planBlok(mw, huidigeDatum, fase, isMeeting);
                dagenGepland++; dagenDezeWeek++; huidigeDatum.setDate(huidigeDatum.getDate() + 1);
              }
              huidigeDatum = new Date(weekStart);
              huidigeDatum.setDate(huidigeDatum.getDate() + 7);
              const targetDay = isFeedback ? 3 : 0;
              while (isWeekend(huidigeDatum) || getDayOfWeekNumber(huidigeDatum) !== targetDay) huidigeDatum.setDate(huidigeDatum.getDate() + 1);
            }
          } else {
            let huidigeDatum = new Date(faseStart), dagenGepland = 0;
            while (dagenGepland < fase.duur_dagen) {
              while (isWeekend(huidigeDatum)) huidigeDatum.setDate(huidigeDatum.getDate() + 1);
              if (faseDeadline && huidigeDatum >= new Date(faseDeadline + 'T00:00:00')) { warnings.push(`${fase.fase_naam}: Niet alle dagen passen voor deadline`); break; }
              for (const mw of fase.medewerkers) planBlok(mw, huidigeDatum, fase, isMeeting);
              dagenGepland++; huidigeDatum.setDate(huidigeDatum.getDate() + 1);
            }
          }
        }

        let samenvatting = samenvattingParts.join('\n');
        if (reasoning) samenvatting = `Ellen's redenering:\n${reasoning}\n\nPlanning:${samenvatting}`;
        if (warnings.length) samenvatting += '\n\nLet op:\n' + warnings.map(w => `- ${w}`).join('\n');
        if (klant.planning_instructies) samenvatting += `\n\nKlant instructies (${klant.naam}):\n${klant.planning_instructies}`;

        return JSON.stringify({
          type: 'planning_voorstel', klant_naam: klant.naam, klant_id: klant.id,
          project_nummer: projectNummer, project_omschrijving: project_naam, projecttype,
          deadline: deadline || null, aantal_taken: taken.length, taken, samenvatting,
          planning_instructies: klant.planning_instructies || null,
          fases: fases.map(f => ({ fase_naam: f.fase_naam, medewerkers: f.medewerkers, start_datum: f.start_datum, duur_dagen: f.duur_dagen, uren_per_dag: f.uren_per_dag || 8, verdeling: f.verdeling || 'aaneengesloten' })),
        });
      }

      case 'stel_wijziging_voor': {
        return JSON.stringify({ type: 'voorstel', tabel: args.tabel, id: args.id, veld: args.veld, nieuwe_waarde: args.nieuwe_waarde, beschrijving: args.beschrijving });
      }

      // ── DIRECTE WIJZIGINGEN ──────────────────────────────────────────────────

      case 'wijzig_taak': {
        const { taak_id, nieuwe_waarden = {}, reden = '' } = args;
        if (!taak_id) return 'Fout: taak_id is verplicht';

        const { data: huidige, error: fetchErr } = await supabase.from('taken')
          .select('id, werknemer_naam, klant_naam, project_nummer, fase_naam, is_hard_lock, created_by').eq('id', taak_id).maybeSingle();
        if (fetchErr || !huidige) return `Taak "${taak_id}" niet gevonden.`;
        if (huidige.is_hard_lock) return `Taak is vergrendeld — alleen ${huidige.created_by || 'de eigenaar'} kan dit wijzigen.`;

        const toegestaan = ['werknemer_naam', 'week_start', 'dag_van_week', 'start_uur', 'duur_uren', 'fase_naam', 'plan_status', 'werktype'];
        const updateData: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(nieuwe_waarden)) {
          if (toegestaan.includes(k) && v !== undefined) updateData[k] = v;
        }
        if (!Object.keys(updateData).length) return 'Geen geldige velden om te wijzigen.';

        const { error: updateErr } = await supabase.from('taken').update(updateData).eq('id', taak_id);
        if (updateErr) return `Fout bij wijzigen: ${updateErr.message}`;

        return JSON.stringify({ type: 'wijziging_uitgevoerd', taak_id, gewijzigd: updateData, oude_waarden: { medewerker: huidige.werknemer_naam, klant: huidige.klant_naam, project: huidige.project_nummer }, reden, bericht: `Taak gewijzigd (${Object.keys(updateData).join(', ')}). Planning is bijgewerkt.` });
      }

      case 'verwijder_taak': {
        const { taak_id, reden = '' } = args;
        if (!taak_id) return 'Fout: taak_id is verplicht';

        const { data: taak, error: fetchErr } = await supabase.from('taken')
          .select('id, werknemer_naam, klant_naam, project_nummer, fase_naam, is_hard_lock, created_by').eq('id', taak_id).maybeSingle();
        if (fetchErr || !taak) return `Taak "${taak_id}" niet gevonden.`;
        if (taak.is_hard_lock) return `Taak is vergrendeld — alleen ${taak.created_by || 'de eigenaar'} kan dit verwijderen.`;

        const { error: deleteErr } = await supabase.from('taken').delete().eq('id', taak_id);
        if (deleteErr) return `Fout bij verwijderen: ${deleteErr.message}`;

        return JSON.stringify({ type: 'taak_verwijderd', taak_id, verwijderde_taak: { medewerker: taak.werknemer_naam, klant: taak.klant_naam, project: taak.project_nummer, fase: taak.fase_naam }, reden, bericht: `Taak van ${taak.werknemer_naam} (${taak.klant_naam} - ${taak.fase_naam}) is verwijderd.` });
      }

      case 'voeg_taak_toe': {
        const { werknemer_naam, klant_naam, project_titel, fase_naam, week_start, dag_van_week, start_uur, duur_uren, reden = '' } = args;
        if (!werknemer_naam || !klant_naam || !project_titel || !fase_naam || !week_start || dag_van_week === undefined || !start_uur || !duur_uren) {
          return 'Fout: niet alle verplichte velden zijn ingevuld.';
        }
        if (dag_van_week < 0 || dag_van_week > 4) return 'Fout: dag_van_week moet 0-4 zijn (ma-vr).';
        if (start_uur < config.werkdag_start || start_uur > config.werkdag_eind) return `Fout: start_uur moet tussen ${config.werkdag_start} en ${config.werkdag_eind} zijn.`;

        const { data: bestaand } = await supabase.from('taken').select('start_uur, duur_uren')
          .eq('werknemer_naam', werknemer_naam).eq('week_start', week_start).eq('dag_van_week', dag_van_week);
        const eindUur = start_uur + duur_uren;
        const conflict = (bestaand || []).find((t: { start_uur: number; duur_uren: number }) => start_uur < t.start_uur + t.duur_uren && eindUur > t.start_uur);
        if (conflict) return `${werknemer_naam} heeft al een taak op dat tijdstip.`;

        const projectNummer = args.project_nummer || `P-${Date.now().toString().slice(-6)}`;
        const { data: bestaandProject } = await supabase.from('projecten').select('id').eq('projectnummer', projectNummer).maybeSingle();

        const { data: nieuweTaak, error: insertErr } = await supabase.from('taken').insert({
          project_id: bestaandProject?.id || null, werknemer_naam, klant_naam,
          project_nummer: projectNummer, project_titel, fase_naam,
          werktype: args.werktype || 'concept', discipline: bepaalDiscipline(fase_naam),
          week_start, dag_van_week, start_uur, duur_uren,
          plan_status: args.plan_status || 'concept', is_hard_lock: false,
        }).select('id').single();
        if (insertErr) return `Fout bij toevoegen: ${insertErr.message}`;

        const dagNamen = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag'];
        return JSON.stringify({ type: 'taak_toegevoegd', taak_id: nieuweTaak?.id, taak: { medewerker: werknemer_naam, klant: klant_naam, project: projectNummer, fase: fase_naam, dag: dagNamen[dag_van_week], tijd: `${start_uur}:00-${start_uur + duur_uren}:00` }, reden, bericht: `Taak toegevoegd: ${werknemer_naam} - ${klant_naam} (${fase_naam}) op ${dagNamen[dag_van_week]} ${start_uur}:00-${start_uur + duur_uren}:00.` });
      }

      default:
        return `Onbekende tool: ${toolName}`;
    }
  } catch (err) {
    return `Fout bij ${toolName}: ${(err as Error).message}`;
  }
}

// ── WIJZIGING UITVOEREN (bevestiging-flow) ────────────────────────────────────

const WIJZIG_VELDEN: Record<string, string[]> = {
  klanten: ['naam', 'contactpersoon', 'email', 'telefoon', 'adres', 'beschikbaarheid', 'interne_notities', 'planning_instructies'],
  projecten: ['omschrijving', 'deadline', 'status', 'opmerkingen', 'projecttype'],
  medewerkers: ['naam_werknemer', 'primaire_rol', 'tweede_rol', 'discipline', 'werkuren', 'parttime_dag', 'notities', 'beschikbaar'],
  taken: ['werknemer_naam', 'week_start', 'dag_van_week', 'start_uur', 'duur_uren', 'plan_status'],
  rolprofielen: ['rol_naam', 'beschrijving_rol', 'taken_rol', 'standaard_discipline'],
  disciplines: ['discipline_naam', 'beschrijving', 'kleur_hex'],
  projecttypes: ['code', 'naam', 'omschrijving'],
  project_fases: ['fase_naam', 'fase_type', 'volgorde', 'start_datum', 'eind_datum', 'datum_tijd', 'locatie', 'medewerkers', 'inspanning_dagen', 'opmerkingen', 'is_hard_lock'],
  beschikbaarheid_medewerkers: ['werknemer_naam', 'type', 'start_datum', 'eind_datum', 'reden', 'status'],
};

const ID_KOLOM: Record<string, string> = {
  klanten: 'id', projecten: 'id', medewerkers: 'werknemer_id', taken: 'id',
  rolprofielen: 'rol_nummer', disciplines: 'id', projecttypes: 'id',
  project_fases: 'id', beschikbaarheid_medewerkers: 'id',
};

export async function executeWijziging(
  supabase: SupabaseClient, tabel: string, id: string, veld: string, waarde: string
): Promise<{ success: boolean; message: string }> {
  if (!WIJZIG_VELDEN[tabel]) return { success: false, message: `Onbekende tabel: ${tabel}` };
  if (!WIJZIG_VELDEN[tabel].includes(veld)) return { success: false, message: `Veld '${veld}' mag niet worden aangepast` };
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const isNumber = /^\d+$/.test(id);
  if (!isUuid && !isNumber) return { success: false, message: 'Ongeldig ID formaat' };
  const idValue = isNumber ? parseInt(id, 10) : id;
  try {
    const { error } = await supabase.from(tabel).update({ [veld]: waarde }).eq(ID_KOLOM[tabel], idValue);
    if (error) return { success: false, message: `Database fout: ${error.message}` };
    return { success: true, message: `${veld} is bijgewerkt.` };
  } catch (err) {
    return { success: false, message: `Fout: ${(err as Error).message}` };
  }
}
