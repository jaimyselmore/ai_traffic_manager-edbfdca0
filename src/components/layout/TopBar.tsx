import { Settings, LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function TopBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="flex h-14 items-center justify-end border-b border-border bg-card px-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/admin')}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          title="Instellingen"
        >
          <Settings className="h-5 w-5" />
        </button>
        <button
          className="p-2 rounded-full hover:bg-muted transition-colors"
          title={user?.naam || 'Gebruiker'}
        >
          <User className="h-5 w-5" />
        </button>
        <button
          onClick={handleLogout}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          title="Uitloggen"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
