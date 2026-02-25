import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, LogIn, Clock } from 'lucide-react';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minuten
const RATE_LIMIT_KEY = 'login_rate_limit';

interface RateLimitData {
  attempts: number;
  lockedUntil: number | null;
  lastAttempt: number;
}

function getRateLimitData(): RateLimitData {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return { attempts: 0, lockedUntil: null, lastAttempt: 0 };
}

function setRateLimitData(data: RateLimitData) {
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  // Check lockout status on mount and update countdown
  useEffect(() => {
    const checkLockout = () => {
      const data = getRateLimitData();
      if (data.lockedUntil && data.lockedUntil > Date.now()) {
        setIsLocked(true);
        setLockoutRemaining(Math.ceil((data.lockedUntil - Date.now()) / 1000));
      } else if (data.lockedUntil) {
        // Lockout expired, reset
        setRateLimitData({ attempts: 0, lockedUntil: null, lastAttempt: 0 });
        setIsLocked(false);
        setLockoutRemaining(0);
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Check rate limit
    const rateLimitData = getRateLimitData();

    if (rateLimitData.lockedUntil && rateLimitData.lockedUntil > Date.now()) {
      const remainingMinutes = Math.ceil((rateLimitData.lockedUntil - Date.now()) / 60000);
      setError(`Te veel inlogpogingen. Probeer het over ${remainingMinutes} minuten opnieuw.`);
      return;
    }

    setIsSubmitting(true);

    const { error } = await signIn(username.trim(), password);

    if (error) {
      // Increment failed attempts
      const newAttempts = rateLimitData.attempts + 1;
      const newData: RateLimitData = {
        attempts: newAttempts,
        lockedUntil: newAttempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_DURATION : null,
        lastAttempt: Date.now(),
      };
      setRateLimitData(newData);

      if (newAttempts >= MAX_ATTEMPTS) {
        setIsLocked(true);
        setLockoutRemaining(Math.ceil(LOCKOUT_DURATION / 1000));
        setError(`Te veel inlogpogingen (${MAX_ATTEMPTS}x). Je bent 15 minuten geblokkeerd.`);
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts;
        setError(`${error.message || 'Inloggen mislukt'}. Nog ${remaining} poging${remaining === 1 ? '' : 'en'} over.`);
      }

      setIsSubmitting(false);
      return;
    }

    // Success - reset rate limit
    setRateLimitData({ attempts: 0, lockedUntil: null, lastAttempt: 0 });
    navigate('/');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <span className="text-2xl font-bold text-primary-foreground">E</span>
          </div>
          <CardTitle className="text-2xl">Ellen Planning</CardTitle>
          <CardDescription>
            Log in met je planner account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">Gebruikersnaam</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Wachtwoord</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={isSubmitting || isLocked}>
              {isLocked ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Geblokkeerd ({formatTime(lockoutRemaining)})
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Inloggen...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Inloggen
                </>
              )}
            </Button>
          </form>
          
        </CardContent>
      </Card>
    </div>
  );
}
