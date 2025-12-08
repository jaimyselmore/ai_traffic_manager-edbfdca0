import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ZoomIn, ZoomOut, Download, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { mockEmployees, mockClients, generateMockTasks, getWeekStart, getWeekNumber, formatDateRange, Task, Employee } from '@/lib/mockData';
import { toast } from '@/hooks/use-toast';
import { TaskLegend } from '@/components/planner/TaskLegend';

const zoomLevels = [50, 75, 100, 125, 150];
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

export function AgendasFlow() {
  const navigate = useNavigate();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [plannerZoom, setPlannerZoom] = useState<number>(100);
  const [showPlanner, setShowPlanner] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  const weekNumber = getWeekNumber(currentWeekStart);
  const dateRange = formatDateRange(currentWeekStart);

  const tasks = useMemo(() => generateMockTasks(currentWeekStart), [currentWeekStart]);

  const filteredTasks = useMemo(() => {
    if (!selectedEmployee) return [];
    return tasks.filter((task) => task.employeeId === selectedEmployee);
  }, [tasks, selectedEmployee]);

  const selectedEmployeeData = useMemo(() => {
    return mockEmployees.find(emp => emp.id === selectedEmployee);
  }, [selectedEmployee]);

  const handleZoomOut = () => {
    const currentIndex = zoomLevels.indexOf(plannerZoom);
    if (currentIndex > 0) {
      setPlannerZoom(zoomLevels[currentIndex - 1]);
    }
  };

  const handleZoomIn = () => {
    const currentIndex = zoomLevels.indexOf(plannerZoom);
    if (currentIndex < zoomLevels.length - 1) {
      setPlannerZoom(zoomLevels[currentIndex + 1]);
    }
  };

  const handleDownloadCSV = () => {
    toast({
      title: 'Export gestart',
      description: 'CSV wordt gedownload...',
    });
  };

  const handleDownloadPDF = () => {
    toast({
      title: 'Export gestart',
      description: 'PDF wordt gegenereerd...',
    });
  };

  const handleShowPlanner = () => {
    if (selectedEmployee) {
      setShowPlanner(true);
      setSelectionMode(false);
      setSelectedTasks(new Set());
    }
  };

  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedTasks(new Set());
    }
    setSelectionMode(!selectionMode);
  };

  const toggleTaskSelection = (taskId: string) => {
    if (!selectionMode) return;
    const newSelection = new Set(selectedTasks);
    if (newSelection.has(taskId)) {
      newSelection.delete(taskId);
    } else {
      newSelection.add(taskId);
    }
    setSelectedTasks(newSelection);
  };

  const handleAddToAgenda = () => {
    if (selectedTasks.size === 0 || !selectedEmployeeData) return;
    
    // Navigate to result page with state
    navigate('/agenda-resultaat', {
      state: {
        employeeName: selectedEmployeeData.name,
        taskCount: selectedTasks.size,
      }
    });
  };

  const goToWeek = (week: number) => {
    const year = currentWeekStart.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const firstMonday = getWeekStart(jan1);
    const targetDate = new Date(firstMonday);
    targetDate.setDate(targetDate.getDate() + (week - 1) * 7);
    setCurrentWeekStart(targetDate);
  };

  return (
    <div className="space-y-4">
      {/* Row 1: Title + Zoom & Download */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          <span className="font-bold">Week {weekNumber}</span>
          <span className="font-normal text-muted-foreground"> – {dateRange}</span>
        </h1>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomOut}
              disabled={plannerZoom === 50}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Select value={plannerZoom.toString()} onValueChange={(v) => setPlannerZoom(parseInt(v))}>
              <SelectTrigger className="w-20">
                <SelectValue>{plannerZoom}%</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {zoomLevels.map((z) => (
                  <SelectItem key={z} value={z.toString()}>
                    {z}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomIn}
              disabled={plannerZoom === 150}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleDownloadCSV}>
                Deze week als CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadPDF}>
                Deze week als PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" disabled>
            <Maximize2 className="mr-2 h-4 w-4" />
            Vergroot planner
          </Button>
        </div>
      </div>

      {/* Center menu card */}
      <div className="flex justify-center">
        <div className="rounded-xl border border-border bg-card px-6 py-5 shadow-sm w-[400px]">
          {/* Week controls */}
          <div className="flex items-center gap-3 mb-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentWeekStart(getWeekStart(new Date()))}
            >
              Huidige week
            </Button>
            <span className="text-sm text-muted-foreground">Ga naar week:</span>
            <div className="ml-auto w-20">
              <Select 
                value={weekNumber.toString()} 
                onValueChange={(v) => goToWeek(parseInt(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 52 }, (_, i) => i + 1).map((week) => (
                    <SelectItem key={week} value={week.toString()}>
                      {week}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Medewerker select */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Medewerker:</span>
            <div className="ml-auto w-48">
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecteer medewerker" />
                </SelectTrigger>
                <SelectContent>
                  {mockEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-4">
            Kies een week en medewerker om de planning te bekijken en in de agenda te plaatsen.
          </p>

          {/* Show planner button */}
          <Button 
            className="w-full" 
            disabled={!selectedEmployee}
            onClick={handleShowPlanner}
          >
            Toon planner
          </Button>
        </div>
      </div>

      {/* Planner view for selected employee */}
      {showPlanner && selectedEmployeeData && (
        <div className="relative">
          {/* Selection controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <TaskLegend />
            </div>
            <Button 
              variant={selectionMode ? "secondary" : "outline"}
              onClick={toggleSelectionMode}
            >
              {selectionMode ? 'Selectie annuleren' : 'Selecteren'}
            </Button>
          </div>

          {/* Grid with zoom */}
          <div 
            className={`w-full ${
              plannerZoom <= 75 ? 'h-[calc(100vh-520px)] overflow-hidden' : 'h-[calc(100vh-520px)] overflow-auto'
            }`}
          >
            <div
              className="origin-top-left inline-block"
              style={{ transform: `scale(${plannerZoom / 100})` }}
            >
              <SingleEmployeePlannerGrid
                weekStart={currentWeekStart}
                employee={selectedEmployeeData}
                tasks={filteredTasks}
                selectionMode={selectionMode}
                selectedTasks={selectedTasks}
                onTaskClick={toggleTaskSelection}
              />
            </div>
          </div>

          {/* Add to agenda button */}
          <div className="flex justify-end mt-4">
            <Button 
              disabled={selectedTasks.size === 0}
              onClick={handleAddToAgenda}
            >
              Aan agenda toevoegen
              {selectedTasks.size > 0 && ` (${selectedTasks.size})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SingleEmployeePlannerGridProps {
  weekStart: Date;
  employee: Employee;
  tasks: Task[];
  selectionMode: boolean;
  selectedTasks: Set<string>;
  onTaskClick: (taskId: string) => void;
}

function SingleEmployeePlannerGrid({ 
  weekStart, 
  employee, 
  tasks, 
  selectionMode,
  selectedTasks,
  onTaskClick 
}: SingleEmployeePlannerGridProps) {
  const weekDates = useMemo(() => {
    return dayNames.map((_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, [weekStart]);

  const getTasksForCell = (date: Date, hour: number) => {
    const dateStr = date.toISOString().split('T')[0];
    return tasks.filter((task) => {
      if (task.date !== dateStr) return false;
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
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse">
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
          {timeSlots.map((hour, hourIndex) => (
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
                const cellTasks = getTasksForCell(date, hour);
                const isLunchHour = hour === 13;
                
                return (
                  <td
                    key={dayIndex}
                    className={cn(
                      "border-b border-r border-border p-0.5",
                      isLunchHour && 'bg-task-lunch/30'
                    )}
                    style={{ height: '32px' }}
                  >
                    {cellTasks.map((task) => {
                      const isStart = getTaskStart(task, hour);
                      if (!isStart) return null;
                      
                      const isSelected = selectedTasks.has(task.id);
                      
                      return (
                        <div
                          key={task.id}
                          onClick={() => onTaskClick(task.id)}
                          className={cn(
                            'rounded px-1.5 py-0.5 text-xs text-white overflow-hidden transition-all h-full',
                            taskColors[task.type],
                            selectionMode && 'cursor-pointer hover:ring-2 hover:ring-primary',
                            isSelected && 'ring-2 ring-blue-500 ring-offset-1'
                          )}
                          title={`${getClientName(task.clientId)} - ${getTaskLabel(task.type)}\n${task.startTime} - ${task.endTime}`}
                        >
                          <div className="truncate font-medium">
                            {getClientName(task.clientId)}
                          </div>
                          <div className="truncate opacity-80 text-[10px]">
                            {getTaskLabel(task.type)}
                          </div>
                        </div>
                      );
                    })}
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
