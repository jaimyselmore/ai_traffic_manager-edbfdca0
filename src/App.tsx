import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import Admin from "./pages/Admin";
import NieuwProject from "./pages/NieuwProject";
import Wijzigingsverzoek from "./pages/Wijzigingsverzoek";
import Meeting from "./pages/Meeting";
import Verlof from "./pages/Verlof";

import AgendaResultaat from "./pages/AgendaResultaat";
import NotFound from "./pages/NotFound";

// Initialize API (for development auth helper)
import { initializeAPI } from "./lib/api/init";
initializeAPI();

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ProtectedRoute allowPasswordChange><ChangePassword /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
            <Route path="/nieuw-project" element={<ProtectedRoute><NieuwProject /></ProtectedRoute>} />
            <Route path="/wijzigingsverzoek" element={<ProtectedRoute><Wijzigingsverzoek /></ProtectedRoute>} />
            <Route path="/meeting" element={<ProtectedRoute><Meeting /></ProtectedRoute>} />
            <Route path="/verlof" element={<ProtectedRoute><Verlof /></ProtectedRoute>} />
            <Route path="/agenda-resultaat" element={<ProtectedRoute><AgendaResultaat /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
