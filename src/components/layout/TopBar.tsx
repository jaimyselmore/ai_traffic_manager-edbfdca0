import { useState } from 'react';
import { Settings, LogOut, User, Plus, FolderPlus, RefreshCw, Users, CalendarOff, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { NotificatieBell } from '@/components/layout/NotificatieBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AccountSettingsDialog } from '@/components/account/AccountSettingsDialog';

export function TopBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);

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

  const initials = user?.naam
    ? user.naam.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  const voornaam = user?.naam ? user.naam.split(' ')[0] : 'Gebruiker';

  return (
    <>
      <header className="flex h-12 items-center justify-end border-b border-border px-6 bg-background">
        <div className="flex items-center gap-2">

          {/* + Nieuw dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-background hover:bg-secondary/60 transition-colors text-sm font-medium text-foreground">
                <Plus className="h-3.5 w-3.5" />
                Nieuw
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-lg p-1 shadow-md border border-border">
              {templateItems.map((item) => (
                <DropdownMenuItem
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm cursor-pointer"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notificaties */}
          <NotificatieBell />

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 h-8 pl-1.5 pr-2.5 rounded-lg border border-border bg-background hover:bg-secondary/60 transition-colors">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {initials}
                </div>
                <span className="text-sm font-medium text-foreground">{voornaam}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-lg p-1 shadow-md border border-border">
              <DropdownMenuItem
                onClick={() => setAccountDialogOpen(true)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm cursor-pointer"
              >
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                Mijn profiel
              </DropdownMenuItem>

              {user?.rol?.toLowerCase() === 'admin' && (
                <DropdownMenuItem
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm cursor-pointer"
                >
                  <Settings className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  Instellingen
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator className="my-1" />

              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
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
