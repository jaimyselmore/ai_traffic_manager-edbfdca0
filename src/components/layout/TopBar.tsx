import { useState } from 'react';
import { Settings, LogOut, User, Plus, FolderPlus, RefreshCw, Users, CalendarOff, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AccountSettingsDialog } from '@/components/account/AccountSettingsDialog';
import { getWeekNumber, getWeekStart, formatDateRange } from '@/lib/helpers/dateHelpers';

export function TopBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);

  const voornaam = user?.naam?.split(' ')[0] || '';
  const currentWeekStart = getWeekStart(new Date());
  const weekNumber = getWeekNumber(currentWeekStart);
  const dateRange = formatDateRange(currentWeekStart);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const templateItems = [
    { label: 'Nieuw project', icon: FolderPlus, path: '/nieuw-project' },
    { label: 'Wijziging', icon: RefreshCw, path: '/wijziging' },
    { label: 'Meeting / Presentatie', icon: Users, path: '/meeting' },
    { label: 'Beschikbaarheid', icon: CalendarOff, path: '/verlof' },
  ];

  return (
    <>
      {/* Welcome banner */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-primary/15 border-b border-primary/20">
        <h1 className="text-base font-semibold text-primary">
          Welkom{voornaam ? `, ${voornaam}` : ''}!
        </h1>
        <div className="text-sm text-primary/80">
          Week {weekNumber} — {dateRange}
        </div>
      </div>

      <header className="flex h-12 items-center justify-end border-b border-border bg-card px-6">
        <div className="flex items-center gap-3">
          {/* + Nieuw dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 font-medium h-8">
                <Plus className="h-4 w-4" />
                Nieuw
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {templateItems.map((item) => (
                <DropdownMenuItem
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="gap-2"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {user?.naam ? user.naam.split(' ').map(n => n[0]).join('') : 'U'}
                </div>
                <span className="font-medium text-sm text-foreground">{user?.naam}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <span className="text-xs text-muted-foreground">{user?.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setAccountDialogOpen(true)}>
                <User className="mr-2 h-4 w-4" />
                Mijn profiel
              </DropdownMenuItem>
              {user?.rol === 'admin' && (
                <DropdownMenuItem onClick={() => navigate('/admin')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Instellingen
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Uitloggen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <AccountSettingsDialog 
        open={accountDialogOpen} 
        onOpenChange={setAccountDialogOpen} 
      />
    </>
  );
}
