import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Task, Employee, mockClients } from '@/lib/mockData';

interface PlannerGridProps {
  weekStart: Date;
  employees: Employee[];
  tasks: Task[];
  compact?: boolean;
}

const dayNames = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];
const timeSlots = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

const taskColors: Record<string, string> = {
  concept: 'bg-task-concept',
  review: 'bg-task-review',
  uitwerking: 'bg-task-uitwerking',
  productie: 'bg-task-productie',
  extern: 'bg-task-extern',
  optie: 'bg-task-optie',
};

export function PlannerGrid({ weekStart, employees, tasks, compact = false }: PlannerGridProps) {
  const weekDates = useMemo(() => {
    return dayNames.map((_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, [weekStart]);

  const getTasksForCell = (employeeId: string, date: Date, hour: number) => {
    const dateStr = date.toISOString().split('T')[0];
    return tasks.filter((task) => {
      if (task.employeeId !== employeeId || task.date !== dateStr) return false;
      const startHour = parseInt(task.startTime.split(':')[0]);
      const endHour = parseInt(task.endTime.split(':')[0]);
      return hour >= startHour && hour < endHour;
    });
  };

  const getTaskStart = (task: Task, hour: number) => {
    const startHour = parseInt(task.startTime.split(':')[0]);
    return hour === startHour;
  };

  const getClientName = (clientId: string) => {
    return mockClients.find(c => c.id === clientId)?.name || '';
  };

  const getTaskLabel = (type: string) => {
    const labels: Record<string, string> = {
      concept: 'Concept',
      review: 'Review',
      uitwerking: 'Uitwerking',
      productie: 'Productie',
      extern: 'Extern',
      optie: 'Optie',
    };
    return labels[type] || type;
  };

  return (
    <div className="w-full rounded-lg border border-border bg-card">
      <table className="w-full border-collapse table-fixed">
        <thead>
          <tr className="bg-secondary">
            <th className="sticky left-0 z-10 bg-secondary border-b border-r border-border px-4 py-3 text-left text-sm font-medium text-muted-foreground w-48">
              Medewerker
            </th>
            <th className="sticky left-48 z-10 bg-secondary border-b border-r border-border px-2 py-3 text-center text-xs font-medium text-muted-foreground w-14">
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
                    className="sticky left-0 z-10 bg-card border-b border-r border-border px-4 py-2 align-top"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                        {employee.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-medium text-foreground text-sm">{employee.name}</div>
                        <div className="text-xs text-muted-foreground">{employee.role}</div>
                      </div>
                    </div>
                  </td>
                )}
                <td className={cn(
                  "sticky left-48 z-10 border-b border-r border-border px-2 py-1 text-center text-xs font-medium",
                  hour === 13 ? 'bg-task-lunch/30 text-muted-foreground' : 'bg-card text-muted-foreground'
                )}>
                  {hour === 13 ? 'Lunch' : `${hour.toString().padStart(2, '0')}:00`}
                </td>
                {weekDates.map((date, dayIndex) => {
                  const cellTasks = getTasksForCell(employee.id, date, hour);
                  const isLunchHour = hour === 13;
                  
                  return (
                    <td
                      key={dayIndex}
                      className={cn(
                        "border-b border-r border-border p-0.5",
                        isLunchHour && 'bg-task-lunch/30'
                      )}
                      style={{ height: compact ? '24px' : '32px' }}
                    >
                      {cellTasks.map((task) => {
                        const isStart = getTaskStart(task, hour);
                        if (!isStart) return null;
                        const isConcept = task.planStatus === 'concept';
                        
                        return (
                          <div
                            key={task.id}
                            className={cn(
                              'rounded px-1.5 py-0.5 text-xs text-white overflow-hidden cursor-pointer hover:opacity-90 transition-opacity h-full',
                              taskColors[task.type],
                              isConcept && 'opacity-50'
                            )}
                            title={`${task.projectTitel || getClientName(task.clientId)} - ${getTaskLabel(task.type)}${isConcept ? ' (concept)' : ''}\n${task.startTime} - ${task.endTime}${task.faseNaam ? `\nFase: ${task.faseNaam}` : ''}`}
                          >
                            <div className="truncate font-medium">
                              {task.projectTitel ? (
                                compact ? task.projectTitel.substring(0, 8) : task.projectTitel
                              ) : (
                                compact ? getClientName(task.clientId).substring(0, 4) : getClientName(task.clientId)
                              )}
                            </div>
                            {!compact && (
                              <div className="truncate opacity-80 text-[10px]">
                                {task.faseNaam || getTaskLabel(task.type)}
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
