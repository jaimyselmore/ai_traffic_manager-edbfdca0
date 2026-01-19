import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeroSectionProps {
  onTabChange?: (tab: 'overzicht' | 'planner' | 'agendas') => void;
}

const navItems = [
  { label: 'Overzicht', value: 'overzicht' as const },
  { label: 'Planner', value: 'planner' as const },
  { label: "Agenda's", value: 'agendas' as const }
];

export function HeroSection({ onTabChange }: HeroSectionProps) {
  const navigate = useNavigate();

  return (
    <section className="relative px-8 py-8">
      {/* Donkere overlay zoals Nosu - alleen over deze sectie */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/20 to-black/30 pointer-events-none" />

      {/* Navigation Bar - ELLEN in het midden, buttons links en rechts */}
      <div className="relative z-20 flex items-center justify-between">
        {/* Left Navigation - Grijze doorzichtige bolletjes */}
        <div className="flex gap-3">
          {navItems.map((item) => (
            <button
              key={item.value}
              onClick={() => onTabChange?.(item.value)}
              className="px-6 py-2.5 rounded-full bg-white/20 backdrop-blur-sm text-white/90 text-sm font-medium hover:bg-white/30 transition-all"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Center - ELLEN TITLE */}
        <h1 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-black text-white tracking-tighter" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.05em' }}>
          ELLEN
        </h1>

        {/* Right Settings - 1 vlak */}
        <button
          onClick={() => navigate('/admin')}
          className="px-6 py-2.5 rounded-full bg-white/20 backdrop-blur-sm text-white/90 text-sm font-medium hover:bg-white/30 transition-all flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          Instellingen
        </button>
      </div>
    </section>
  );
}
