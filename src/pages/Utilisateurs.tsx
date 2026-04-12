import { useState, useEffect } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { UserRole, Profile } from '@/hooks/useAuth';
import { useCreateDolibarrUser, useUpdateDolibarrUser } from '@/hooks/useDolibarr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UserPlus, Shield, ShieldCheck, Wrench as WrenchIcon, Loader2, Trash2, Pencil } from 'lucide-react';
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
  admin: 'bg-blue-100 text-blue-700 border-blue-200',
  secretaire: 'bg-violet-100 text-violet-700 border-violet-200',
  technicien: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

interface UserWithRole extends Profile {
  role: UserRole;
  dolibarr_user_id?: string | null;
}

export default function Utilisateurs() {
  const { role: currentRole } = useAuthContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('technicien');
  const [deleteTarget, setDeleteTarget] = useState<UserWithRole | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const dolibarrUserMutation = useCreateDolibarrUser();
  const updateDolibarrUserMutation = useUpdateDolibarrUser();

  // Edit state
  const [editTarget, setEditTarget] = useState<UserWithRole | null>(null);
  const [editNom, setEditNom] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('technicien');
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('user_roles').select('*'),
    ]);

    const profiles = (profilesRes.data || []) as (Profile & { dolibarr_user_id?: string | null })[];
    const roles = (rolesRes.data || []) as { user_id: string; role: UserRole }[];

    const merged: UserWithRole[] = profiles.map(p => {
      const userRole = roles.find(r => r.user_id === p.id);
      return { ...p, role: (userRole?.role as UserRole) || 'technicien', dolibarr_user_id: p.dolibarr_user_id };
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

    const body: any = { email: newEmail, nom: newNom, role: newRole };
    if (newPassword) body.password = newPassword;

    const { data, error } = await supabase.functions.invoke('create-user', { body });

    setCreating(false);

    if (error || data?.error) {
      toast({ title: 'Erreur', description: data?.error || error?.message || 'Erreur inconnue', variant: 'destructive' });
      return;
    }

    toast({ title: 'Utilisateur créé', description: `${newEmail} est actif immédiatement.` });
    
    // Sync to Dolibarr (await to persist dolibarr_user_id before refresh)
    const nameParts = newNom.trim().split(' ');
    const firstname = nameParts[0] || '';
    const lastname = nameParts.slice(1).join(' ') || firstname;
    try {
      await dolibarrUserMutation.mutateAsync({ login: newEmail.split('@')[0], firstname, lastname, email: newEmail });
    } catch (e) {
      console.warn('Dolibarr user sync failed (non-blocking):', e);
    }
    
    setDialogOpen(false);
    setNewNom('');
    setNewEmail('');
    setNewPassword('');
    setNewRole('technicien');
    fetchUsers();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { user_id: deleteTarget.id },
    });
    setDeleting(false);
    if (error || data?.error) {
      toast({ title: 'Erreur', description: data?.error || error?.message || 'Erreur inconnue', variant: 'destructive' });
    } else {
      toast({ title: 'Utilisateur supprimé' });
      fetchUsers();
    }
    setDeleteTarget(null);
  };

  const handleEdit = async () => {
    if (!editTarget || !editNom) return;
    setSaving(true);

    // Update role in Supabase
    if (editRole !== editTarget.role) {
      await supabase.from('user_roles').update({ role: editRole } as any).eq('user_id', editTarget.id);
    }

    // Update name in Supabase profiles
    await supabase.from('profiles').update({ nom: editNom }).eq('id', editTarget.id);

    // Update in Dolibarr if linked
    if (editTarget.dolibarr_user_id) {
      const nameParts = editNom.trim().split(' ');
      const firstname = nameParts[0] || '';
      const lastname = nameParts.slice(1).join(' ') || firstname;
      try {
        await updateDolibarrUserMutation.mutateAsync({ dolibarrUserId: editTarget.dolibarr_user_id, firstname, lastname });
      } catch {
        // Non-blocking
      }
    }

    setSaving(false);
    setEditTarget(null);
    toast({ title: 'Utilisateur modifié' });
    fetchUsers();
  };

  const openEdit = (u: UserWithRole) => {
    setEditTarget(u);
    setEditNom(u.nom);
    setEditRole(u.role);
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
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" /> Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvel utilisateur</DialogTitle>
                <DialogDescription className="sr-only">Formulaire de création utilisateur</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <Input placeholder="Nom complet" value={newNom} onChange={e => setNewNom(e.target.value)} />
                <Input placeholder="Email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                <Input placeholder="Mot de passe (optionnel)" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="secretaire">Secrétaire</SelectItem>
                    <SelectItem value="technicien">Technicien</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full" onClick={handleCreate} disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-3">Matrice des permissions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-muted-foreground">Fonctionnalité</th>
                <th className="text-center py-2 px-2 text-blue-600">Admin</th>
                <th className="text-center py-2 px-2 text-violet-600">Secrétaire</th>
                <th className="text-center py-2 px-2 text-emerald-600">Technicien</th>
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
                <tr key={i} className="border-b border-border/50">
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

      <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
        {loadingUsers ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Nom</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Email</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Rôle</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Statut</th>
                  {currentRole === 'admin' && <th className="text-left py-3 px-2 text-muted-foreground font-medium w-24"></th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const Icon = roleIcons[u.role] || Shield;
                  return (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-2 font-medium text-foreground">{u.nom || '—'}</td>
                      <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell text-xs">{u.email}</td>
                      <td className="py-3 px-2">
                        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', roleColors[u.role] || '')}>
                          <Icon className="h-3 w-3" /> {roleLabels[u.role] || u.role}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs', u.actif ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>
                          {u.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      {currentRole === 'admin' && (
                        <td className="py-3 px-2">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(u)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Aucun utilisateur trouvé</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit user dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription className="sr-only">Modifier le nom et le rôle</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Nom</label>
              <Input value={editNom} onChange={e => setEditNom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Email</label>
              <Input value={editTarget?.email || ''} disabled className="opacity-60" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Rôle</label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="secretaire">Secrétaire</SelectItem>
                  <SelectItem value="technicien">Technicien</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer les modifications
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'utilisateur</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{deleteTarget?.nom}</strong> ({deleteTarget?.email}) ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
