import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: 'default' | 'warning' | 'danger' | 'success' | 'info';
  onClick?: () => void;
}

const variantStyles = {
  default: 'glass-card gradient-default',
  warning: 'glass-card gradient-warning',
  danger: 'glass-card gradient-danger',
  success: 'glass-card gradient-success',
  info: 'glass-card gradient-info',
};

const iconStyles = {
  default: 'text-white',
  warning: 'text-white',
  danger: 'text-white',
  success: 'text-white',
  info: 'text-white',
};

export function StatCard({ title, value, icon: Icon, variant = 'default', onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-6 rounded-2xl cursor-pointer',
        'hover-lift',
        variantStyles[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/80 uppercase tracking-wide">{title}</p>
          <p className="mt-3 text-4xl font-bold text-white">{value}</p>
        </div>
        <div className="rounded-xl p-3">
          <Icon className={cn('h-12 w-12', iconStyles[variant])} />
        </div>
      </div>
    </button>
  );
}
