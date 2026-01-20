import { Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <section className="relative px-2 sm:px-4 md:px-6 lg:px-12 xl:px-20 2xl:px-32 py-12">
      {/* Navigation Bar Container - Nosu style met afgeronde vorm - iets breder dan content */}
      <div className="relative w-full mx-auto">
        {/* Donkere overlay achtergrond met afgeronde vorm zoals Nosu */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/20 to-black/30 rounded-[40px] backdrop-blur-md" />

        {/* Navigation Bar - ELLEN in het midden, buttons links en rechts */}
        <div className="relative z-20 flex items-center justify-between px-6 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-20 py-6">
          {/* Left - Navigation */}
          <div className="flex items-center gap-3">
            {/* Navigation */}
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

          {/* Center - ELLEN TITLE - Groter zoals NOSU */}
          <h1 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl md:text-8xl font-black text-white tracking-tighter" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.05em' }}>
            ELLEN
          </h1>

          {/* Right - User Avatar + Settings + Logout */}
          <div className="flex items-center gap-3">
            {/* User Avatar Circle */}
            {user && (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                {getInitials(user.naam)}
              </div>
            )}
            <button
              onClick={() => navigate('/admin')}
              className="p-2.5 rounded-full bg-white/20 backdrop-blur-sm text-white/90 hover:bg-white/30 transition-all"
              title="Instellingen"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-full bg-white/20 backdrop-blur-sm text-white/90 hover:bg-white/30 transition-all"
              title="Uitloggen"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
