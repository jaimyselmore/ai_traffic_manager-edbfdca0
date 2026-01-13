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

import { TaskLegend } from './TaskLegend';
import { PlannerGrid } from './PlannerGrid';
import { FullscreenPlanner } from './FullscreenPlanner';
import { getWeekStart, getWeekNumber, formatDateRange } from '@/lib/mockData';
import { useEmployees } from '@/hooks/use-employees';
import { usePlannableEmployees } from '@/hooks/use-plannable-employees';
import { useClients } from '@/hooks/use-clients';
import { toast } from '@/hooks/use-toast';

const zoomLevels = [50, 75, 100, 125, 150];

export function Planner() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [plannerZoom, setPlannerZoom] = useState<number>(100);

  // Fetch data from Supabase
  // employees = alle medewerkers (voor dropdown filter)
  // plannableEmployees = alleen planbare medewerkers (voor de grid)
  const { data: employees = [], isLoading: isLoadingEmployees } = useEmployees();
  const { data: plannableEmployees = [], isLoading: isLoadingPlannableEmployees } = usePlannableEmployees();
  const { data: clients = [], isLoading: isLoadingClients } = useClients();

  const weekNumber = getWeekNumber(currentWeekStart);
  const dateRange = formatDateRange(currentWeekStart);

  const tasks = useMemo(() => [], [currentWeekStart]); // TODO: Load from Supabase

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (selectedEmployee !== 'all' && task.employeeId !== selectedEmployee) return false;
      if (selectedClient !== 'all' && task.clientId !== selectedClient) return false;
      return true;
    });
  }, [tasks, selectedEmployee, selectedClient]);

  // Voor de grid: gebruik alleen planbare employees
  const filteredEmployees = useMemo(() => {
    if (selectedEmployee === 'all') return plannableEmployees;
    // Als specifieke employee geselecteerd, filter op planbare employees
    return plannableEmployees.filter((emp) => emp.id === selectedEmployee);
  }, [selectedEmployee, plannableEmployees]);

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

          <Button variant="outline" onClick={() => setIsFullscreen(true)}>
            <Maximize2 className="mr-2 h-4 w-4" />
            Vergroot planner
          </Button>
        </div>
      </div>

      {/* Filter card left + Legend right */}
      <div className="mt-4 flex items-start gap-8">
        {/* Left: Filter card */}
        <div className="rounded-xl border border-border bg-card px-6 py-4 shadow-sm w-[320px]">
          {/* Row 1: Huidige week + Ga naar week + week select */}
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
                onValueChange={(v) => {
                  const targetWeek = parseInt(v);
                  const year = currentWeekStart.getFullYear();
                  const jan1 = new Date(year, 0, 1);
                  const firstMonday = getWeekStart(jan1);
                  const targetDate = new Date(firstMonday);
                  targetDate.setDate(targetDate.getDate() + (targetWeek - 1) * 7);
                  setCurrentWeekStart(targetDate);
                }}
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

          {/* Row 2: Medewerker */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-muted-foreground">Medewerker:</span>
            <div className="ml-auto w-40">
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Alle medewerkers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle medewerkers</SelectItem>
                  {plannableEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Klant */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Klant:</span>
            <div className="ml-auto w-40">
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Alle klanten" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle klanten</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Right: Legend */}
        <TaskLegend />
      </div>

      {/* Grid with zoom */}
      <div
        className="origin-top-left inline-block w-full"
        style={{ 
          transform: `scale(${plannerZoom / 100})`,
          transformOrigin: 'top left',
          width: `${100 / (plannerZoom / 100)}%`
        }}
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
          employees={employees}
          onClose={() => setIsFullscreen(false)}
          onWeekSelect={setCurrentWeekStart}
          initialZoom={plannerZoom}
          onZoomChange={setPlannerZoom}
        />
      )}
    </div>
  );
}
