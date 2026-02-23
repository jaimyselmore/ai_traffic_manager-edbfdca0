import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Send, Clock, Trash2, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface SavedAanvraag {
  id: string;
  type: 'nieuw-project' | 'wijziging' | 'meeting' | 'verlof';
  status: 'concept' | 'ingediend';
  resultaat?: 'gelukt' | 'mislukt';
  foutmelding?: string;
  titel: string;
  klant?: string;
  datum: string;
  projectType?: string;
  storageKey?: string;
  projectInfo?: any; // For retry
}

const TYPE_LABELS: Record<string, string> = {
  'nieuw-project': 'Nieuw project',
  'wijziging': 'Wijziging',
  'meeting': 'Meeting / Presentatie',
  'verlof': 'Beschikbaarheid',
};

const TYPE_ROUTES: Record<string, string> = {
  'nieuw-project': '/nieuw-project',
  'wijziging': '/wijzigingsverzoek',
  'meeting': '/meeting',
  'verlof': '/verlof',
};

const TYPE_STORAGE_KEYS: Record<string, string> = {
  'nieuw-project': 'concept_nieuw_project',
  'wijziging': 'concept_wijziging',
  'meeting': 'concept_meeting',
  'verlof': 'concept_verlof',
};

const STORAGE_KEY = 'aanvragen_lijst';

export function getAanvragenLijst(): SavedAanvraag[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveAanvraag(aanvraag: SavedAanvraag) {
  const lijst = getAanvragenLijst();
  const existingIndex = lijst.findIndex(a => a.id === aanvraag.id);
  if (existingIndex >= 0) {
    lijst[existingIndex] = aanvraag;
  } else {
    lijst.unshift(aanvraag);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lijst));
}

export function removeAanvraag(id: string) {
  const lijst = getAanvragenLijst();
  const aanvraag = lijst.find(a => a.id === id);
  // Clean up linked form data
  if (aanvraag?.storageKey) {
    localStorage.removeItem(aanvraag.storageKey);
  }
  const filtered = lijst.filter(a => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function MijnAanvragen() {
  const navigate = useNavigate();
  const [aanvragen, setAanvragen] = useState<SavedAanvraag[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<SavedAanvraag | null>(null);

  useEffect(() => {
    setAanvragen(getAanvragenLijst());
  }, []);

  const concepten = aanvragen.filter(a => a.status === 'concept');
  const ingediend = aanvragen.filter(a => a.status === 'ingediend');

  const handleDelete = (id: string) => {
    removeAanvraag(id);
    setAanvragen(getAanvragenLijst());
    setDeleteTarget(null);
  };

  const renderAanvraag = (aanvraag: SavedAanvraag) => {
    const isGelukt = aanvraag.resultaat === 'gelukt';
    const isMislukt = aanvraag.resultaat === 'mislukt';

    return (
      <div
        key={aanvraag.id}
        className={cn(
          'flex items-center justify-between p-4 border rounded-xl bg-card transition-colors',
          isGelukt && 'border-green-500/50 bg-green-50/30 dark:bg-green-950/10',
          isMislukt && 'border-destructive/50 bg-red-50/30 dark:bg-red-950/10',
          !isGelukt && !isMislukt && 'border-border hover:bg-accent/50 cursor-pointer'
        )}
        onClick={() => {
          if (isMislukt) return; // Don't navigate on failed items
          if (aanvraag.storageKey) {
            const savedData = localStorage.getItem(aanvraag.storageKey);
            if (savedData) {
              const mainKey = TYPE_STORAGE_KEYS[aanvraag.type];
              if (mainKey) {
                localStorage.setItem(mainKey, savedData);
              }
            }
          }
          navigate(TYPE_ROUTES[aanvraag.type] || '/');
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            {isGelukt ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : isMislukt ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : aanvraag.status === 'concept' ? (
              <Clock className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Send className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {aanvraag.titel || 'Zonder titel'}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {TYPE_LABELS[aanvraag.type] || aanvraag.type}
              </Badge>
              {isGelukt && (
                <Badge className="text-xs bg-green-600 hover:bg-green-700 text-white">Ingepland</Badge>
              )}
              {isMislukt && (
                <Badge variant="destructive" className="text-xs">Mislukt</Badge>
              )}
              {aanvraag.klant && (
                <span className="text-xs text-muted-foreground">{aanvraag.klant}</span>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(aanvraag.datum).toLocaleDateString('nl-NL')}
              </span>
            </div>
            {isMislukt && aanvraag.foutmelding && (
              <p className="text-xs text-destructive mt-1">{aanvraag.foutmelding}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isMislukt && aanvraag.projectInfo && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/ellen-voorstel', { state: { projectInfo: aanvraag.projectInfo } });
              }}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Opnieuw
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(aanvraag);
            }}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    );
  };

  if (aanvragen.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Nog geen aanvragen. Maak een nieuw project of wijziging aan.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <Tabs defaultValue="alle">
        <TabsList className="mb-4">
          <TabsTrigger value="alle">
            Alle ({aanvragen.length})
          </TabsTrigger>
          <TabsTrigger value="concepten">
            Concepten ({concepten.length})
          </TabsTrigger>
          <TabsTrigger value="ingediend">
            Ingevulde templates ({ingediend.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="alle" className="space-y-2">
          {aanvragen.map(renderAanvraag)}
        </TabsContent>
        <TabsContent value="concepten" className="space-y-2">
          {concepten.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Geen concepten</p>
          ) : concepten.map(renderAanvraag)}
        </TabsContent>
        <TabsContent value="ingediend" className="space-y-2">
          {ingediend.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Geen ingevulde templates</p>
          ) : ingediend.map(renderAanvraag)}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Template verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{deleteTarget?.titel || 'dit item'}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
