import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface RequestBlockProps {
  label: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function RequestBlock({ label, description, icon: Icon, onClick, variant = 'secondary' }: RequestBlockProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-all hover:shadow-md',
        variant === 'primary'
          ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border-border bg-card text-foreground hover:border-primary/50 hover:bg-accent'
      )}
    >
      <div className={cn(
        'flex h-12 w-12 items-center justify-center rounded-lg',
        variant === 'primary' ? 'bg-primary-foreground/20' : 'bg-secondary'
      )}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h3 className="font-semibold text-base">{label}</h3>
        <p className={cn(
          'mt-1 text-sm leading-relaxed',
          variant === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground'
        )}>
          {description}
        </p>
      </div>
    </button>
  );
}
