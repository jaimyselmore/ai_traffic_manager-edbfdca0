import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useState } from 'react';

export type NotificationType = 'late' | 'upcoming' | 'review' | 'change' | 'active';

export interface Notification {
  id: string;
  type: NotificationType;
  client: string;
  project: string;
  workType: string;
  employee: string;
  deadline: string;
  severity: 'low' | 'medium' | 'high';
  isDone: boolean;
}

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  type: NotificationType;
  notifications: Notification[];
  onMarkDone: (id: string) => void;
}

const panelConfig: Record<NotificationType, { title: string; description: string; accentClass: string; badgeClass: string }> = {
  late: {
    title: 'Te laat',
    description: 'Taken waarvan de deadline is verstreken.',
    accentClass: 'text-destructive',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/30',
  },
  upcoming: {
    title: 'Aankomende deadlines',
    description: 'Deadlines die binnen een paar dagen naderen.',
    accentClass: 'text-warning',
    badgeClass: 'bg-warning/10 text-warning border-warning/30',
  },
  review: {
    title: 'Reviews',
    description: 'Items die wachten op review of feedback.',
    accentClass: 'text-primary',
    badgeClass: 'bg-primary/10 text-primary border-primary/30',
  },
  change: {
    title: 'Gemiste wijzigingen',
    description: 'Wijzigingen in projecten die je aandacht nodig hebben.',
    accentClass: 'text-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
  active: {
    title: 'Actieve projecten',
    description: 'Alle projecten die momenteel in uitvoering zijn.',
    accentClass: 'text-success',
    badgeClass: 'bg-success/10 text-success border-success/30',
  },
};

const severityLabels: Record<string, string> = {
  high: 'Urgent',
  medium: 'Gemiddeld',
  low: 'Laag',
};

export function NotificationPanel({
  isOpen,
  onClose,
  type,
  notifications,
  onMarkDone,
}: NotificationPanelProps) {
  const [activeTab, setActiveTab] = useState<'open' | 'done'>('open');
  const config = panelConfig[type];

  const openNotifications = notifications.filter((n) => !n.isDone);
  const doneNotifications = notifications.filter((n) => n.isDone);
  const displayedNotifications = activeTab === 'open' ? openNotifications : doneNotifications;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full max-w-md p-0 rounded-l-3xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 py-5 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className={cn('text-xl font-semibold', config.accentClass)}>
                  {config.title}
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground mt-1">
                  {config.description}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Tabs */}
          <div className="px-6 py-3 border-b border-border">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('open')}
                className={cn(
                  'px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
                  activeTab === 'open'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                Open ({openNotifications.length})
              </button>
              <button
                onClick={() => setActiveTab('done')}
                className={cn(
                  'px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
                  activeTab === 'done'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                Afgehandeld ({doneNotifications.length})
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {displayedNotifications.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">
                {activeTab === 'open' ? 'Geen openstaande items.' : 'Nog geen afgehandelde items.'}
              </div>
            ) : (
              displayedNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="bg-muted/30 rounded-2xl border border-border px-4 py-3 text-sm shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {notification.project}
                      </p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {notification.client}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                          {notification.workType}
                        </span>
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                          config.badgeClass
                        )}>
                          {severityLabels[notification.severity]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{notification.employee}</span>
                        <span>•</span>
                        <span>{notification.deadline}</span>
                      </div>
                    </div>
                    {!notification.isDone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 hover:bg-success/10 hover:text-success"
                        onClick={() => onMarkDone(notification.id)}
                        title="Markeer als afgehandeld"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
