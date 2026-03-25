import { useState, useRef, useEffect } from 'react';
import { Plus, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { useEmployees } from '@/hooks/use-employees';
import { DatePicker } from '@/components/ui/date-picker';
import { format, parse, isValid } from 'date-fns';

// Helper functions voor datum conversie
const parseDate = (dateStr: string | undefined): Date | undefined => {
  if (!dateStr) return undefined;
  const parsed = parse(dateStr, 'dd-MM-yyyy', new Date());
  if (isValid(parsed)) return parsed;
  const isoDate = new Date(dateStr);
  return isValid(isoDate) ? isoDate : undefined;
};

const formatDate = (date: Date | undefined): string => {
  if (!date || !isValid(date)) return '';
  return format(date, 'dd-MM-yyyy');
};

export interface WorkloadMedewerker {
  medewerkerId: string;
  uren: number; // Totaal aantal uren voor deze medewerker
}

export interface Workload {
  medewerkers: WorkloadMedewerker[];
}

export interface FeedbackMoment {
  id: string;
  naam: string;
  aantalDagen: number;
  medewerkerIds: string[];
}

export interface PresentatieMoment {
  id: string;
  naam: string;
  datumType: 'ellen' | 'zelf';
  datum?: string;
  tijd?: string;
  locatie: 'selmore' | 'klant' | '';
  teamIds: string[];
  workload: Workload;
  feedbackMomenten?: FeedbackMoment[];
}

export interface AlgemeenFasesData {
  projectTeamIds: string[];
  presentaties: PresentatieMoment[];
  slotfase?: { medewerkers: WorkloadMedewerker[] };
}

interface AlgemeenFasesProps {
  data: AlgemeenFasesData;
  onChange: (data: AlgemeenFasesData) => void;
}

// Kleuren die niet overlappen met sky (presentatie) en amber (feedback)
const PERSOON_KLEUREN = [
  { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-400' },
  { bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-400' },
  { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-400' },
  { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-400' },
  { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
];

// Accentkleuren per presentatieblok – zodat je direct ziet waar een blok begint/eindigt
const BLOCK_ACCENT_COLORS = [
  { header: 'bg-blue-50/70 dark:bg-blue-950/25 border-l-blue-400',   badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  { header: 'bg-violet-50/70 dark:bg-violet-950/25 border-l-violet-400', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  { header: 'bg-emerald-50/70 dark:bg-emerald-950/25 border-l-emerald-400', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { header: 'bg-amber-50/70 dark:bg-amber-950/25 border-l-amber-400',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  { header: 'bg-rose-50/70 dark:bg-rose-950/25 border-l-rose-400',    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
];

// ── Tijdlijn strip ───────────────────────────────────────────────────────────
function TimelineStripProd({
  medewerkers,
  feedbackMomenten,
  employees,
  colorMap,
}: {
  medewerkers: WorkloadMedewerker[];
  feedbackMomenten?: FeedbackMoment[];
  employees: { id: string; name: string }[];
  colorMap: Record<string, number>;
}) {
  const feedbackUren = (feedbackMomenten || []).reduce((s, f) => s + f.aantalDagen * 8, 0);
  const presentatieUren = 2;
  const filtered = medewerkers.filter(m => m.uren > 0);
  const workloadUren = filtered.reduce((s, m) => s + m.uren, 0);
  const totaalUren = workloadUren + presentatieUren + feedbackUren;

  if (workloadUren === 0) return null;

  const pct = (u: number) => `${Math.max((u / totaalUren) * 100, 3)}%`;

  return (
    <div className="px-4 pt-3 pb-3 border-b border-border">
      <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
        Tijdlijn — {totaalUren}u totaal
      </p>
      <div className="flex h-8 w-full rounded-md overflow-hidden border border-border gap-px bg-border">
        {filtered.map((m) => {
          const ci = colorMap[m.medewerkerId] ?? 0;
          const c = PERSOON_KLEUREN[ci % PERSOON_KLEUREN.length];
          const emp = employees.find(e => e.id === m.medewerkerId);
          return (
            <div
              key={m.medewerkerId}
              className={`flex items-center justify-center overflow-hidden transition-all duration-300 ${c.bg} ${c.text}`}
              style={{ width: pct(m.uren), minWidth: '1.5rem' }}
              title={`${emp?.name}: ${m.uren}u`}
            >
              <div className="flex flex-col items-center leading-none px-1">
                <span className="text-[10px] font-semibold truncate">{emp?.name?.split(' ')[0]}</span>
                <span className="text-[9px] opacity-60">{m.uren}u</span>
              </div>
            </div>
          );
        })}
        <div
          className="flex items-center justify-center overflow-hidden bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 transition-all duration-300"
          style={{ width: pct(presentatieUren), minWidth: '1.5rem' }}
          title="Presentatie: 2u"
        >
          <span className="text-[9px] font-semibold px-0.5">Pres.</span>
        </div>
        {feedbackUren > 0 && (
          <div
            className="flex items-center justify-center overflow-hidden bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 transition-all duration-300"
            style={{ width: pct(feedbackUren), minWidth: '2rem' }}
            title={`Feedback: ${feedbackUren}u`}
          >
            <span className="text-[9px] font-semibold px-1 truncate">Feedback</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Workload tabel met drag & drop en pijltjes ───────────────────────────────
function WorkloadTabelProd({
  medewerkers,
  employees,
  colorMap,
  allEmployees,
  onReorder,
  onUpdate,
  onRemove,
  onAdd,
}: {
  medewerkers: WorkloadMedewerker[];
  employees: { id: string; name: string; role?: string }[];
  colorMap: Record<string, number>;
  allEmployees: { id: string; name: string; role?: string }[];
  onReorder: (medewerkers: WorkloadMedewerker[]) => void;
  onUpdate: (medewerkerId: string, uren: number) => void;
  onRemove: (medewerkerId: string) => void;
  onAdd: (empId: string) => void;
}) {
  const dragIndex = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; pos: 'top' | 'bottom' } | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= medewerkers.length) return;
    const copy = [...medewerkers];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    onReorder(copy);
  };

  const handleDragStart = (e: React.DragEvent, i: number) => {
    dragIndex.current = i;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
    setDropTarget({ index: i, pos });
  };

  const handleDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null) { setDropTarget(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const insertAfter = e.clientY >= rect.top + rect.height / 2;
    const to = from < i ? (insertAfter ? i : i - 1) : (insertAfter ? i + 1 : i);
    move(from, to < 0 ? 0 : to);
    dragIndex.current = null;
    setDropTarget(null);
  };

  return (
    <div>
      {medewerkers.length > 0 && (
        <div className="bg-background rounded-lg border border-border overflow-hidden mb-3">
          <div className="grid grid-cols-[44px_1fr_100px_32px] px-3 py-2 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
            <span></span>
            <span>Medewerker</span>
            <span className="text-center">Uren (totaal)</span>
            <span></span>
          </div>
          {medewerkers.map((wm, i) => {
            const emp = employees.find(e => e.id === wm.medewerkerId);
            if (!emp) return null;
            const ci = colorMap[wm.medewerkerId] ?? 0;
            const dotColor = PERSOON_KLEUREN[ci % PERSOON_KLEUREN.length].dot;
            const showTop = dropTarget?.index === i && dropTarget.pos === 'top';
            const showBottom = dropTarget?.index === i && dropTarget.pos === 'bottom';
            return (
              <div
                key={wm.medewerkerId}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={() => setDropTarget(null)}
                className="relative border-b border-border last:border-b-0"
              >
                {showTop && <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary z-10 rounded-full" />}
                {showBottom && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary z-10 rounded-full" />}
                <div className={`grid grid-cols-[44px_1fr_100px_32px] px-3 py-2 items-center cursor-grab active:cursor-grabbing transition-colors ${dropTarget?.index === i ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); move(i, i - 1); }}
                      disabled={i === 0}
                      className="p-1 hover:bg-muted rounded disabled:opacity-20 transition-colors"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); move(i, i + 1); }}
                      disabled={i === medewerkers.length - 1}
                      className="p-1 hover:bg-muted rounded disabled:opacity-20 transition-colors"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                    <span className="text-sm font-medium truncate">{emp.name}</span>
                  </div>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={wm.uren === 0 ? '' : wm.uren}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) onUpdate(wm.medewerkerId, val === '' ? 0 : parseFloat(val));
                    }}
                    placeholder="0"
                    className="h-8 text-sm text-center cursor-text"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(wm.medewerkerId); }}
                    className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded transition-colors cursor-pointer"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {medewerkers.length === 0 && (
        <p className="text-sm text-muted-foreground mb-3">Nog geen medewerkers toegevoegd</p>
      )}
      <MemberAddDropdown
        currentIds={medewerkers.map(m => m.medewerkerId)}
        employees={allEmployees}
        onAdd={onAdd}
      />
    </div>
  );
}

export function AlgemeenFases({ data, onChange }: AlgemeenFasesProps) {
  const { data: employees = [] } = useEmployees();

  // Toggle medewerker in projectteam
  const toggleProjectTeamMember = (empId: string) => {
    const isSelected = data.projectTeamIds.includes(empId);
    const newTeamIds = isSelected
      ? data.projectTeamIds.filter(id => id !== empId)
      : [...data.projectTeamIds, empId];

    // Update alle presentaties
    let updatedPresentaties = data.presentaties;
    if (isSelected) {
      // Verwijder uit alle presentaties en workloads
      updatedPresentaties = data.presentaties.map(p => ({
        ...p,
        teamIds: p.teamIds.filter(id => id !== empId),
        workload: {
          ...p.workload,
          medewerkers: p.workload.medewerkers.filter(m => m.medewerkerId !== empId)
        }
      }));
    } else {
      // Voeg toe aan alle bestaande presentaties en workloads
      updatedPresentaties = data.presentaties.map(p => ({
        ...p,
        teamIds: [...p.teamIds, empId],
        workload: {
          ...p.workload,
          medewerkers: [...p.workload.medewerkers, { medewerkerId: empId, uren: 16 }]
        }
      }));
    }

    onChange({
      ...data,
      projectTeamIds: newTeamIds,
      presentaties: updatedPresentaties
    });
  };

  // Voeg nieuwe presentatie toe
  const addPresentatie = () => {
    const workloadMedewerkers: WorkloadMedewerker[] = data.projectTeamIds.map(id => ({
      medewerkerId: id,
      uren: 16,
    }));

    const newPresentatie: PresentatieMoment = {
      id: crypto.randomUUID(),
      naam: '',
      datumType: 'ellen',
      datum: '',
      tijd: '',
      locatie: '',
      teamIds: [...data.projectTeamIds],
      workload: {
        medewerkers: workloadMedewerkers,
      },
    };
    onChange({ ...data, presentaties: [...data.presentaties, newPresentatie] });
  };

  // Verwijder presentatie
  const removePresentatie = (id: string) => {
    onChange({
      ...data,
      presentaties: data.presentaties.filter(p => p.id !== id)
    });
  };

  // Update presentatie veld
  const updatePresentatie = (id: string, field: keyof PresentatieMoment, value: any) => {
    onChange({
      ...data,
      presentaties: data.presentaties.map(p =>
        p.id === id ? { ...p, [field]: value } : p
      )
    });
  };

  // Toggle medewerker in specifieke presentatie team
  const togglePresentatieTeamMember = (presentatieId: string, empId: string) => {
    const presentatie = data.presentaties.find(p => p.id === presentatieId);
    if (!presentatie) return;

    const isSelected = presentatie.teamIds.includes(empId);
    const newTeamIds = isSelected
      ? presentatie.teamIds.filter(id => id !== empId)
      : [...presentatie.teamIds, empId];

    updatePresentatie(presentatieId, 'teamIds', newTeamIds);
  };

  // Workload functies
  const updateWorkloadMedewerker = (presentatieId: string, medewerkerId: string, uren: number) => {
    onChange({
      ...data,
      presentaties: data.presentaties.map(p =>
        p.id === presentatieId
          ? {
              ...p,
              workload: {
                ...p.workload,
                medewerkers: p.workload.medewerkers.map(m =>
                  m.medewerkerId === medewerkerId ? { ...m, uren } : m
                )
              }
            }
          : p
      )
    });
  };

  const addWorkloadMedewerker = (presentatieId: string, empId: string) => {
    const presentatie = data.presentaties.find(p => p.id === presentatieId);
    if (!presentatie || presentatie.workload.medewerkers.some(m => m.medewerkerId === empId)) return;

    onChange({
      ...data,
      presentaties: data.presentaties.map(p =>
        p.id === presentatieId
          ? {
              ...p,
              workload: {
                ...p.workload,
                medewerkers: [...p.workload.medewerkers, { medewerkerId: empId, uren: 16 }]
              }
            }
          : p
      )
    });
  };

  const reorderWorkloadMedewerkers = (presentatieId: string, medewerkers: WorkloadMedewerker[]) => {
    onChange({
      ...data,
      presentaties: data.presentaties.map(p =>
        p.id === presentatieId ? { ...p, workload: { ...p.workload, medewerkers } } : p
      )
    });
  };

  const removeWorkloadMedewerker = (presentatieId: string, medewerkerId: string) => {
    onChange({
      ...data,
      presentaties: data.presentaties.map(p =>
        p.id === presentatieId
          ? {
              ...p,
              workload: {
                ...p.workload,
                medewerkers: p.workload.medewerkers.filter(m => m.medewerkerId !== medewerkerId)
              }
            }
          : p
      )
    });
  };

  const toggleSlotfase = () => {
    if (data.slotfase) {
      onChange({ ...data, slotfase: undefined });
    } else {
      const medewerkers: WorkloadMedewerker[] = data.projectTeamIds.map(id => ({ medewerkerId: id, uren: 0 }));
      onChange({ ...data, slotfase: { medewerkers } });
    }
  };

  const updateSlotfaseMedewerker = (medewerkerId: string, uren: number) => {
    onChange({
      ...data,
      slotfase: { medewerkers: (data.slotfase?.medewerkers || []).map(m => m.medewerkerId === medewerkerId ? { ...m, uren } : m) }
    });
  };

  const addSlotfaseMedewerker = (empId: string) => {
    if (data.slotfase?.medewerkers.some(m => m.medewerkerId === empId)) return;
    onChange({ ...data, slotfase: { medewerkers: [...(data.slotfase?.medewerkers || []), { medewerkerId: empId, uren: 0 }] } });
  };

  const removeSlotfaseMedewerker = (medewerkerId: string) => {
    onChange({ ...data, slotfase: { medewerkers: (data.slotfase?.medewerkers || []).filter(m => m.medewerkerId !== medewerkerId) } });
  };

  const reorderSlotfaseMedewerkers = (medewerkers: WorkloadMedewerker[]) => {
    onChange({ ...data, slotfase: { medewerkers } });
  };

  const addFeedbackMoment = (presentatieId: string) => {
    onChange({
      ...data,
      presentaties: data.presentaties.map(p =>
        p.id === presentatieId
          ? {
              ...p,
              feedbackMomenten: [
                ...(p.feedbackMomenten || []),
                {
                  id: crypto.randomUUID(),
                  naam: 'Feedbackverwerking',
                  aantalDagen: 2,
                  medewerkerIds: [...p.teamIds],
                }
              ]
            }
          : p
      )
    });
  };

  const removeFeedbackMoment = (presentatieId: string, momentId: string) => {
    onChange({
      ...data,
      presentaties: data.presentaties.map(p =>
        p.id === presentatieId
          ? { ...p, feedbackMomenten: (p.feedbackMomenten || []).filter(f => f.id !== momentId) }
          : p
      )
    });
  };

  const updateFeedbackMoment = (presentatieId: string, momentId: string, field: string, value: any) => {
    onChange({
      ...data,
      presentaties: data.presentaties.map(p =>
        p.id === presentatieId
          ? {
              ...p,
              feedbackMomenten: (p.feedbackMomenten || []).map(f =>
                f.id === momentId ? { ...f, [field]: value } : f
              )
            }
          : p
      )
    });
  };

  const colorMap: Record<string, number> = {};
  employees.forEach((emp, i) => { colorMap[emp.id] = i; });

  return (
    <div className="space-y-4">
      {/* Projectteam */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">Projectteam</h2>
        <div className="flex flex-wrap gap-2">
          {employees.map(emp => {
            const isSelected = data.projectTeamIds.includes(emp.id);
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => toggleProjectTeamMember(emp.id)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary/50 text-foreground border-border hover:bg-secondary'
                }`}
              >
                {emp.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Presentaties - elk als apart blok */}
      {data.presentaties.map((presentatie, index) => {
        const accent = BLOCK_ACCENT_COLORS[index % BLOCK_ACCENT_COLORS.length];
        return (
        <div key={presentatie.id} className="rounded-2xl border border-border bg-card overflow-hidden">

          {/* ── Header: badge + naam input + verwijder ── */}
          <div className={`flex items-center gap-3 px-4 py-3 border-b border-border border-l-4 ${accent.header}`}>
            <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${accent.badge}`}>
              Presentatie {index + 1}
            </span>
            <Input
              value={presentatie.naam}
              onChange={(e) => updatePresentatie(presentatie.id, 'naam', e.target.value)}
              placeholder="Naam presentatie…"
              className="flex-1 h-8 text-sm font-medium border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => removePresentatie(presentatie.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* ── Tijdlijn strip ── */}
          <TimelineStripProd
            medewerkers={presentatie.workload.medewerkers}
            feedbackMomenten={presentatie.feedbackMomenten}
            employees={employees}
            colorMap={colorMap}
          />

          {/* ── Blokje 1: Workload (licht grijs) ── */}
          <div className="bg-slate-50/60 dark:bg-slate-900/20 p-4 border-b border-border">
            <Label className="text-sm font-medium mb-1 block">Workload</Label>
            <p className="text-[11px] text-muted-foreground mb-3">Sleep of gebruik de pijltjes om de volgorde aan te passen.</p>
            <WorkloadTabelProd
              medewerkers={presentatie.workload.medewerkers}
              employees={employees}
              colorMap={colorMap}
              allEmployees={employees}
              onReorder={(medewerkers) => reorderWorkloadMedewerkers(presentatie.id, medewerkers)}
              onUpdate={(empId, uren) => updateWorkloadMedewerker(presentatie.id, empId, uren)}
              onRemove={(empId) => removeWorkloadMedewerker(presentatie.id, empId)}
              onAdd={(empId) => addWorkloadMedewerker(presentatie.id, empId)}
            />
          </div>

          {/* ── Blokje 2: Presentatiedetails (licht blauw) ── */}
          <div className="bg-sky-50/50 dark:bg-sky-950/15 p-4 border-b border-border space-y-4">
            <p className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wide">Presentatie</p>

            {/* Datum type */}
            <div>
              <Label className="text-sm mb-2 block">Datum & tijd</Label>
              <RadioGroup
                value={presentatie.datumType || 'ellen'}
                onValueChange={(value) => updatePresentatie(presentatie.id, 'datumType', value)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ellen" id={`${presentatie.id}-ellen`} />
                  <Label htmlFor={`${presentatie.id}-ellen`} className="text-sm cursor-pointer">Ellen bepaalt</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="zelf" id={`${presentatie.id}-zelf`} />
                  <Label htmlFor={`${presentatie.id}-zelf`} className="text-sm cursor-pointer">Zelf invullen</Label>
                </div>
              </RadioGroup>
              {presentatie.datumType === 'zelf' && (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Datum</Label>
                    <DatePicker
                      value={parseDate(presentatie.datum)}
                      onChange={(date) => updatePresentatie(presentatie.id, 'datum', formatDate(date))}
                      placeholder="Selecteer datum"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tijd</Label>
                    <Input
                      type="time"
                      value={presentatie.tijd || ''}
                      onChange={(e) => updatePresentatie(presentatie.id, 'tijd', e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Locatie */}
            <div>
              <Label className="text-sm mb-2 block">Locatie</Label>
              <RadioGroup
                value={presentatie.locatie || ''}
                onValueChange={(value) => updatePresentatie(presentatie.id, 'locatie', value)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="selmore" id={`${presentatie.id}-selmore`} />
                  <Label htmlFor={`${presentatie.id}-selmore`} className="text-sm cursor-pointer">Bij Selmore</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="klant" id={`${presentatie.id}-klant`} />
                  <Label htmlFor={`${presentatie.id}-klant`} className="text-sm cursor-pointer">Bij klant</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Aanwezig */}
            <div>
              <Label className="text-sm mb-2 block">Aanwezig bij presentatie</Label>
              <div className="flex flex-wrap gap-2">
                {presentatie.teamIds.map(empId => {
                  const emp = employees.find(e => e.id === empId);
                  if (!emp) return null;
                  return (
                    <div key={emp.id} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-full bg-primary text-primary-foreground">
                      <span>{emp.name}</span>
                      <button
                        type="button"
                        onClick={() => togglePresentatieTeamMember(presentatie.id, emp.id)}
                        className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                <MemberAddDropdown
                  currentIds={presentatie.teamIds}
                  employees={employees}
                  onAdd={(empId) => togglePresentatieTeamMember(presentatie.id, empId)}
                />
              </div>
            </div>
          </div>

          {/* ── Blokje 3: Feedbackmomenten (licht amber) ── */}
          <div className="bg-amber-50/40 dark:bg-amber-950/10 p-4">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-3">Feedbackmomenten</p>

            {(!presentatie.feedbackMomenten || presentatie.feedbackMomenten.length === 0) ? (
              <button
                type="button"
                onClick={() => addFeedbackMoment(presentatie.id)}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-dashed border-amber-300 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors text-sm"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                Feedbackmoment toevoegen
              </button>
            ) : (
              <div className="space-y-2">
                {presentatie.feedbackMomenten.map((fm) => (
                  <div key={fm.id} className="bg-background rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={fm.naam}
                        onChange={(e) => updateFeedbackMoment(presentatie.id, fm.id, 'naam', e.target.value)}
                        placeholder="Bijv. Feedbackverwerking"
                        className="h-7 text-sm flex-1"
                      />
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Input
                          type="number"
                          min="1"
                          max="30"
                          value={fm.aantalDagen}
                          onChange={(e) => updateFeedbackMoment(presentatie.id, fm.id, 'aantalDagen', parseInt(e.target.value) || 1)}
                          className="h-7 text-sm w-14 text-center"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">dag{fm.aantalDagen !== 1 ? 'en' : ''}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFeedbackMoment(presentatie.id, fm.id)}
                        className="p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-colors flex-shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1.5">Wie werkt aan de feedback?</p>
                      <div className="flex flex-wrap gap-1.5">
                        {fm.medewerkerIds.map(empId => {
                          const emp = employees.find(e => e.id === empId);
                          if (!emp) return null;
                          return (
                            <div key={empId} className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">
                              <span>{emp.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newIds = fm.medewerkerIds.filter(id => id !== empId);
                                  updateFeedbackMoment(presentatie.id, fm.id, 'medewerkerIds', newIds);
                                }}
                                className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          );
                        })}
                        <MemberAddDropdown
                          currentIds={fm.medewerkerIds}
                          employees={employees}
                          onAdd={(empId) => {
                            const newIds = [...fm.medewerkerIds, empId];
                            updateFeedbackMoment(presentatie.id, fm.id, 'medewerkerIds', newIds);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
      })}

      {/* Slotfase: werkzaamheden na laatste presentatie */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-secondary/30 border-b border-border">
          <span className="font-semibold text-sm">Werkzaamheden na laatste presentatie</span>
          <button
            type="button"
            onClick={toggleSlotfase}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              data.slotfase
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary/50 text-foreground border-border hover:bg-secondary'
            }`}
          >
            {data.slotfase ? 'Actief' : 'Inschakelen'}
          </button>
        </div>
        {data.slotfase && (
          <div className="p-4">
            <p className="text-[11px] text-muted-foreground mb-3">Sleep of gebruik de pijltjes om de volgorde aan te passen.</p>
            <WorkloadTabelProd
              medewerkers={data.slotfase.medewerkers}
              employees={employees}
              colorMap={colorMap}
              allEmployees={employees}
              onReorder={reorderSlotfaseMedewerkers}
              onUpdate={(empId, uren) => updateSlotfaseMedewerker(empId, uren)}
              onRemove={removeSlotfaseMedewerker}
              onAdd={addSlotfaseMedewerker}
            />
          </div>
        )}
      </div>

      {/* Presentatie toevoegen knop */}
      <Button
        type="button"
        variant="outline"
        onClick={addPresentatie}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Presentatie toevoegen
      </Button>
    </div>
  );
}

// Dropdown voor medewerker toevoegen met betere positie
function MemberAddDropdown({
  currentIds,
  employees,
  onAdd,
}: {
  currentIds: string[];
  employees: { id: string; name: string; role?: string }[];
  onAdd: (empId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const availableEmployees = employees.filter(e => !currentIds.includes(e.id));

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (availableEmployees.length === 0) return null;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-7 h-7 rounded-lg border border-dashed border-primary/50 text-primary hover:bg-primary/5 transition-colors"
        title="Toevoegen"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {isOpen && (
        <div
          className="fixed z-[100] bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[200px] max-h-[240px] overflow-y-auto"
          style={{
            top: dropdownRef.current ? dropdownRef.current.getBoundingClientRect().bottom + 4 : 0,
            left: dropdownRef.current ? dropdownRef.current.getBoundingClientRect().left : 0,
          }}
        >
          {availableEmployees.map(emp => (
            <button
              key={emp.id}
              type="button"
              onClick={() => {
                onAdd(emp.id);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors flex items-center justify-between"
            >
              <span>{emp.name}</span>
              <span className="text-xs text-muted-foreground">{emp.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const emptyAlgemeenFasesData: AlgemeenFasesData = {
  projectTeamIds: [],
  presentaties: [],
  slotfase: undefined,
};
