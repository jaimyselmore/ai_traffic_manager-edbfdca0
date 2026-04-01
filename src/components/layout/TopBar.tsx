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
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 shadow-lg border border-border">
              {templateItems.map((item) => (
                <DropdownMenuItem
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 h-9 pl-1.5 pr-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors">
                {/* Avatar */}
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {initials}
                </div>
                <span className="text-sm font-medium text-foreground">{user?.naam || 'Gebruiker'}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5 shadow-lg border border-border">
              {/* Mijn profiel */}
              <DropdownMenuItem
                onClick={() => setAccountDialogOpen(true)}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm cursor-pointer"
              >
                <User className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">Mijn profiel</span>
              </DropdownMenuItem>

              {/* Instellingen (alleen admin) */}
              {user?.rol?.toLowerCase() === 'admin' && (
                <DropdownMenuItem
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm cursor-pointer"
                >
                  <Settings className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium">Instellingen</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator className="my-1" />

              {/* Uitloggen */}
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium">Uitloggen</span>
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
