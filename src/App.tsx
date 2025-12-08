import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NieuwProject from "./pages/NieuwProject";
import Wijzigingsverzoek from "./pages/Wijzigingsverzoek";
import Meeting from "./pages/Meeting";
import Verlof from "./pages/Verlof";
import AgendaResultaat from "./pages/AgendaResultaat";
import EllenConversationPage from "./pages/EllenConversationPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/nieuw-project" element={<NieuwProject />} />
          <Route path="/wijzigingsverzoek" element={<Wijzigingsverzoek />} />
          <Route path="/meeting" element={<Meeting />} />
          <Route path="/verlof" element={<Verlof />} />
          <Route path="/agenda-resultaat" element={<AgendaResultaat />} />
          <Route path="/ellen-session" element={<EllenConversationPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
