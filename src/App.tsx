import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import { RouteGuard } from "@/components/RouteGuard";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";
import Factures from "./pages/Factures";
import Devis from "./pages/Devis";
import Interventions from "./pages/Interventions";
import Clients from "./pages/Clients";
import Catalogue from "./pages/Catalogue";
import Agenda from "./pages/Agenda";
import Configuration from "./pages/Configuration";
import Utilisateurs from "./pages/Utilisateurs";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthenticatedApp() {
  const { loading, session, profile } = useAuthContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Block inactive accounts after login
  if (session && profile && !profile.actif) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-xl p-8 max-w-md text-center border border-border shadow-lg space-y-4">
          <h1 className="text-xl font-bold text-foreground">Compte désactivé</h1>
          <p className="text-muted-foreground text-sm">
            Votre compte a été désactivé par un administrateur. Contactez votre responsable pour le réactiver.
          </p>
          <button
            onClick={async () => {
              const { supabase } = await import('@/integrations/supabase/client');
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
            className="text-sm text-primary hover:underline"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border bg-card px-4 shadow-sm">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto bg-muted/30">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/factures" element={<RouteGuard feature="factures"><Factures /></RouteGuard>} />
              <Route path="/devis" element={<RouteGuard feature="devis"><Devis /></RouteGuard>} />
              <Route path="/interventions" element={<RouteGuard feature="interventions"><Interventions /></RouteGuard>} />
              <Route path="/clients" element={<RouteGuard feature="clients"><Clients /></RouteGuard>} />
              <Route path="/catalogue" element={<RouteGuard feature="factures"><Catalogue /></RouteGuard>} />
              <Route path="/agenda" element={<RouteGuard feature="agenda"><Agenda /></RouteGuard>} />
              <Route path="/configuration" element={<RouteGuard feature="configuration"><Configuration /></RouteGuard>} />
              <Route path="/utilisateurs" element={<RouteGuard feature="utilisateurs"><Utilisateurs /></RouteGuard>} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
