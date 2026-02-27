import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Task } from '@/hooks/use-tasks';
import type { Employee } from '@/lib/data/types';

interface PlannerGridProps {
  weekStart: Date;
  employees: Employee[];
  tasks: Task[];
  compact?: boolean;
  onTaskClick?: (task: Task) => void;
}

const dayNames = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];
const timeSlots = [9, 10, 11, 12, 13, 14, 15, 16, 17]; // Tot 18:00, zonder 18:00 rij

const taskColors: Record<string, string> = {
  concept: 'bg-task-concept',
  review: 'bg-task-review',
  uitwerking: 'bg-task-uitwerking',
  productie: 'bg-task-productie',
  extern: 'bg-task-extern',
  optie: 'bg-task-optie',
  verlof: 'bg-slate-400',
  ziek: 'bg-red-400',
};

export function PlannerGrid({ weekStart, employees, tasks, compact = false, onTaskClick }: PlannerGridProps) {
  const weekDates = useMemo(() => {
    return dayNames.map((_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, [weekStart]);

  const getTasksForCell = (employeeName: string, date: Date, hour: number) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return tasks.filter((task) => {
      if (task.werknemer_naam !== employeeName || task.date !== dateStr) return false;
      const startHour = parseInt(task.startTime.split(':')[0]);
      const endHour = parseInt(task.endTime.split(':')[0]);
      return hour >= startHour && hour < endHour;
    });
  };

  const getTaskStart = (task: Task, hour: number) => {
    const startHour = parseInt(task.startTime.split(':')[0]);
    return hour === startHour;
  };

  const getTaskDuration = (task: Task) => {
    const startHour = parseInt(task.startTime.split(':')[0]);
    const endHour = parseInt(task.endTime.split(':')[0]);
    return endHour - startHour;
  };

  const getClientName = (task: Task) => {
    return task.klant_naam || task.clientName || '';
  };

  const getTaskLabel = (type: string) => {
    const labels: Record<string, string> = {
      concept: 'Concept',
      review: 'Review',
      uitwerking: 'Uitwerking',
      productie: 'Productie',
      extern: 'Extern',
      optie: 'Optie',
      verlof: 'Verlof',
      ziek: 'Ziek',
    };
    return labels[type] || type;
  };

  return (
    <div className="w-full rounded-lg border border-border bg-card overflow-x-auto">
      <table className="w-full border-collapse table-fixed min-w-[800px]">
        <thead>
          <tr className="bg-secondary">
            <th className="sticky left-0 z-30 bg-secondary border-b border-r border-border px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-medium text-muted-foreground w-32 md:w-48">
              Medewerker
            </th>
            <th className="sticky left-32 md:left-48 z-30 bg-secondary border-b border-r border-border px-1 md:px-2 py-2 md:py-3 text-center text-[10px] md:text-xs font-medium text-muted-foreground w-10 md:w-14">
              Uur
            </th>
            {weekDates.map((date, index) => (
              <th
                key={index}
                className="border-b border-r border-border px-2 py-3 text-center text-sm font-medium text-foreground min-w-28"
              >
                <div>{dayNames[index]}</div>
                <div className="text-xs text-muted-foreground">
                  {date.getDate()}/{date.getMonth() + 1}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee, empIndex) => (
            timeSlots.map((hour, hourIndex) => (
              <tr key={`${employee.id}-${hour}`} className={cn(
                hour === 13 && 'bg-task-lunch/30'
              )}>
                {hourIndex === 0 && (
                  <td
                    rowSpan={timeSlots.length}
                    className="sticky left-0 z-30 bg-card border-b border-r border-border px-2 md:px-4 py-2 align-top"
                  >
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="flex h-6 w-6 md:h-8 md:w-8 items-center justify-center rounded-full bg-primary text-[10px] md:text-xs font-medium text-primary-foreground shrink-0">
                        {employee.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground text-xs md:text-sm truncate">{employee.name}</div>
                        <div className="text-[10px] md:text-xs text-muted-foreground truncate hidden md:block">{employee.role}</div>
                      </div>
                    </div>
                  </td>
                )}
                <td className="sticky left-32 md:left-48 z-30 bg-card border-b border-r border-border px-1 md:px-2 py-1 text-center text-[10px] md:text-xs font-medium text-muted-foreground">
                  {hour === 13 ? 'Lunch' : `${hour.toString().padStart(2, '0')}:00`}
                </td>
                {weekDates.map((date, dayIndex) => {
                  const cellTasks = getTasksForCell(employee.name, date, hour);
                  const isLunchHour = hour === 13;
                  const cellHeight = compact ? 24 : 32;

                  return (
                    <td
                      key={dayIndex}
                      className={cn(
                        "border-b border-r border-border p-0.5 relative z-0",
                        isLunchHour && 'bg-task-lunch/30'
                      )}
                      style={{ height: `${cellHeight}px`, overflow: 'visible' }}
                    >
                      {cellTasks.map((task) => {
                        const isStart = getTaskStart(task, hour);
                        if (!isStart) return null;

                        const duration = getTaskDuration(task);
                        const taskHeight = duration * cellHeight - 2; // -2 for padding
                        const isConcept = task.planStatus === 'concept';
                        const isWachtKlant = (task.planStatus as string) === 'wacht_klant';
                        const isDoorzichtig = isConcept || isWachtKlant;

                        return (
                          <div
                            key={task.id}
                            className={cn(
                              'absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-xs text-white overflow-hidden cursor-pointer hover:opacity-90 hover:ring-2 hover:ring-primary/50 transition-all z-20',
                              taskColors[task.type],
                              isDoorzichtig && 'opacity-50',
                              isWachtKlant && 'border-2 border-dashed border-white/50'
                            )}
                            style={{
                              top: '1px',
                              height: `${taskHeight}px`,
                              minHeight: `${cellHeight - 4}px`
                            }}
                            title={`${task.projectTitel || getClientName(task)} - ${getTaskLabel(task.type)}${isConcept ? ' (concept)' : ''}${isWachtKlant ? ' (wacht op klant)' : ''}\n${task.startTime} - ${task.endTime}${task.faseNaam ? `\nFase: ${task.faseNaam}` : ''}`}
                            onClick={(e) => { e.stopPropagation(); onTaskClick?.(task); }}
                          >
                            <div className="truncate font-medium">
                              {task.projectTitel ? (
                                compact ? task.projectTitel.substring(0, 8) : task.projectTitel
                              ) : (
                                compact ? getClientName(task).substring(0, 4) : getClientName(task)
                              )}
                            </div>
                            {!compact && duration > 1 && (
                              <div className="truncate opacity-80 text-[10px]">
                                {task.faseNaam || getTaskLabel(task.type)}
                              </div>
                            )}
                            {duration > 2 && (
                              <div className="truncate opacity-70 text-[10px] mt-1">
                                {task.startTime} - {task.endTime}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))
          ))}
        </tbody>
      </table>
    </div>
  );
}
