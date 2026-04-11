import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Index from "./pages/Index";
import Factures from "./pages/Factures";
import Devis from "./pages/Devis";
import Interventions from "./pages/Interventions";
import Clients from "./pages/Clients";
import Catalogue from "./pages/Catalogue";
import Agenda from "./pages/Agenda";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SidebarProvider>
          <div className="min-h-screen flex w-full">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <header className="h-14 flex items-center border-b border-border/50 px-4 glass-strong">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              </header>
              <main className="flex-1 p-4 md:p-6 overflow-auto">
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/factures" element={<Factures />} />
                  <Route path="/devis" element={<Devis />} />
                  <Route path="/interventions" element={<Interventions />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/catalogue" element={<Catalogue />} />
                  <Route path="/agenda" element={<Agenda />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
