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
    <div className="flex flex-wrap items-center gap-4 rounded-lg bg-card border border-border p-4">
      <span className="text-sm font-medium text-muted-foreground">Legenda:</span>
      {legendItems.map((item) => (
        <div key={item.type} className="flex items-center gap-2">
          <div className={`h-4 w-4 rounded ${item.color}`} />
          <span className="text-sm text-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
