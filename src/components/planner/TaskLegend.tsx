import { useWorkTypes } from '@/hooks/use-work-types';

export function TaskLegend() {
  const { data: workTypes = [], isLoading } = useWorkTypes();

  if (isLoading) {
    return (
      <div className="rounded-lg bg-card border border-border p-3">
        <h3 className="text-xs font-medium text-muted-foreground mb-2">Legenda</h3>
        <div className="text-xs text-muted-foreground">Laden...</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-card border border-border p-3">
      <h3 className="text-xs font-medium text-muted-foreground mb-2">Legenda</h3>
      <div className="flex flex-col gap-1.5">
        {workTypes.map((workType) => (
          <div key={workType.id} className="flex items-center gap-2">
            <div
              className="h-3 w-5 rounded"
              style={{ backgroundColor: workType.color }}
            />
            <span className="text-xs text-foreground">{workType.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
