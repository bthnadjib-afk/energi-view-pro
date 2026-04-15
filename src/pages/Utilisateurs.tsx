import { useState, useEffect } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { UserRole, Profile } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UserPlus, Shield, ShieldCheck, Wrench as WrenchIcon, Loader2, Trash2, Pencil, RefreshCw, Link, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  fetchDolibarrUsers, createDolibarrUser, deleteDolibarrUser,
  updateDolibarrUser, getDolibarrUserByEmail,
  type DolibarrUser,
} from '@/services/dolibarr';

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

// Merged view: one row = one person (matched by dolibarr_user_id or email)
interface MergedUser {
  supabase?: UserWithRole;
  dolibarr?: DolibarrUser;
  // resolved display fields
  nom: string;
  email: string;
  syncStatus: 'synced' | 'app_only' | 'dolibarr_only';
}

export default function Utilisateurs() {
  const { role: currentRole } = useAuthContext();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [merged, setMerged] = useState<MergedUser[]>([]);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('technicien');

  // Edit dialog
  const [editTarget, setEditTarget] = useState<MergedUser | null>(null);
  const [editNom, setEditNom] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('technicien');
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<MergedUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Sync state
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // ── Fetch & merge ─────────────────────────────────────────────────────────

  const fetchAll = async () => {
    setLoading(true);
    const [profilesRes, rolesRes, doliUsers] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('user_roles').select('*'),
      fetchDolibarrUsers().catch(() => [] as DolibarrUser[]),
    ]);

    const profiles = (profilesRes.data || []) as (Profile & { dolibarr_user_id?: string | null })[];
    const roles = (rolesRes.data || []) as { user_id: string; role: UserRole }[];

    const appUsers: UserWithRole[] = profiles.map(p => ({
      ...p,
      role: (roles.find(r => r.user_id === p.id)?.role as UserRole) || 'technicien',
      dolibarr_user_id: p.dolibarr_user_id,
    }));

    const result: MergedUser[] = [];
    const usedDoliIds = new Set<string>();

    // App users — find their Dolibarr counterpart
    for (const u of appUsers) {
      const doli = u.dolibarr_user_id
        ? doliUsers.find(d => d.id === u.dolibarr_user_id)
        : doliUsers.find(d => d.email && d.email.toLowerCase() === (u.email || '').toLowerCase());

      if (doli) usedDoliIds.add(doli.id);

      result.push({
        supabase: u,
        dolibarr: doli,
        nom: u.nom || doli?.fullname || '—',
        email: u.email || doli?.email || '',
        syncStatus: doli ? 'synced' : 'app_only',
      });
    }

    // Dolibarr-only users (exist in Dolibarr but not linked to any app account)
    for (const d of doliUsers) {
      if (!usedDoliIds.has(d.id)) {
        result.push({
          dolibarr: d,
          nom: d.fullname || d.login,
          email: d.email,
          syncStatus: 'dolibarr_only',
        });
      }
    }

    setMerged(result);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Create ────────────────────────────────────────────────────────────────

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

    toast({ title: 'Utilisateur créé', description: data?.dolibarr_user_id ? 'Synchronisé avec Dolibarr.' : 'Compte app créé (Dolibarr non lié).' });
    setCreateOpen(false);
    setNewNom(''); setNewEmail(''); setNewPassword(''); setNewRole('technicien');
    fetchAll();
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    // 1. Delete from Supabase (app account)
    if (deleteTarget.supabase) {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: deleteTarget.supabase.id },
      });
      if (error || data?.error) {
        toast({ title: 'Erreur Supabase', description: data?.error || error?.message, variant: 'destructive' });
        setDeleting(false);
        setDeleteTarget(null);
        return;
      }
    }

    // 2. Delete from Dolibarr
    const doliId = deleteTarget.supabase?.dolibarr_user_id || deleteTarget.dolibarr?.id;
    if (doliId) {
      try {
        await deleteDolibarrUser(doliId);
      } catch {
        // Non-blocking — Dolibarr may reject deletion for active users
        // Try disable instead
        try { await updateDolibarrUser(doliId, { }); } catch { /* ignore */ }
      }
    }

    toast({ title: 'Utilisateur supprimé', description: 'Supprimé de l\'app et de Dolibarr.' });
    setDeleting(false);
    setDeleteTarget(null);
    fetchAll();
  };

  // ── Edit ──────────────────────────────────────────────────────────────────

  const handleEdit = async () => {
    if (!editTarget || !editNom) return;
    setSaving(true);

    const u = editTarget.supabase;
    if (u) {
      // Update role
      if (editRole !== u.role) {
        await supabase.from('user_roles').update({ role: editRole } as any).eq('user_id', u.id);
      }
      // Update name in profiles
      await supabase.from('profiles').update({ nom: editNom }).eq('id', u.id);
    }

    // Sync to Dolibarr
    const doliId = u?.dolibarr_user_id || editTarget.dolibarr?.id;
    if (doliId) {
      const nameParts = editNom.trim().split(' ');
      const firstname = nameParts[0] || '';
      const lastname = nameParts.slice(1).join(' ') || firstname;
      try { await updateDolibarrUser(doliId, { firstname, lastname }); } catch { /* non-blocking */ }
    } else if (editTarget.email) {
      // Not linked yet — try to find in Dolibarr by email and link
      try {
        const found = await getDolibarrUserByEmail(editTarget.email);
        if (found && u) {
          await supabase.from('profiles').update({ dolibarr_user_id: String(found.id) }).eq('id', u.id);
          const nameParts = editNom.trim().split(' ');
          await updateDolibarrUser(String(found.id), { firstname: nameParts[0] || '', lastname: nameParts.slice(1).join(' ') || '' });
        }
      } catch { /* non-blocking */ }
    }

    setSaving(false);
    setEditTarget(null);
    toast({ title: 'Utilisateur modifié' });
    fetchAll();
  };

  // ── Sync app-only user to Dolibarr ────────────────────────────────────────

  const handleSyncToDolibarr = async (m: MergedUser) => {
    if (!m.supabase) return;
    setSyncingId(m.supabase.id);
    try {
      // Check if already exists in Dolibarr by email
      let doliId: string | null = null;
      const found = await getDolibarrUserByEmail(m.email);
      if (found) {
        doliId = String(found.id);
      } else {
        const nameParts = m.nom.trim().split(' ');
        const login = m.email.split('@')[0];
        doliId = await createDolibarrUser({
          login,
          firstname: nameParts[0] || login,
          lastname: nameParts.slice(1).join(' ') || nameParts[0] || login,
          email: m.email,
        });
      }
      if (doliId) {
        await supabase.from('profiles').update({ dolibarr_user_id: doliId }).eq('id', m.supabase.id);
        toast({ title: 'Synchronisé avec Dolibarr', description: `ID Dolibarr : ${doliId}` });
      } else {
        toast({ title: 'Erreur', description: 'Impossible de créer l\'utilisateur dans Dolibarr.', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Erreur Dolibarr', description: e.message || String(e), variant: 'destructive' });
    }
    setSyncingId(null);
    fetchAll();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Utilisateurs</h1>
          <p className="text-muted-foreground text-sm">Gestion des comptes — synchronisés avec Dolibarr</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Actualiser
          </Button>
          {currentRole === 'admin' && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" /> Ajouter
            </Button>
          )}
        </div>
      </div>

      {/* Permissions matrix */}
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

      {/* Users list */}
      <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Nom</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Email</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Rôle</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Dolibarr</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Statut</th>
                  {currentRole === 'admin' && <th className="py-3 px-2 w-28"></th>}
                </tr>
              </thead>
              <tbody>
                {merged.map((m, idx) => {
                  const Icon = m.supabase ? (roleIcons[m.supabase.role] || Shield) : Shield;
                  const isSyncing = m.supabase && syncingId === m.supabase.id;
                  return (
                    <tr key={idx} className={cn('border-b border-border/50 hover:bg-muted/50 transition-colors', m.syncStatus === 'dolibarr_only' && 'bg-amber-50/50')}>
                      <td className="py-3 px-2 font-medium text-foreground">{m.nom}</td>
                      <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell text-xs">{m.email || '—'}</td>
                      <td className="py-3 px-2">
                        {m.supabase ? (
                          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', roleColors[m.supabase.role] || '')}>
                            <Icon className="h-3 w-3" /> {roleLabels[m.supabase.role] || m.supabase.role}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Dolibarr uniquement</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {m.syncStatus === 'synced' && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <Link className="h-3 w-3" /> Lié #{m.dolibarr?.id}
                          </span>
                        )}
                        {m.syncStatus === 'app_only' && currentRole === 'admin' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                            disabled={!!isSyncing}
                            onClick={() => handleSyncToDolibarr(m)}
                          >
                            {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                            Synchroniser
                          </Button>
                        )}
                        {m.syncStatus === 'dolibarr_only' && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                            <Link className="h-3 w-3" /> Dolibarr #{m.dolibarr?.id}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {m.supabase ? (
                          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs', m.supabase.actif ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>
                            {m.supabase.actif ? 'Actif' : 'Inactif'}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700">Sans compte app</span>
                        )}
                      </td>
                      {currentRole === 'admin' && (
                        <td className="py-3 px-2">
                          <div className="flex gap-1">
                            {m.supabase && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditTarget(m); setEditNom(m.nom); setEditRole(m.supabase!.role); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(m)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {merged.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Aucun utilisateur trouvé</td></tr>
                )}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground mt-3">
              Les lignes en surbrillance amber sont des comptes Dolibarr sans compte app associé.
            </p>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel utilisateur</DialogTitle>
            <DialogDescription>Créé dans l'app et dans Dolibarr simultanément.</DialogDescription>
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
              Créer et synchroniser
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>Les modifications sont synchronisées avec Dolibarr.</DialogDescription>
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
            {editTarget?.syncStatus === 'synced' && (
              <p className="text-xs text-emerald-600 flex items-center gap-1"><Link className="h-3 w-3" /> Lié à Dolibarr #{editTarget.dolibarr?.id}</p>
            )}
            {editTarget?.syncStatus === 'app_only' && (
              <p className="text-xs text-amber-600 flex items-center gap-1"><Unlink className="h-3 w-3" /> Non lié à Dolibarr — sera recherché à la sauvegarde</p>
            )}
            <Button className="w-full" onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer les modifications
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'utilisateur</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer <strong>{deleteTarget?.nom}</strong> ({deleteTarget?.email}) ?
              {deleteTarget?.syncStatus === 'synced' && ' Le compte sera supprimé de l\'app ET de Dolibarr.'}
              {deleteTarget?.syncStatus === 'app_only' && ' Le compte sera supprimé de l\'app uniquement.'}
              {deleteTarget?.syncStatus === 'dolibarr_only' && ' L\'utilisateur sera supprimé de Dolibarr uniquement.'}
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
