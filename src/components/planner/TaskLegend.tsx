import { useWorkTypes } from '@/lib/data';

export function TaskLegend() {
  const { data: workTypes = [] } = useWorkTypes();

  return (
    <div className="rounded-lg bg-card border border-border p-3">
      <h3 className="text-xs font-medium text-muted-foreground mb-2">Legenda</h3>
      <div className="flex flex-col gap-1.5">
        {workTypes.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <div className={`h-3 w-5 rounded ${item.color}`} />
            <span className="text-xs text-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
