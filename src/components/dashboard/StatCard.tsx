import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: 'default' | 'warning' | 'danger' | 'success' | 'info';
}

const variantStyles = {
  default: 'bg-card border-border',
  warning: 'bg-warning/10 border-warning/30',
  danger: 'bg-destructive/10 border-destructive/30',
  success: 'bg-success/10 border-success/30',
  info: 'bg-primary/10 border-primary/30',
};

const iconStyles = {
  default: 'text-muted-foreground bg-secondary',
  warning: 'text-warning bg-warning/20',
  danger: 'text-destructive bg-destructive/20',
  success: 'text-success bg-success/20',
  info: 'text-primary bg-primary/20',
};

export function StatCard({ title, value, icon: Icon, variant = 'default' }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-xl border p-5 transition-all hover:shadow-md',
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
        </div>
        <div className={cn('rounded-lg p-2.5', iconStyles[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
