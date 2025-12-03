import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface RequestButtonProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function RequestButton({ label, icon: Icon, onClick, variant = 'secondary' }: RequestButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-5 py-4 text-left transition-all',
        variant === 'primary'
          ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border-border bg-card text-foreground hover:border-primary/50 hover:bg-accent'
      )}
    >
      <div className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg',
        variant === 'primary' ? 'bg-primary-foreground/20' : 'bg-secondary'
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="font-medium">{label}</span>
    </button>
  );
}
