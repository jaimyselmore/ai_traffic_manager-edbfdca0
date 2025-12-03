const legendItems = [
  { type: 'concept', label: 'Conceptontwikkeling', color: 'bg-task-concept' },
  { type: 'review', label: 'Interne review/team-update/meeting', color: 'bg-task-review' },
  { type: 'uitwerking', label: 'Conceptuitwerking', color: 'bg-task-uitwerking' },
  { type: 'productie', label: 'Productie', color: 'bg-task-productie' },
  { type: 'extern', label: 'Afspraken/meeting extern', color: 'bg-task-extern' },
  { type: 'optie', label: 'Optie', color: 'bg-task-optie' },
];

export function TaskLegend() {
  return (
    <div className="rounded-lg bg-card border border-border p-3">
      <h3 className="text-xs font-medium text-muted-foreground mb-2">Legenda</h3>
      <div className="flex flex-col gap-1.5">
        {legendItems.map((item) => (
          <div key={item.type} className="flex items-center gap-2">
            <div className={`h-3 w-5 rounded ${item.color}`} />
            <span className="text-xs text-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
