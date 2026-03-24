/**
 * TEST COMPONENT v2 — Tijdlijn met volgorde per persoon
 * Bezoek op /test-timeline
 */

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';

// Herbruikbare dropdown voor toevoegen
function AddDropdown({ personen, onAdd, allowDuplicates = false, current = [] }: {
  personen: string[];
  onAdd: (naam: string) => void;
  allowDuplicates?: boolean;
  current?: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const available = allowDuplicates ? personen : personen.filter(n => !current.includes(n));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (available.length === 0) return null;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center w-7 h-7 rounded-lg border border-dashed border-primary/50 text-primary hover:bg-primary/5 transition-colors"
        title="Toevoegen"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          className="fixed z-[100] bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px] max-h-[220px] overflow-y-auto"
          style={{
            top: ref.current ? ref.current.getBoundingClientRect().bottom + 4 : 0,
            left: ref.current ? ref.current.getBoundingClientRect().left : 0,
          }}
        >
          {available.map((naam, i) => (
            <button
              key={`${naam}-${i}`}
              type="button"
              onClick={() => { onAdd(naam); if (!allowDuplicates) setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors"
            >
              {naam}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PERSOON_KLEUREN = [
  { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-700', dot: 'bg-blue-400' },
  { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-700', dot: 'bg-violet-400' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-700', dot: 'bg-emerald-400' },
  { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-700', dot: 'bg-rose-400' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-700', dot: 'bg-amber-400' },
];

interface WorkloadEntry {
  id: string;
  naam: string;
  uren: number;
}

interface FeedbackEntry {
  id: string;
  naam: string;
  dagen: number;
  personen: string[];
}

// ── Tijdlijn strip ──────────────────────────────────────────────────────────
function TimelineStrip({
  workload,
  presentatiePersonen,
  feedback,
  colorMap,
}: {
  workload: WorkloadEntry[];
  presentatiePersonen: string[];
  feedback: FeedbackEntry[];
  colorMap: Record<string, number>;
}) {
  const feedbackUren = feedback.reduce((s, f) => s + f.dagen * 8, 0);
  const presentatieUren = 2;
  const totaalUren = workload.reduce((s, w) => s + w.uren, 0) + presentatieUren + feedbackUren;

  if (totaalUren === 0) return null;

  const pct = (u: number) => `${Math.max((u / totaalUren) * 100, 4)}%`;

  return (
    <div className="px-4 pt-4 pb-3 border-b border-border">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Tijdlijn — totaal {totaalUren}u
      </p>

      {/* Balk */}
      <div className="flex h-9 w-full rounded-lg overflow-hidden border border-border gap-px bg-border">
        {/* Workload — elk persoon apart blok in volgorde */}
        {workload.filter(w => w.uren > 0).map((w) => {
          const ci = colorMap[w.naam] ?? 0;
          const c = PERSOON_KLEUREN[ci % PERSOON_KLEUREN.length];
          return (
            <div
              key={w.id}
              className={`flex items-center justify-center overflow-hidden transition-all duration-300 ${c.bg} ${c.text}`}
              style={{ width: pct(w.uren), minWidth: '1.5rem' }}
              title={`${w.naam}: ${w.uren}u`}
            >
              <div className="flex flex-col items-center leading-none px-1">
                <span className="text-[10px] font-bold truncate">{w.naam.split(' ')[0]}</span>
                <span className="text-[9px] opacity-70">{w.uren}u</span>
              </div>
            </div>
          );
        })}

        {/* Presentatie */}
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-300 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300"
          style={{ width: pct(presentatieUren), minWidth: '1.5rem' }}
          title={`Presentatie: ${presentatieUren}u`}
        >
          <span className="text-[9px] font-bold truncate px-0.5">Pres.</span>
        </div>

        {/* Feedback */}
        {feedbackUren > 0 && (
          <div
            className="flex items-center justify-center overflow-hidden transition-all duration-300 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
            style={{ width: pct(feedbackUren), minWidth: '2rem' }}
            title={`Feedback: ${feedbackUren}u`}
          >
            <span className="text-[10px] font-bold truncate px-1">{feedbackUren}u</span>
          </div>
        )}
      </div>

      {/* Labels onder de balk */}
      <div className="flex w-full mt-1.5 gap-px items-start">
        {workload.filter(w => w.uren > 0).map((w) => {
          const ci = colorMap[w.naam] ?? 0;
          const c = PERSOON_KLEUREN[ci % PERSOON_KLEUREN.length];
          return (
            <div key={w.id} className="overflow-hidden transition-all duration-300 flex items-center gap-1" style={{ width: pct(w.uren), minWidth: '1.5rem' }}>
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
              <span className={`text-[10px] font-medium truncate ${c.text}`}>{w.naam.split(' ')[0]}</span>
            </div>
          );
        })}
        <div className="overflow-hidden transition-all duration-300" style={{ width: pct(presentatieUren), minWidth: '1.5rem' }}>
          <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium truncate">Pres.</span>
        </div>
        {feedbackUren > 0 && (
          <div className="overflow-hidden transition-all duration-300" style={{ width: pct(feedbackUren), minWidth: '2rem' }}>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium truncate">Feedback</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Workload tabel met drag & drop volgorde ─────────────────────────────────
function WorkloadTabel({
  entries,
  onChange,
  colorMap,
  allPersonen,
}: {
  entries: WorkloadEntry[];
  onChange: (entries: WorkloadEntry[]) => void;
  colorMap: Record<string, number>;
  allPersonen: string[];
}) {
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const updateUren = (id: string, uren: number) => {
    onChange(entries.map(e => e.id === id ? { ...e, uren } : e));
  };

  const remove = (id: string) => {
    onChange(entries.filter(e => e.id !== id));
  };

  const add = (naam: string) => {
    onChange([...entries, { id: crypto.randomUUID(), naam, uren: 8 }]);
  };

  const handleDragStart = (i: number) => { dragIndex.current = i; };
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    setDragOver(i);
  };
  const handleDrop = (i: number) => {
    const from = dragIndex.current;
    if (from === null || from === i) { setDragOver(null); return; }
    const copy = [...entries];
    const [moved] = copy.splice(from, 1);
    copy.splice(i, 0, moved);
    onChange(copy);
    dragIndex.current = null;
    setDragOver(null);
  };

  return (
    <div>
      {entries.length > 0 && (
        <div className="bg-background rounded-lg border border-border overflow-hidden mb-3">
          <div className="grid grid-cols-[24px_1fr_90px_36px] gap-1 px-3 py-2 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
            <span></span>
            <span>Medewerker</span>
            <span className="text-center">Uren</span>
            <span></span>
          </div>
          {entries.map((entry, i) => {
            const ci = colorMap[entry.naam] ?? 0;
            const c = PERSOON_KLEUREN[ci % PERSOON_KLEUREN.length];
            return (
              <div
                key={entry.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => setDragOver(null)}
                className={`grid grid-cols-[24px_1fr_90px_36px] gap-1 px-3 py-2 items-center border-b border-border last:border-b-0 transition-colors ${
                  dragOver === i ? 'bg-primary/5 border-primary/30' : ''
                }`}
              >
                {/* Drag handle */}
                <div className="flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                    <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                  </svg>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                  <span className="text-sm font-medium truncate">{entry.naam}</span>
                </div>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={entry.uren === 0 ? '' : entry.uren}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) updateUren(entry.id, val === '' ? 0 : parseFloat(val));
                  }}
                  placeholder="0"
                  className="h-8 text-sm text-center"
                />
                <button type="button" onClick={() => remove(entry.id)} className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <AddDropdown personen={allPersonen} onAdd={add} allowDuplicates />
    </div>
  );
}

// ── Demo pagina ─────────────────────────────────────────────────────────────
const DEMO_PERSONEN = ['Ira', 'Tom', 'Jakko', 'Niels'];

export default function PlanningTimelineTest() {
  const [workload, setWorkload] = useState<WorkloadEntry[]>([
    { id: '1', naam: 'Ira', uren: 16 },
    { id: '2', naam: 'Tom', uren: 8 },
  ]);

  const [presentatiePersonen, setPresentatiePersonen] = useState(['Ira', 'Tom', 'Jakko']);

  const togglePresentatiePersoon = (naam: string) => {
    setPresentatiePersonen(prev =>
      prev.includes(naam) ? prev.filter(n => n !== naam) : [...prev, naam]
    );
  };

  const [feedback, setFeedback] = useState<FeedbackEntry[]>([
    { id: 'f1', naam: 'Feedbackverwerking', dagen: 2, personen: ['Ira'] },
  ]);

  // Wijs elke unieke naam een vaste kleurindex toe
  const colorMap: Record<string, number> = {};
  DEMO_PERSONEN.forEach((naam, i) => { colorMap[naam] = i; });

  const updateFeedbackDagen = (id: string, dagen: number) => {
    setFeedback(feedback.map(f => f.id === id ? { ...f, dagen } : f));
  };

  const toggleFeedbackPersoon = (id: string, naam: string) => {
    setFeedback(feedback.map(f =>
      f.id === id
        ? { ...f, personen: f.personen.includes(naam) ? f.personen.filter(n => n !== naam) : [...f.personen, naam] }
        : f
    ));
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Test: Tijdlijn met volgorde</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gebruik de pijltjes om de volgorde aan te passen. De tijdlijn toont wie eerst werkt.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border border-l-4 border-l-blue-400 bg-blue-50/70 dark:bg-blue-950/25">
            <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              Presentatie 1
            </span>
            <span className="font-semibold text-sm text-foreground">Strategie presentatie</span>
          </div>

          {/* Tijdlijn strip */}
          <TimelineStrip
            workload={workload}
            presentatiePersonen={presentatiePersonen}
            feedback={feedback}
            colorMap={colorMap}
          />

          {/* Workload */}
          <div className="bg-slate-50/60 dark:bg-slate-900/20 p-4 border-b border-border">
            <Label className="text-sm font-medium mb-1 block">Workload</Label>
            <p className="text-[11px] text-muted-foreground mb-3">
              Sleep rijen om de volgorde aan te passen — wie werkt er eerst?
            </p>
            <WorkloadTabel
              entries={workload}
              onChange={setWorkload}
              colorMap={colorMap}
              allPersonen={DEMO_PERSONEN}
            />
          </div>

          {/* Presentatie */}
          <div className="bg-sky-50/50 dark:bg-sky-950/15 p-4 border-b border-border">
            <p className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wide mb-3">Presentatie</p>
            <Label className="text-sm mb-2 block">Aanwezig bij presentatie</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {presentatiePersonen.map((naam, i) => (
                <div key={`${naam}-${i}`} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-full bg-primary text-primary-foreground">
                  <span>{naam}</span>
                  <button type="button" onClick={() => togglePresentatiePersoon(naam)} className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <AddDropdown personen={DEMO_PERSONEN} onAdd={togglePresentatiePersoon} current={presentatiePersonen} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Duur: 2u</p>
          </div>

          {/* Feedback */}
          <div className="bg-amber-50/40 dark:bg-amber-950/10 p-4">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-3">Feedbackmomenten</p>
            {feedback.map(fm => (
              <div key={fm.id} className="bg-background rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={fm.naam} readOnly className="h-7 text-sm flex-1" />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      type="number"
                      min="1"
                      value={fm.dagen}
                      onChange={e => updateFeedbackDagen(fm.id, parseInt(e.target.value) || 1)}
                      className="h-7 text-sm w-14 text-center"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      dag{fm.dagen !== 1 ? 'en' : ''} ({fm.dagen * 8}u)
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1.5">Wie werkt aan de feedback?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {fm.personen.map(naam => (
                      <div key={naam} className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">
                        <span>{naam}</span>
                        <button type="button" onClick={() => toggleFeedbackPersoon(fm.id, naam)} className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                    <AddDropdown personen={DEMO_PERSONEN} onAdd={(naam) => toggleFeedbackPersoon(fm.id, naam)} current={fm.personen} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Testcomponent — AlgemeenFases.tsx is nog niet aangepast.
        </p>
      </div>
    </div>
  );
}
