import { useState } from 'react';
import { Settings, LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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

  return (
    <>
      <header className="flex h-14 items-center justify-end border-b border-border bg-card px-6">
        <div className="flex items-center gap-2">
          {user?.isPlanner && (
            <button
              onClick={() => navigate('/admin')}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              title="Instellingen"
            >
              <Settings className="h-5 w-5" />
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground hover:opacity-80 transition-opacity cursor-pointer"
                title={user?.naam || 'Gebruiker'}
              >
                {user?.naam ? user.naam.split(' ').map(n => n[0]).join('') : 'U'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{user?.naam}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setAccountDialogOpen(true)}>
                <User className="mr-2 h-4 w-4" />
                Account instellingen
              </DropdownMenuItem>
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
