import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getSessionToken } from '@/lib/data/secureDataClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, KeyRound, AlertTriangle } from 'lucide-react';

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { clearMustChangePassword, user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validatie
    if (newPassword.length < 8) {
      setError('Nieuw wachtwoord moet minimaal 8 tekens zijn');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen');
      return;
    }

    if (currentPassword === newPassword) {
      setError('Nieuw wachtwoord moet anders zijn dan het huidige wachtwoord');
      return;
    }

    setIsSubmitting(true);

    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        setError('Je bent niet ingelogd');
        return;
      }

      const { data, error: invokeError } = await supabase.functions.invoke('update-account', {
        headers: { Authorization: `Bearer ${sessionToken}` },
        body: {
          action: 'change_password',
          currentPassword,
          newPassword,
        },
      });

      if (invokeError) {
        setError(invokeError.message || 'Er is een fout opgetreden');
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      // Succes - clear mustChangePassword en navigeer naar home
      clearMustChangePassword();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500">
            <KeyRound className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Wachtwoord wijzigen</CardTitle>
          <CardDescription>
            {user?.naam ? `Welkom ${user.naam}! ` : ''}
            Je moet je wachtwoord wijzigen om door te gaan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Dit is je eerste login of je wachtwoord is gereset. Kies een nieuw, veilig wachtwoord.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="currentPassword">Huidig (tijdelijk) wachtwoord</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nieuw wachtwoord</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">Minimaal 8 tekens</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Bevestig nieuw wachtwoord</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wachtwoord wijzigen...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Wachtwoord wijzigen
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
