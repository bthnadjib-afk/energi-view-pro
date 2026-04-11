import { useState } from 'react';
import { useCurrentUser, type UserRole } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UserPlus, Shield, ShieldCheck, Wrench as WrenchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function Utilisateurs() {
  const { allUsers, currentRole, switchRole } = useCurrentUser();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Utilisateurs</h1>
          <p className="text-muted-foreground text-sm">Gestion des comptes et rôles</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="glass rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Tester en tant que :</span>
            <Select value={currentRole} onValueChange={(v) => switchRole(v as UserRole)}>
              <SelectTrigger className="w-[140px] h-8 text-xs glass border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="secretaire">Secrétaire</SelectItem>
                <SelectItem value="technicien">Technicien</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0">
                <UserPlus className="h-4 w-4" /> Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/50">
              <DialogHeader><DialogTitle className="text-foreground">Nouvel utilisateur</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <Input placeholder="Nom complet" className="glass border-border/50" />
                <Input placeholder="Email" type="email" className="glass border-border/50" />
                <Select defaultValue="technicien">
                  <SelectTrigger className="glass border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="secretaire">Secrétaire</SelectItem>
                    <SelectItem value="technicien">Technicien</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 border-0" onClick={() => setDialogOpen(false)}>Enregistrer</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
                ['Factures', true, false, false],
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
              {allUsers.map((u) => {
                const Icon = roleIcons[u.role];
                return (
                  <tr key={u.id} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                    <td className="py-3 px-2 font-medium text-foreground">{u.nom}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell text-xs">{u.email}</td>
                    <td className="py-3 px-2">
                      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', roleColors[u.role])}>
                        <Icon className="h-3 w-3" /> {roleLabels[u.role]}
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
