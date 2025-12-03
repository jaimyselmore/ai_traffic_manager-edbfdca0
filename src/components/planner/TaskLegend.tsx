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
    <div className="rounded-lg bg-card border border-border p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Legenda</h3>
      <div className="flex flex-col gap-2">
        {legendItems.map((item) => (
          <div key={item.type} className="flex items-center gap-3">
            <div className={`h-4 w-6 rounded ${item.color}`} />
            <span className="text-sm text-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
