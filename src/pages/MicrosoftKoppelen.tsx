import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface TokenValidation {
  valid: boolean;
  error?: string;
  employeeName?: string;
  email?: string;
  expiresAt?: string;
  alreadyConnected?: boolean;
}

export default function MicrosoftKoppelen() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState<TokenValidation | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  const validateToken = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('microsoft-validate-token', {
        body: { token },
      });

      if (error) {
        setValidation({ valid: false, error: 'Er is een fout opgetreden bij het valideren van de uitnodiging.' });
      } else {
        setValidation(data);
      }
    } catch {
      setValidation({ valid: false, error: 'Er is een fout opgetreden.' });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    setConnecting(true);
    // Redirect to Microsoft OAuth via our Edge Function with the token
    window.location.href = `${SUPABASE_URL}/functions/v1/microsoft-login/${token}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Uitnodiging controleren...</p>
        </div>
      </div>
    );
  }

  if (!validation?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Uitnodiging ongeldig
          </h1>
          <p className="text-muted-foreground mb-6">
            {validation?.error || 'Deze uitnodiging is niet meer geldig.'}
          </p>
          <p className="text-sm text-muted-foreground">
            Neem contact op met je beheerder voor een nieuwe uitnodiging.
          </p>
        </div>
      </div>
    );
  }

  if (validation.alreadyConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Al gekoppeld!
          </h1>
          <p className="text-muted-foreground mb-2">
            Je Microsoft agenda is al gekoppeld aan Ellen Planning.
          </p>
          <p className="text-sm text-muted-foreground">
            Je kunt dit venster sluiten.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Microsoft Agenda Koppelen
          </h1>
          <p className="text-muted-foreground">
            Koppel je Outlook agenda aan Ellen Planning
          </p>
        </div>

        {/* Employee info */}
        <div className="bg-slate-50 rounded-xl p-4 mb-6">
          <div className="text-sm text-muted-foreground mb-1">Medewerker</div>
          <div className="font-semibold text-foreground">{validation.employeeName}</div>
          <div className="text-sm text-muted-foreground mt-2 mb-1">E-mailadres</div>
          <div className="text-foreground">{validation.email}</div>
        </div>

        {/* What happens */}
        <div className="mb-6">
          <h3 className="font-medium text-foreground mb-3">Wat gebeurt er?</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Ellen kan je beschikbaarheid in je agenda bekijken</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Ellen kan afspraken in je agenda plaatsen</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <span>Ellen kan geen bestaande afspraken wijzigen of verwijderen</span>
            </li>
          </ul>
        </div>

        {/* Connect button */}
        <Button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full h-12 text-base"
        >
          {connecting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Doorsturen naar Microsoft...
            </>
          ) : (
            <>
              <svg className="h-5 w-5 mr-2" viewBox="0 0 21 21" fill="currentColor">
                <path d="M0 0h10v10H0z" />
                <path d="M11 0h10v10H11z" />
                <path d="M0 11h10v10H0z" />
                <path d="M11 11h10v10H11z" />
              </svg>
              Koppel met Microsoft
            </>
          )}
        </Button>

        {/* Footer */}
        <p className="text-xs text-center text-muted-foreground mt-6">
          Je wordt doorgestuurd naar Microsoft om in te loggen.
          <br />
          Wij slaan geen wachtwoorden op.
        </p>
      </div>
    </div>
  );
}
