import { useState, useMemo } from 'react';
import { Maximize2, Download, ZoomIn, ZoomOut } from 'lucide-react';
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
import { WeekSelector } from './WeekSelector';
import { TaskLegend } from './TaskLegend';
import { PlannerGrid } from './PlannerGrid';
import { FullscreenPlanner } from './FullscreenPlanner';
import { mockEmployees, mockClients, generateMockTasks, getWeekStart, getWeekNumber, formatDateRange } from '@/lib/mockData';
import { toast } from '@/hooks/use-toast';

export function Planner() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState<number>(100);

  const weekNumber = getWeekNumber(currentWeekStart);
  const dateRange = formatDateRange(currentWeekStart);

  const tasks = useMemo(() => generateMockTasks(currentWeekStart), [currentWeekStart]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (selectedEmployee !== 'all' && task.employeeId !== selectedEmployee) return false;
      if (selectedClient !== 'all' && task.clientId !== selectedClient) return false;
      return true;
    });
  }, [tasks, selectedEmployee, selectedClient]);

  const filteredEmployees = useMemo(() => {
    if (selectedEmployee === 'all') return mockEmployees;
    return mockEmployees.filter((emp) => emp.id === selectedEmployee);
  }, [selectedEmployee]);

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

  const zoomOptions = [100, 75, 50, 25];

  return (
    <div className="space-y-4">
      {/* Row 1: Title + Zoom & Download */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          <span className="font-bold">Week {weekNumber}</span>
          <span className="font-normal text-muted-foreground"> – {dateRange}</span>
        </h1>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <Select value={zoom.toString()} onValueChange={(v) => setZoom(parseInt(v))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {zoomOptions.map((z) => (
                  <SelectItem key={z} value={z.toString()}>
                    {z}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
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

          <Button variant="outline" onClick={() => setIsFullscreen(true)}>
            <Maximize2 className="mr-2 h-4 w-4" />
            Vergroot planner
          </Button>
        </div>
      </div>

      {/* Row 2: Legend left / Week + Filters right in column */}
      <div className="mt-4 flex items-start gap-8">
        {/* Left: Legend */}
        <TaskLegend />

        {/* Right: Week + Filters stacked */}
        <div className="flex flex-col gap-4">
          {/* Week controls */}
          <WeekSelector
            currentWeekStart={currentWeekStart}
            onWeekChange={setCurrentWeekStart}
          />

          {/* Employee filter */}
          <div className="w-64">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Medewerker:</span>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Alle medewerkers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle medewerkers</SelectItem>
                  {mockEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Client filter */}
          <div className="w-64">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Klant:</span>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Alle klanten" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle klanten</SelectItem>
                  {mockClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Grid with zoom */}
      <div
        style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
        className="transition-transform"
      >
        <PlannerGrid
          weekStart={currentWeekStart}
          employees={filteredEmployees}
          tasks={filteredTasks}
        />
      </div>

      {/* Fullscreen Mode */}
      {isFullscreen && (
        <FullscreenPlanner
          currentWeekStart={currentWeekStart}
          employees={mockEmployees}
          onClose={() => setIsFullscreen(false)}
          onWeekSelect={setCurrentWeekStart}
        />
      )}
    </div>
  );
}
