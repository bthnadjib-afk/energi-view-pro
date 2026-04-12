import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
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
  const { loading, session } = useAuthContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
              <Route path="/factures" element={<Factures />} />
              <Route path="/devis" element={<Devis />} />
              <Route path="/interventions" element={<Interventions />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/catalogue" element={<Catalogue />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/configuration" element={<Configuration />} />
              <Route path="/utilisateurs" element={<Utilisateurs />} />
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
