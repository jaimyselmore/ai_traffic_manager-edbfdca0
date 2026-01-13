// Originele legenda - hardcoded zoals het was
const WORK_TYPES = [
  { id: 'concept', label: 'Conceptontwikkeling', color: 'bg-task-concept' },
  { id: 'review', label: 'Interne review/team-update/meeting', color: 'bg-task-review' },
  { id: 'uitwerking', label: 'Conceptuitwerking', color: 'bg-task-uitwerking' },
  { id: 'productie', label: 'Productie', color: 'bg-task-productie' },
  { id: 'extern', label: 'Afspraken/meeting extern', color: 'bg-task-extern' },
  { id: 'optie', label: 'Optie', color: 'bg-task-optie' },
];

export function TaskLegend() {
  return (
    <div className="rounded-lg bg-card border border-border p-3">
      <h3 className="text-xs font-medium text-muted-foreground mb-2">Legenda</h3>
      <div className="flex flex-col gap-1.5">
        {WORK_TYPES.map((workType) => (
          <div key={workType.id} className="flex items-center gap-2">
            <div className={`h-3 w-5 rounded ${workType.color}`} />
            <span className="text-xs text-foreground">{workType.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
