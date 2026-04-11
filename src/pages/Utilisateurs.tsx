import { useState, useEffect } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { UserRole, Profile } from '@/hooks/useAuth';
import { useCreateDolibarrUser } from '@/hooks/useDolibarr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UserPlus, Shield, ShieldCheck, Wrench as WrenchIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const roleIcons: Record<UserRole, typeof Shield> = {
  admin: ShieldCheck,
  secretaire: Shield,
  technicien: WrenchIcon,
};

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrateur',
  secretaire: 'Secrétaire',
  technicien: 'Technicien',
};

const roleColors: Record<UserRole, string> = {
  admin: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  secretaire: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  technicien: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

interface UserWithRole extends Profile {
  role: UserRole;
}

export default function Utilisateurs() {
  const { role: currentRole } = useAuthContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('technicien');
  const { toast } = useToast();
  const dolibarrUserMutation = useCreateDolibarrUser();

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('user_roles').select('*'),
    ]);

    const profiles = (profilesRes.data || []) as Profile[];
    const roles = (rolesRes.data || []) as { user_id: string; role: UserRole }[];

    const merged: UserWithRole[] = profiles.map(p => {
      const userRole = roles.find(r => r.user_id === p.id);
      return { ...p, role: (userRole?.role as UserRole) || 'technicien' };
    });

    setUsers(merged);
    setLoadingUsers(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    if (!newNom || !newEmail) {
      toast({ title: 'Erreur', description: 'Nom et email sont requis.', variant: 'destructive' });
      return;
    }
    setCreating(true);

    const { data, error } = await supabase.functions.invoke('create-user', {
      body: { email: newEmail, nom: newNom, role: newRole },
    });

    setCreating(false);

    if (error || data?.error) {
      toast({ title: 'Erreur', description: data?.error || error?.message || 'Erreur inconnue', variant: 'destructive' });
      return;
    }

    toast({ title: 'Utilisateur créé', description: `Un email de confirmation a été envoyé à ${newEmail}.` });
    
    // Sync to Dolibarr
    const nameParts = newNom.trim().split(' ');
    const firstname = nameParts[0] || '';
    const lastname = nameParts.slice(1).join(' ') || firstname;
    dolibarrUserMutation.mutate({ login: newEmail.split('@')[0], firstname, lastname, email: newEmail });
    
    setDialogOpen(false);
    setNewNom('');
    setNewEmail('');
    setNewRole('technicien');
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Utilisateurs</h1>
          <p className="text-muted-foreground text-sm">Gestion des comptes et rôles</p>
        </div>
        {currentRole === 'admin' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0">
                <UserPlus className="h-4 w-4" /> Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/50">
              <DialogHeader><DialogTitle className="text-foreground">Nouvel utilisateur</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <Input placeholder="Nom complet" className="glass border-border/50" value={newNom} onChange={e => setNewNom(e.target.value)} />
                <Input placeholder="Email" type="email" className="glass border-border/50" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                  <SelectTrigger className="glass border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="secretaire">Secrétaire</SelectItem>
                    <SelectItem value="technicien">Technicien</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 border-0" onClick={handleCreate} disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Permissions matrix */}
      <div className="glass rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Matrice des permissions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-2 text-muted-foreground">Fonctionnalité</th>
                <th className="text-center py-2 px-2 text-blue-400">Admin</th>
                <th className="text-center py-2 px-2 text-violet-400">Secrétaire</th>
                <th className="text-center py-2 px-2 text-emerald-400">Technicien</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Dashboard (CA global)', true, false, false],
                ['Configuration', true, false, false],
                ['Factures', true, true, false],
                ['Clients, Devis, Agenda', true, true, false],
                ['Interventions', true, true, true],
                ['Upload photos/signatures', true, true, true],
              ].map(([feature, admin, sec, tech], i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="py-2 px-2 text-foreground">{feature as string}</td>
                  <td className="py-2 px-2 text-center">{admin ? '✅' : '❌'}</td>
                  <td className="py-2 px-2 text-center">{sec ? '✅' : '❌'}</td>
                  <td className="py-2 px-2 text-center">{tech ? '✅' : '❌'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users list */}
      <div className="glass rounded-xl p-5">
        {loadingUsers ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Nom</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Email</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Rôle</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const Icon = roleIcons[u.role] || Shield;
                  return (
                    <tr key={u.id} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                      <td className="py-3 px-2 font-medium text-foreground">{u.nom || '—'}</td>
                      <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell text-xs">{u.email}</td>
                      <td className="py-3 px-2">
                        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', roleColors[u.role] || '')}>
                          <Icon className="h-3 w-3" /> {roleLabels[u.role] || u.role}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs', u.actif ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground')}>
                          {u.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Aucun utilisateur trouvé</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
