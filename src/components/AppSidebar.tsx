import { useState } from 'react';
import {
  LayoutDashboard, FileText, ClipboardList, Wrench, Users, Package, Calendar,
  Settings, UserCog, LogOut, ShoppingCart, Truck, FileCheck, FolderOpen,
  Landmark, Warehouse, BarChart2, ChevronDown, Building2, BookOpen, SlidersHorizontal, Globe,
} from 'lucide-react';
import logo from '@/assets/logo.png';
import logoDark from '@/assets/logo-dark.png';
import { useTheme } from '@/contexts/ThemeContext';
import { NavLink } from '@/components/NavLink';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  SidebarSeparator, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<any>;
  feature: string;
  children?: { title: string; url: string; icon: React.ComponentType<any>; feature: string }[];
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Principal',
    items: [
      { title: 'Tableau de bord', url: '/', icon: LayoutDashboard, feature: 'dashboard_ca' },
      { title: 'Agenda', url: '/agenda', icon: Calendar, feature: 'agenda' },
    ],
  },
  {
    label: 'Commercial',
    items: [
      { title: 'Devis', url: '/devis', icon: ClipboardList, feature: 'devis' },
      { title: 'Interventions', url: '/interventions', icon: Wrench, feature: 'interventions' },
    ],
  },
  {
    label: 'Facturation',
    items: [
      { title: 'Factures', url: '/factures', icon: FileText, feature: 'factures' },
      { title: 'Banque', url: '/banque', icon: Landmark, feature: 'factures' },
      { title: 'Rapports', url: '/rapports', icon: BarChart2, feature: 'factures' },
    ],
  },
  {
    label: 'Tiers',
    items: [
      { title: 'Clients', url: '/clients', icon: Users, feature: 'clients' },
      {
        title: 'Clients Pro', url: '/clients?type=professionnel', icon: Building2, feature: 'clients',
        children: [
          { title: 'Liste des pros', url: '/clients?type=professionnel', icon: Building2, feature: 'clients' },
          { title: 'Projets', url: '/projets', icon: FolderOpen, feature: 'agenda' },
          { title: 'Contrats', url: '/contrats', icon: FileCheck, feature: 'devis' },
        ],
      },
      { title: 'Fournisseurs', url: '/fournisseurs', icon: Truck, feature: 'clients' },
      { title: 'Sourcing fournisseurs', url: '/sourcing', icon: Globe, feature: 'configuration' },
    ],
  },
  {
    label: 'Produits & Stock',
    items: [
      {
        title: 'Catalogue', url: '/catalogue', icon: Package, feature: 'clients',
        children: [
          { title: 'Articles', url: '/catalogue', icon: Package, feature: 'clients' },
          { title: 'Forfaits', url: '/lots', icon: BookOpen, feature: 'clients' },
        ],
      },
      { title: 'Stock', url: '/stock', icon: Warehouse, feature: 'factures' },
    ],
  },
];

const adminNav: NavItem[] = [
  { title: 'Configuration', url: '/configuration', icon: Settings, feature: 'configuration' },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { theme } = useTheme();
  const { canAccess, signOut, profile } = useAuthContext();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) =>
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const renderItem = (item: NavItem) => {
    if (!canAccess(item.feature)) return null;

    if (item.children && !collapsed) {
      const key = item.url;
      const isOpen = openGroups[key] !== false; // open by default
      return (
        <SidebarMenuItem key={item.title}>
          <Collapsible open={isOpen} onOpenChange={() => toggleGroup(key)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton className="w-full justify-between hover:bg-sidebar-accent">
                <div className="flex items-center">
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.title}</span>
                </div>
                <ChevronDown className={cn('h-3 w-3 transition-transform text-muted-foreground', isOpen && 'rotate-180')} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {item.children.filter(c => canAccess(c.feature)).map(child => (
                  <SidebarMenuSubItem key={child.title}>
                    <SidebarMenuSubButton asChild>
                      <NavLink
                        to={child.url}
                        end={child.url === '/'}
                        className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-primary/15 text-primary font-medium [&_svg]:text-primary"
                      >
                        <child.icon className="mr-2 h-3 w-3" />
                        <span className="text-xs">{child.title}</span>
                      </NavLink>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === '/'}
            className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeClassName="bg-primary/15 text-primary font-medium [&_svg]:text-primary"
          >
            <item.icon className="mr-2 h-4 w-4" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className={cn(collapsed ? "p-2" : "p-3")}>
        <div className="flex items-center justify-center w-full">
          <img
            src={theme === 'dark' ? logoDark : logo}
            alt="Electricien Du Genevois"
            className={cn(
              "object-contain transition-all",
              collapsed ? "h-10 w-10" : "h-32 w-full max-w-[200px]"
            )}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group, gi) => {
          const visibleItems = group.items.filter(item => canAccess(item.feature));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              {gi > 0 && <SidebarSeparator />}
              <SidebarGroup>
                {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleItems.map(renderItem)}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </div>
          );
        })}

        {canAccess('configuration') && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              {!collapsed && <SidebarGroupLabel>Administration</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminNav.filter(item => canAccess(item.feature)).map(item => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          activeClassName="bg-primary/15 text-primary font-medium [&_svg]:text-primary"
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
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
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground mt-1"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Déconnexion</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
