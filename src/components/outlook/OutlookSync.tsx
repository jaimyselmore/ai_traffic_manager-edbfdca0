import { useState } from 'react';
import { RefreshCw, Upload, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { WeekSelector } from '@/components/planner/WeekSelector';
import { mockEmployees, getWeekStart } from '@/lib/mockData';
import { cn } from '@/lib/utils';

interface SyncStatus {
  type: 'success' | 'info' | 'error';
  message: string;
}

export function OutlookSync() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessages, setStatusMessages] = useState<SyncStatus[]>([]);

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const toggleAll = () => {
    if (selectedEmployees.length === mockEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(mockEmployees.map((emp) => emp.id));
    }
  };

  const handleGetAvailability = async () => {
    if (selectedEmployees.length === 0) {
      setStatusMessages([{ type: 'error', message: 'Selecteer minimaal één medewerker' }]);
      return;
    }

    setIsLoading(true);
    setStatusMessages([{ type: 'info', message: 'Beschikbaarheid ophalen...' }]);

    // Mock API call: GET /api/outlook/availability
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setStatusMessages([
      { type: 'success', message: `Beschikbaarheid bijgewerkt voor ${selectedEmployees.length} medewerker(s)` },
      { type: 'info', message: '3 conflicten gevonden in de planning' },
    ]);
    setIsLoading(false);
  };

  const handleSyncToOutlook = async () => {
    if (selectedEmployees.length === 0) {
      setStatusMessages([{ type: 'error', message: 'Selecteer minimaal één medewerker' }]);
      return;
    }

    setIsLoading(true);
    setStatusMessages([{ type: 'info', message: 'Synchroniseren naar Outlook...' }]);

    // Mock API call: POST /api/outlook/sync
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const taskCount = selectedEmployees.length * 4; // Mock task count
    setStatusMessages([
      { type: 'success', message: `${taskCount} afspraken gesynchroniseerd naar Outlook` },
      { type: 'info', message: 'Alle medewerkers hebben een bevestigingsmail ontvangen' },
    ]);
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Outlook synchronisatie</h1>
        <p className="mt-1 text-muted-foreground">
          Synchroniseer de planning met Microsoft Outlook kalenders
        </p>
      </div>

      {/* Week Selector */}
      <WeekSelector
        currentWeekStart={currentWeekStart}
        onWeekChange={setCurrentWeekStart}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Employee Selection */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Medewerkers</h2>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {selectedEmployees.length === mockEmployees.length ? 'Deselecteer alles' : 'Selecteer alles'}
            </Button>
          </div>

          <div className="space-y-3">
            {mockEmployees.map((employee) => (
              <label
                key={employee.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary"
              >
                <Checkbox
                  checked={selectedEmployees.includes(employee.id)}
                  onCheckedChange={() => toggleEmployee(employee.id)}
                />
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {employee.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="font-medium text-foreground">{employee.name}</div>
                  <div className="text-sm text-muted-foreground">{employee.role}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Actions & Status */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Acties</h2>
            <div className="space-y-3">
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={handleGetAvailability}
                disabled={isLoading}
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
                Beschikbaarheid ophalen
              </Button>
              <Button
                className="w-full justify-start"
                onClick={handleSyncToOutlook}
                disabled={isLoading}
              >
                <Upload className="mr-2 h-4 w-4" />
                Sync deze week naar Outlook
              </Button>
            </div>
          </div>

          {/* Status Messages */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Status</h2>
            {statusMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Geen recente activiteit. Selecteer medewerkers en start een actie.
              </p>
            ) : (
              <div className="space-y-2">
                {statusMessages.map((status, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-start gap-2 rounded-lg p-3 text-sm',
                      status.type === 'success' && 'bg-success/10 text-success',
                      status.type === 'info' && 'bg-primary/10 text-primary',
                      status.type === 'error' && 'bg-destructive/10 text-destructive'
                    )}
                  >
                    {status.type === 'success' && <Check className="mt-0.5 h-4 w-4" />}
                    {status.type === 'info' && <RefreshCw className="mt-0.5 h-4 w-4" />}
                    {status.type === 'error' && <AlertCircle className="mt-0.5 h-4 w-4" />}
                    {status.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
