import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, Lock, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const usernameSchema = z.object({
  newUsername: z
    .string()
    .trim()
    .min(3, 'Gebruikersnaam moet minimaal 3 tekens zijn')
    .max(50, 'Gebruikersnaam mag maximaal 50 tekens zijn')
    .regex(/^[a-zA-Z0-9]+$/, 'Alleen letters en cijfers toegestaan'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Huidig wachtwoord is verplicht'),
  newPassword: z
    .string()
    .min(8, 'Nieuw wachtwoord moet minimaal 8 tekens zijn')
    .max(100, 'Wachtwoord mag maximaal 100 tekens zijn'),
  confirmPassword: z.string().min(1, 'Bevestig je nieuwe wachtwoord'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Wachtwoorden komen niet overeen',
  path: ['confirmPassword'],
});

type Section = 'username' | 'password';

const navItems: { id: Section; label: string; icon: typeof User; description: string }[] = [
  { id: 'username', label: 'Gebruikersnaam', icon: User, description: 'Wijzig je inlognaam' },
  { id: 'password', label: 'Wachtwoord', icon: Lock, description: 'Verander je wachtwoord' },
];

export function AccountSettingsDialog({ open, onOpenChange }: AccountSettingsDialogProps) {
  const { user, sessionToken, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>('username');

  // Username state
  const [newUsername, setNewUsername] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError(null);
    setUsernameSuccess(false);

    const result = usernameSchema.safeParse({ newUsername });
    if (!result.success) {
      setUsernameError(result.error.errors[0].message);
      return;
    }

    setUsernameLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('update-account', {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
        body: {
          action: 'update_username',
          newUsername: newUsername.toLowerCase().trim(),
        },
      });

      if (error || data?.error) {
        setUsernameError(data?.error || error?.message || 'Er ging iets mis');
      } else {
        setUsernameSuccess(true);
        setNewUsername('');
        setTimeout(async () => {
          await signOut();
          window.location.href = '/login';
        }, 2000);
      }
    } catch {
      setUsernameError('Er ging iets mis bij het wijzigen');
    } finally {
      setUsernameLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    const result = passwordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!result.success) {
      setPasswordError(result.error.errors[0].message);
      return;
    }

    setPasswordLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('update-account', {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
        body: {
          action: 'update_password',
          currentPassword,
          newPassword,
        },
      });

      if (error || data?.error) {
        setPasswordError(data?.error || error?.message || 'Er ging iets mis');
      } else {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setPasswordError('Er ging iets mis bij het wijzigen');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setNewUsername('');
      setUsernameError(null);
      setUsernameSuccess(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setPasswordSuccess(false);
    }
    onOpenChange(open);
  };

  const initials = user?.naam ? user.naam.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="p-0 gap-0 sm:max-w-[520px] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Profiel & Beveiliging</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Beheer je accountgegevens</p>
        </div>

        <div className="flex min-h-[340px]">
          {/* Sidebar nav */}
          <div className="w-[168px] flex-shrink-0 border-r border-border bg-muted/30 p-2 flex flex-col gap-1">
            {/* User info */}
            <div className="flex items-center gap-2.5 px-2 py-2.5 mb-1">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate leading-tight">{user?.naam}</p>
                <p className="text-[10px] text-muted-foreground truncate leading-tight">{user?.email}</p>
              </div>
            </div>

            <div className="h-px bg-border mx-2 mb-1" />

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    'flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-left transition-colors cursor-pointer group',
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', isActive ? 'text-primary' : '')} />
                  <span className="text-xs font-medium">{item.label}</span>
                  {isActive && <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />}
                </button>
              );
            })}
          </div>

          {/* Content panel */}
          <div className="flex-1 p-5">
            {activeSection === 'username' && (
              <form onSubmit={handleUsernameSubmit} className="space-y-4 h-full flex flex-col">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Gebruikersnaam wijzigen</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Na het wijzigen word je automatisch uitgelogd.
                  </p>
                </div>

                {usernameError && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                    <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-destructive">{usernameError}</p>
                  </div>
                )}
                {usernameSuccess && (
                  <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-emerald-700">Gebruikersnaam gewijzigd. Je wordt uitgelogd...</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="newUsername" className="text-xs font-medium">Nieuwe gebruikersnaam</Label>
                  <Input
                    id="newUsername"
                    type="text"
                    placeholder="bijv. jansen"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    disabled={usernameLoading || usernameSuccess}
                    className="h-8 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Alleen letters en cijfers, minimaal 3 tekens</p>
                </div>

                <div className="mt-auto pt-2">
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full h-8 text-xs font-medium"
                    disabled={usernameLoading || usernameSuccess || !newUsername}
                  >
                    {usernameLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Opslaan...
                      </>
                    ) : (
                      'Gebruikersnaam opslaan'
                    )}
                  </Button>
                </div>
              </form>
            )}

            {activeSection === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-3.5 h-full flex flex-col">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Wachtwoord wijzigen</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gebruik een sterk wachtwoord van minimaal 8 tekens.
                  </p>
                </div>

                {passwordError && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                    <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-destructive">{passwordError}</p>
                  </div>
                )}
                {passwordSuccess && (
                  <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-emerald-700">Wachtwoord succesvol gewijzigd!</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword" className="text-xs font-medium">Huidig wachtwoord</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={passwordLoading}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-xs font-medium">Nieuw wachtwoord</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={passwordLoading}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-medium">Bevestig nieuw wachtwoord</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={passwordLoading}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="mt-auto pt-1">
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full h-8 text-xs font-medium"
                    disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                  >
                    {passwordLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Opslaan...
                      </>
                    ) : (
                      'Wachtwoord opslaan'
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
