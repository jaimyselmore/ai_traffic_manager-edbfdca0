import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getWeekNumber } from '@/lib/mockData';

interface WeekSelectorProps {
  currentWeekStart: Date;
  onWeekChange: (weekStart: Date) => void;
}

export function WeekSelector({ currentWeekStart, onWeekChange }: WeekSelectorProps) {
  const weekNumber = getWeekNumber(currentWeekStart);

  const goToCurrentWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(today);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    onWeekChange(weekStart);
  };

  const handleWeekSelect = (weekNum: string) => {
    const targetWeek = parseInt(weekNum);
    const currentYear = new Date().getFullYear();
    
    // Calculate date for target week
    const jan1 = new Date(currentYear, 0, 1);
    const days = (targetWeek - 1) * 7;
    const targetDate = new Date(jan1);
    targetDate.setDate(jan1.getDate() + days);
    
    // Adjust to Monday
    const day = targetDate.getDay();
    const diff = targetDate.getDate() - day + (day === 0 ? -6 : 1);
    targetDate.setDate(diff);
    targetDate.setHours(0, 0, 0, 0);
    
    onWeekChange(targetDate);
  };

  // Generate week options (1-52)
  const weekOptions = Array.from({ length: 52 }, (_, i) => i + 1);

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" onClick={goToCurrentWeek}>
        Huidige week
      </Button>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Ga naar week:</span>
        <Select value={weekNumber.toString()} onValueChange={handleWeekSelect}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {weekOptions.map((week) => (
              <SelectItem key={week} value={week.toString()}>
                {week}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
