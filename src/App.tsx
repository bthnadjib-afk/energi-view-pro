import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { RouteGuard } from "@/components/RouteGuard";
import { Loader2, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Index from "./pages/Index";
import Factures from "./pages/Factures";
import Devis from "./pages/Devis";
import Interventions from "./pages/Interventions";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Catalogue from "./pages/Catalogue";
import Agenda from "./pages/Agenda";
import Configuration from "./pages/Configuration";
import Utilisateurs from "./pages/Utilisateurs";
import Fournisseurs from "./pages/Fournisseurs";
import Contrats from "./pages/Contrats";
import Projets from "./pages/Projets";
import Banque from "./pages/Banque";
import Stock from "./pages/Stock";
import Rapports from "./pages/Rapports";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function AuthenticatedApp() {
  const { loading, session, profile, role } = useAuthContext();

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
          <header className="h-14 flex items-center justify-between border-b border-border bg-card px-4 shadow-sm">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <ThemeToggle />
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto bg-muted/30">
            <Routes>
              <Route path="/" element={role === 'technicien' ? <Navigate to="/agenda" replace /> : <Index />} />
              {/* Facturation */}
              <Route path="/factures" element={<RouteGuard feature="factures"><Factures /></RouteGuard>} />
              <Route path="/devis" element={<RouteGuard feature="devis"><Devis /></RouteGuard>} />
              <Route path="/contrats" element={<RouteGuard feature="devis"><Contrats /></RouteGuard>} />
              {/* Interventions */}
              <Route path="/interventions" element={<RouteGuard feature="interventions"><Interventions /></RouteGuard>} />
              {/* Tiers */}
              <Route path="/clients" element={<RouteGuard feature="clients"><Clients /></RouteGuard>} />
              <Route path="/clients/:id" element={<RouteGuard feature="clients"><ClientDetail /></RouteGuard>} />
              <Route path="/fournisseurs" element={<RouteGuard feature="clients"><Fournisseurs /></RouteGuard>} />
              {/* Produits */}
              <Route path="/catalogue" element={<RouteGuard feature="factures"><Catalogue /></RouteGuard>} />
              <Route path="/stock" element={<RouteGuard feature="factures"><Stock /></RouteGuard>} />
              {/* Projets */}
              <Route path="/projets" element={<RouteGuard feature="agenda"><Projets /></RouteGuard>} />
              {/* Agenda */}
              <Route path="/agenda" element={<RouteGuard feature="agenda"><Agenda /></RouteGuard>} />
              {/* Finance */}
              <Route path="/banque" element={<RouteGuard feature="factures"><Banque /></RouteGuard>} />
              <Route path="/rapports" element={<RouteGuard feature="factures"><Rapports /></RouteGuard>} />
              {/* Admin */}
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
  <ThemeProvider>
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
  </ThemeProvider>
);

export default App;
