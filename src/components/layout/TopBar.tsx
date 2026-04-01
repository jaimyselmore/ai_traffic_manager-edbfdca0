import { useState } from 'react';
import { Settings, LogOut, User, Plus, FolderPlus, RefreshCw, Users, CalendarOff, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
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

  // Toon alleen voornaam in de knop
  const voornaam = user?.naam ? user.naam.split(' ')[0] : 'Gebruiker';

  return (
    <>
      <header className="flex h-14 items-center justify-end border-b border-border px-6 bg-background">
        <div className="flex items-center gap-2">

          {/* + Nieuw dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 h-9 px-4 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors text-sm font-medium text-foreground">
                <Plus className="h-4 w-4" />
                Nieuw
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-lg border border-border bg-background">
              {templateItems.map((item) => (
                <DropdownMenuItem
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-4 rounded-xl px-4 py-3.5 text-[15px] cursor-pointer"
                >
                  <item.icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 h-9 pl-1.5 pr-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {initials}
                </div>
                <span className="text-sm font-medium text-foreground">{voornaam}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-lg border border-border bg-background">
              <DropdownMenuItem
                onClick={() => setAccountDialogOpen(true)}
                className="flex items-center gap-4 rounded-xl px-4 py-3.5 text-[15px] cursor-pointer"
              >
                <User className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                Mijn profiel
              </DropdownMenuItem>

              {user?.rol?.toLowerCase() === 'admin' && (
                <DropdownMenuItem
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-4 rounded-xl px-4 py-3.5 text-[15px] cursor-pointer"
                >
                  <Settings className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  Instellingen
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator className="my-1 mx-2" />

              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-4 rounded-xl px-4 py-3.5 text-[15px] cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="h-5 w-5 flex-shrink-0" />
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
