import { LayoutDashboard, FileText, ClipboardList, Wrench, Zap, Users, Package, Calendar, Settings, UserCog, LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const allNav = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, feature: 'dashboard_ca' },
  { title: 'Factures', url: '/factures', icon: FileText, feature: 'factures' },
  { title: 'Devis', url: '/devis', icon: ClipboardList, feature: 'devis' },
  { title: 'Interventions', url: '/interventions', icon: Wrench, feature: 'interventions' },
];

const gestionNav = [
  { title: 'Clients', url: '/clients', icon: Users, feature: 'clients' },
  { title: 'Catalogue', url: '/catalogue', icon: Package, feature: 'clients' },
  { title: 'Agenda', url: '/agenda', icon: Calendar, feature: 'agenda' },
];

const adminNav = [
  { title: 'Utilisateurs', url: '/utilisateurs', icon: UserCog, feature: 'utilisateurs' },
  { title: 'Configuration', url: '/configuration', icon: Settings, feature: 'configuration' },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { canAccess, signOut, profile } = useAuthContext();

  const renderNav = (items: typeof allNav) =>
    items.filter(item => canAccess(item.feature)).map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === '/'}
            className="hover:bg-sidebar-accent"
            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
          >
            <item.icon className="mr-2 h-4 w-4" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-foreground">ÉlectroPro</span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNav(allNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Gestion</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNav(gestionNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {canAccess('configuration') && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Administration</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{renderNav(adminNav)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && profile && (
          <p className="text-xs text-muted-foreground truncate mb-2 px-1">{profile.nom || profile.email}</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Déconnexion</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
