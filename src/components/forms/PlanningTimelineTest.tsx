/**
 * TEST COMPONENT — Tijdlijn strip visualisatie
 * Dit is een losse test, de echte component wordt pas aangepast na goedkeuring.
 *
 * Concept: bovenaan elk presentatieblok een live-updating horizontale strip
 * die de verhouding Workload → Presentatie → Feedback laat zien.
 * Breedte van elk segment = proportioneel aan uren.
 */

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';

// ── Tijdlijn strip ──────────────────────────────────────────────────────────
interface TimelineStripProps {
  workloadUren: number;
  presentatieUren: number;
  feedbackUren: number;
  workloadPersonen: string[];
  presentatiePersonen: string[];
  feedbackPersonen: string[];
}

function TimelineStrip({
  workloadUren,
  presentatieUren,
  feedbackUren,
  workloadPersonen,
  presentatiePersonen,
  feedbackPersonen,
}: TimelineStripProps) {
  const totaal = workloadUren + presentatieUren + feedbackUren;
  if (totaal === 0) return null;

  const pct = (u: number) => `${Math.round((u / totaal) * 100)}%`;

  const segments = [
    {
      label: 'Workload',
      uren: workloadUren,
      personen: workloadPersonen,
      bg: 'bg-slate-200 dark:bg-slate-700',
      text: 'text-slate-700 dark:text-slate-200',
      border: 'border-slate-300 dark:border-slate-600',
    },
    {
      label: 'Presentatie',
      uren: presentatieUren,
      personen: presentatiePersonen,
      bg: 'bg-sky-100 dark:bg-sky-900/40',
      text: 'text-sky-700 dark:text-sky-300',
      border: 'border-sky-200 dark:border-sky-700',
    },
    {
      label: 'Feedback',
      uren: feedbackUren,
      personen: feedbackPersonen,
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-700',
    },
  ].filter(s => s.uren > 0);

  return (
    <div className="px-4 pt-4 pb-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Tijdlijn — totaal {totaal}u
      </p>

      {/* Proportionele balk */}
      <div className="flex h-8 w-full rounded-lg overflow-hidden border border-border gap-px bg-border">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`flex items-center justify-center overflow-hidden transition-all duration-300 ${seg.bg} ${seg.text}`}
            style={{ width: pct(seg.uren), minWidth: '2rem' }}
            title={`${seg.label}: ${seg.uren}u`}
          >
            <span className="text-[10px] font-semibold truncate px-1 whitespace-nowrap">
              {seg.uren}u
            </span>
          </div>
        ))}
      </div>

      {/* Labels + personen onder de balk */}
      <div className="flex w-full mt-1.5 gap-px">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="overflow-hidden transition-all duration-300"
            style={{ width: pct(seg.uren), minWidth: '2rem' }}
          >
            <p className={`text-[10px] font-medium truncate ${seg.text}`}>{seg.label}</p>
            <div className="flex gap-0.5 mt-0.5 flex-wrap">
              {seg.personen.slice(0, 3).map((naam) => (
                <span
                  key={naam}
                  className={`text-[9px] px-1 py-0 rounded-full border ${seg.bg} ${seg.border} ${seg.text} font-medium truncate max-w-[40px]`}
                  title={naam}
                >
                  {naam.split(' ')[0]}
                </span>
              ))}
              {seg.personen.length > 3 && (
                <span className={`text-[9px] ${seg.text}`}>+{seg.personen.length - 3}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Demo pagina ─────────────────────────────────────────────────────────────
const DEMO_PERSONEN = ['Ira', 'Tom', 'Jakko', 'Niels'];

export default function PlanningTimelineTest() {
  const [workloadUren, setWorkloadUren] = useState(32);
  const [presentatieUren] = useState(2); // presentatie = vaste 2u event
  const [feedbackDagen, setFeedbackDagen] = useState(2);
  const [workloadPersonen, setWorkloadPersonen] = useState(['Ira', 'Tom']);
  const [feedbackPersonen, setFeedbackPersonen] = useState(['Ira']);
  const [presentatiePersonen] = useState(['Ira', 'Tom', 'Jakko']);

  const feedbackUren = feedbackDagen * 8;

  const toggle = (
    list: string[],
    setList: (v: string[]) => void,
    naam: string
  ) => {
    setList(list.includes(naam) ? list.filter(n => n !== naam) : [...list, naam]);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Test: Tijdlijn strip</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pas de uren aan om de tijdlijn live te zien updaten. De strip bovenaan toont de verhouding tussen de drie fases.
          </p>
        </div>

        {/* Het presentatieblok met tijdlijn */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border border-l-4 border-l-blue-400 bg-blue-50/70 dark:bg-blue-950/25">
            <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              Presentatie 1
            </span>
            <span className="font-semibold text-sm text-foreground">Strategie presentatie</span>
          </div>

          {/* ── Tijdlijn strip ── */}
          <TimelineStrip
            workloadUren={workloadUren}
            presentatieUren={presentatieUren}
            feedbackUren={feedbackUren}
            workloadPersonen={workloadPersonen}
            presentatiePersonen={presentatiePersonen}
            feedbackPersonen={feedbackPersonen}
          />

          {/* Scheidingslijn */}
          <div className="h-px bg-border mx-4" />

          {/* ── Workload sectie ── */}
          <div className="bg-slate-50/60 dark:bg-slate-900/20 p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Workload</Label>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <Label className="text-xs text-muted-foreground w-32 shrink-0">Totaal uren</Label>
              <Input
                type="number"
                value={workloadUren}
                onChange={(e) => setWorkloadUren(Number(e.target.value) || 0)}
                className="h-8 w-24 text-sm text-center"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Medewerkers</Label>
              <div className="flex flex-wrap gap-2">
                {DEMO_PERSONEN.map(naam => (
                  <button
                    key={naam}
                    type="button"
                    onClick={() => toggle(workloadPersonen, setWorkloadPersonen, naam)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      workloadPersonen.includes(naam)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary/50 text-foreground border-border hover:bg-secondary'
                    }`}
                  >
                    {naam}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Presentatie sectie ── */}
          <div className="bg-sky-50/50 dark:bg-sky-950/15 p-4 border-b border-border">
            <p className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wide mb-3">Presentatie</p>
            <div className="flex items-center gap-2 flex-wrap">
              {presentatiePersonen.map(naam => (
                <span key={naam} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-full bg-primary text-primary-foreground">
                  {naam}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Duur: 2u (standaard presentatiemoment)</p>
          </div>

          {/* ── Feedbackmomenten sectie ── */}
          <div className="bg-amber-50/40 dark:bg-amber-950/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Feedbackmomenten</p>
            </div>
            <div className="bg-background rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  defaultValue="Feedbackverwerking"
                  className="h-7 text-sm flex-1"
                  readOnly
                />
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min="1"
                    value={feedbackDagen}
                    onChange={(e) => setFeedbackDagen(Number(e.target.value) || 1)}
                    className="h-7 text-sm w-14 text-center"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    dag{feedbackDagen !== 1 ? 'en' : ''} ({feedbackUren}u)
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5">Wie werkt aan de feedback?</p>
                <div className="flex flex-wrap gap-1.5">
                  {feedbackPersonen.map(naam => (
                    <div key={naam} className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">
                      <span>{naam}</span>
                      <button
                        type="button"
                        onClick={() => toggle(feedbackPersonen, setFeedbackPersonen, naam)}
                        className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                  {DEMO_PERSONEN.filter(n => !feedbackPersonen.includes(n)).map(naam => (
                    <button
                      key={naam}
                      type="button"
                      onClick={() => toggle(feedbackPersonen, setFeedbackPersonen, naam)}
                      className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border border-dashed border-primary/40 text-primary hover:bg-primary/5"
                    >
                      <Plus className="h-2.5 w-2.5" /> {naam}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Dit is een testcomponent — de echte AlgemeenFases.tsx is nog niet aangepast.
        </p>
      </div>
    </div>
  );
}
