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
        'group relative flex flex-col items-start gap-4 p-6 rounded-2xl text-left',
        'bg-white border-2 border-gray-200',
        'hover:scale-105 hover:shadow-xl hover:border-orange-400',
        'transition-all duration-300 cursor-pointer'
      )}
    >
      <div className={cn(
        'flex h-14 w-14 items-center justify-center rounded-xl',
        'bg-gradient-to-br from-orange-400 to-orange-500',
        'group-hover:shadow-lg transition-shadow'
      )}>
        <Icon className="h-7 w-7 text-white" />
      </div>
      <div>
        <h3 className="font-bold text-lg text-gray-900">{label}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          {description}
        </p>
      </div>
    </button>
  );
}
