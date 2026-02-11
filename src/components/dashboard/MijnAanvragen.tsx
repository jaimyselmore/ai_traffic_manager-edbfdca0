import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Send, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SavedAanvraag {
  id: string;
  type: 'nieuw-project' | 'wijziging' | 'meeting' | 'verlof';
  status: 'concept' | 'ingediend';
  titel: string;
  klant?: string;
  datum: string;
  projectType?: string;
  storageKey?: string; // localStorage key where form data is stored
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

  useEffect(() => {
    setAanvragen(getAanvragenLijst());
  }, []);

  const concepten = aanvragen.filter(a => a.status === 'concept');
  const ingediend = aanvragen.filter(a => a.status === 'ingediend');

  const handleDelete = (id: string) => {
    removeAanvraag(id);
    setAanvragen(getAanvragenLijst());
  };

  const renderAanvraag = (aanvraag: SavedAanvraag) => (
    <div
      key={aanvraag.id}
      className="flex items-center justify-between p-4 border border-border rounded-xl bg-card hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => {
        // For concepts, restore the form data from the linked storage key
        if (aanvraag.status === 'concept' && aanvraag.storageKey) {
          const conceptData = localStorage.getItem(aanvraag.storageKey);
          if (conceptData) {
            // Set the main storage key so the form loads this data
            const mainKey = TYPE_STORAGE_KEYS[aanvraag.type];
            if (mainKey) {
              localStorage.setItem(mainKey, conceptData);
            }
          }
        }
        navigate(TYPE_ROUTES[aanvraag.type] || '/');
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0">
          {aanvraag.status === 'concept' ? (
            <Clock className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Send className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {aanvraag.titel || 'Zonder titel'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-xs">
              {TYPE_LABELS[aanvraag.type] || aanvraag.type}
            </Badge>
            {aanvraag.klant && (
              <span className="text-xs text-muted-foreground">{aanvraag.klant}</span>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(aanvraag.datum).toLocaleDateString('nl-NL')}
            </span>
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="flex-shrink-0 h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          handleDelete(aanvraag.id);
        }}
      >
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );

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
            Ingediend ({ingediend.length})
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
            <p className="text-sm text-muted-foreground py-4 text-center">Geen ingediende aanvragen</p>
          ) : ingediend.map(renderAanvraag)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
