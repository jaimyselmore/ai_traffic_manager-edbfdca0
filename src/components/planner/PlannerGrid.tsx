import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Task, Employee } from '@/lib/mockData';

interface PlannerGridProps {
  weekStart: Date;
  employees: Employee[];
  tasks: Task[];
  compact?: boolean;
}

const dayNames = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];
const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

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

  const getTasksForCell = (employeeId: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return tasks.filter(
      (task) => task.employeeId === employeeId && task.date === dateStr
    );
  };

  const getTaskPosition = (task: Task) => {
    const startHour = parseInt(task.startTime.split(':')[0]);
    const endHour = parseInt(task.endTime.split(':')[0]);
    
    // Calculate position (9:00 = 0%, 18:00 = 100%)
    const top = ((startHour - 9) / 9) * 100;
    const height = ((endHour - startHour) / 9) * 100;
    
    return { top: `${top}%`, height: `${height}%` };
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-secondary">
            <th className="sticky left-0 z-10 bg-secondary border-b border-r border-border px-4 py-3 text-left text-sm font-medium text-muted-foreground w-48">
              Medewerker
            </th>
            {weekDates.map((date, index) => (
              <th
                key={index}
                className="border-b border-r border-border px-4 py-3 text-center text-sm font-medium text-foreground min-w-40"
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
          {employees.map((employee) => (
            <tr key={employee.id} className="hover:bg-secondary/50">
              <td className="sticky left-0 z-10 bg-card border-b border-r border-border px-4 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {employee.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="font-medium text-foreground text-sm">{employee.name}</div>
                    <div className="text-xs text-muted-foreground">{employee.role}</div>
                  </div>
                </div>
                {/* Time axis labels */}
                {!compact && (
                  <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                    <span>09:00</span>
                    <span>18:00</span>
                  </div>
                )}
              </td>
              {weekDates.map((date, dayIndex) => {
                const cellTasks = getTasksForCell(employee.id, date);
                return (
                  <td
                    key={dayIndex}
                    className="border-b border-r border-border p-1 align-top"
                    style={{ height: compact ? '80px' : '160px' }}
                  >
                    <div className="relative h-full w-full">
                      {/* Lunch highlight */}
                      <div
                        className="absolute left-0 right-0 bg-task-lunch/50 pointer-events-none"
                        style={{
                          top: `${((13 - 9) / 9) * 100}%`,
                          height: `${(1 / 9) * 100}%`,
                        }}
                      />
                      
                      {/* Tasks */}
                      {cellTasks.map((task) => {
                        const pos = getTaskPosition(task);
                        return (
                          <div
                            key={task.id}
                            className={cn(
                              'absolute left-0 right-0 mx-0.5 rounded px-1.5 py-0.5 text-xs text-white overflow-hidden cursor-pointer hover:opacity-90 transition-opacity',
                              taskColors[task.type]
                            )}
                            style={{ top: pos.top, height: pos.height }}
                            title={`${task.title}\n${task.startTime} - ${task.endTime}`}
                          >
                            <div className="truncate font-medium">{task.title.split(' - ')[0]}</div>
                            {!compact && (
                              <div className="truncate opacity-80">
                                {task.startTime}-{task.endTime}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
