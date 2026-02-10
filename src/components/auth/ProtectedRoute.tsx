import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowPasswordChange?: boolean; // Voor de change-password route zelf
  requireAdmin?: boolean; // Alleen toegankelijk voor admins
}

export function ProtectedRoute({ children, allowPasswordChange = false, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isLoading, mustChangePassword } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is a planner
  if (!user.isPlanner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Geen toegang</h1>
          <p className="text-muted-foreground">Je hebt geen planner rechten.</p>
        </div>
      </div>
    );
  }

  // Check if admin access is required
  if (requireAdmin && user.rol !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Geen toegang</h1>
          <p className="text-muted-foreground">Deze pagina is alleen toegankelijk voor beheerders.</p>
        </div>
      </div>
    );
  }

  // Check if user must change password
  if (mustChangePassword && !allowPasswordChange && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}
