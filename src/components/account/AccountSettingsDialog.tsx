import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Lock, CheckCircle } from 'lucide-react';
import { z } from 'zod';

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

export function AccountSettingsDialog({ open, onOpenChange }: AccountSettingsDialogProps) {
  const { user, sessionToken, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('username');

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

    // Validate
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
        // User needs to re-login with new username
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

    // Validate
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
      // Reset state when closing
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Account Instellingen</DialogTitle>
          <DialogDescription>
            Wijzig je gebruikersnaam of wachtwoord
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {user?.naam ? user.naam.split(' ').map(n => n[0]).join('') : 'U'}
            </div>
            <div>
              <p className="font-medium">{user?.naam}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="username" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Gebruikersnaam
              </TabsTrigger>
              <TabsTrigger value="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Wachtwoord
              </TabsTrigger>
            </TabsList>

            <TabsContent value="username" className="mt-4">
              <form onSubmit={handleUsernameSubmit} className="space-y-4">
                {usernameError && (
                  <Alert variant="destructive">
                    <AlertDescription>{usernameError}</AlertDescription>
                  </Alert>
                )}
                {usernameSuccess && (
                  <Alert className="border-green-500 bg-green-50 text-green-800">
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Gebruikersnaam gewijzigd! Je wordt uitgelogd om opnieuw in te loggen.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="newUsername">Nieuwe gebruikersnaam</Label>
                  <Input
                    id="newUsername"
                    type="text"
                    placeholder="jouw nieuwe naam"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    disabled={usernameLoading || usernameSuccess}
                  />
                  <p className="text-xs text-muted-foreground">
                    Alleen letters en cijfers, minimaal 3 tekens
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={usernameLoading || usernameSuccess || !newUsername}>
                  {usernameLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opslaan...
                    </>
                  ) : (
                    'Gebruikersnaam wijzigen'
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="password" className="mt-4">
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {passwordError && (
                  <Alert variant="destructive">
                    <AlertDescription>{passwordError}</AlertDescription>
                  </Alert>
                )}
                {passwordSuccess && (
                  <Alert className="border-green-500 bg-green-50 text-green-800">
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>Wachtwoord succesvol gewijzigd!</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Huidig wachtwoord</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={passwordLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nieuw wachtwoord</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={passwordLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimaal 8 tekens
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Bevestig nieuw wachtwoord</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={passwordLoading}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                >
                  {passwordLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opslaan...
                    </>
                  ) : (
                    'Wachtwoord wijzigen'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
