import { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useNotificaties } from '@/hooks/use-notificaties';
import { useAuth } from '@/contexts/AuthContext';

export function NotificatieBell() {
  const { user } = useAuth();
  const { notificaties, ongelezen, markeerGelezen, markeerAllesGelezen } = useNotificaties(user?.naam);
  const [open, setOpen] = useState(false);

  const TYPE_ICOON: Record<string, string> = {
    planning_gewijzigd: '✏️',
    planning_verwijderd: '🗑️',
    planning_verplaatst: '📅',
    planning_toegevoegd: '➕',
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-background hover:bg-secondary/60 transition-colors">
          <Bell className="h-4 w-4 text-foreground" />
          {ongelezen > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-white leading-none">
              {ongelezen > 9 ? '9+' : ongelezen}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 shadow-lg" sideOffset={6}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Meldingen</span>
            {ongelezen > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                {ongelezen}
              </span>
            )}
          </div>
          {ongelezen > 0 && (
            <button
              onClick={markeerAllesGelezen}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <CheckCheck className="h-3 w-3" />
              Alles gelezen
            </button>
          )}
        </div>

        {/* Lijst */}
        <div className="max-h-96 overflow-y-auto">
          {notificaties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              <Bell className="h-7 w-7 opacity-30" />
              <p className="text-sm">Geen meldingen</p>
            </div>
          ) : (
            notificaties.map(n => (
              <div
                key={n.id}
                onClick={() => !n.gelezen && markeerGelezen(n.id)}
                className={cn(
                  'flex gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors',
                  !n.gelezen
                    ? 'bg-primary/5 hover:bg-primary/10 cursor-pointer'
                    : 'hover:bg-muted/30'
                )}
              >
                <div className="flex-shrink-0 text-base leading-none mt-0.5">
                  {TYPE_ICOON[n.type] ?? '🔔'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground leading-snug">{n.bericht}</p>
                  {n.project_naam && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.project_naam}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {new Date(n.created_at).toLocaleString('nl-NL', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                {!n.gelezen && (
                  <div className="flex-shrink-0 mt-1.5 h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
