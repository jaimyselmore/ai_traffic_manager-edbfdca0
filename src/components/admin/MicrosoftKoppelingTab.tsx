import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, XCircle, Loader2, Pencil, Check, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { getMedewerkers } from '@/lib/data/adminService';
import { secureUpdate } from '@/lib/data/secureDataClient';

interface MedewerkerStatus {
  werknemer_id: number;
  naam_werknemer: string;
  microsoft_email: string | null;
}

export function MicrosoftKoppelingTab() {
  const [medewerkerStatuses, setMedewerkerStatuses] = useState<MedewerkerStatus[]>([]);
  const [editingEmail, setEditingEmail] = useState<number | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [message, setMessage] = useState('');
  const { toast } = useToast();

  const { data: medewerkers = [], isLoading } = useQuery({
    queryKey: ['admin', 'medewerkers'],
    queryFn: getMedewerkers,
  });

  useEffect(() => {
    if (medewerkers.length > 0) {
      const statuses: MedewerkerStatus[] = medewerkers
        .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999))
        .map((mw) => ({
          werknemer_id: mw.werknemer_id,
          naam_werknemer: mw.naam_werknemer,
          microsoft_email: (mw as any).microsoft_email || null,
        }));
      setMedewerkerStatuses(statuses);
    }
  }, [medewerkers]);

  const startEditEmail = (werknemerId: number, currentEmail: string | null) => {
    setEditingEmail(werknemerId);
    setEmailInput(currentEmail || '');
  };

  const cancelEditEmail = () => {
    setEditingEmail(null);
    setEmailInput('');
  };

  const saveEmail = async (werknemerId: number) => {
    const email = emailInput.trim();

    if (email && !email.includes('@')) {
      setMessage('Voer een geldig e-mailadres in');
      return;
    }

    try {
      const { error } = await secureUpdate(
        'medewerkers',
        { microsoft_email: email || null },
        [{ column: 'werknemer_id', operator: 'eq', value: werknemerId }]
      );

      if (error) {
        setMessage('Fout bij opslaan e-mail');
      } else {
        setMedewerkerStatuses(prev =>
          prev.map(m =>
            m.werknemer_id === werknemerId
              ? { ...m, microsoft_email: email || null }
              : m
          )
        );
        toast({ title: email ? 'E-mailadres opgeslagen' : 'E-mailadres verwijderd' });
        setEditingEmail(null);
        setEmailInput('');
      }
    } catch {
      setMessage('Fout bij opslaan e-mail');
    }
  };

  const connectedCount = medewerkerStatuses.filter(m => m.microsoft_email).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">{connectedCount}</span> / {medewerkerStatuses.length} medewerkers gekoppeld
        </div>
      </div>

      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
        <AlertDescription className="text-blue-700 dark:text-blue-400 text-sm">
          Vul per medewerker het Microsoft 365 e-mailadres in. De app heeft via Application permissions automatisch toegang tot de agenda — medewerkers hoeven niets te doen.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4">Medewerkers worden geladen...</div>
      ) : medewerkerStatuses.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4">Geen medewerkers gevonden.</div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medewerker</TableHead>
                <TableHead>Microsoft e-mail</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {medewerkerStatuses.map(mw => (
                <TableRow key={mw.werknemer_id}>
                  <TableCell className="font-medium">{mw.naam_werknemer}</TableCell>
                  <TableCell>
                    {editingEmail === mw.werknemer_id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="naam@selmore.nl"
                          className="h-8 w-52 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEmail(mw.werknemer_id);
                            if (e.key === 'Escape') cancelEditEmail();
                          }}
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEmail(mw.werknemer_id)}>
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEditEmail}>
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {mw.microsoft_email || <span className="italic opacity-50">Niet ingesteld</span>}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-50 hover:opacity-100"
                          onClick={() => startEditEmail(mw.werknemer_id, mw.microsoft_email)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {mw.microsoft_email ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-700 dark:text-green-400">Actief</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Niet ingesteld</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
