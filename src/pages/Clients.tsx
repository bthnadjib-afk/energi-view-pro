import { useState } from 'react';
import { useClients } from '@/hooks/useDolibarr';
import { UserPlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export default function Clients() {
  const { data: clients = [] } = useClients();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = clients.filter((c) =>
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    c.ville.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground text-sm">Répertoire clients — endpoint /thirdparties</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0">
              <UserPlus className="h-4 w-4" />
              Ajouter un client
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-border/50">
            <DialogHeader>
              <DialogTitle className="text-foreground">Nouveau client</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="Nom du client" className="glass border-border/50" />
              <Input placeholder="Ville" className="glass border-border/50" />
              <Input placeholder="Téléphone" className="glass border-border/50" />
              <Input placeholder="Email" type="email" className="glass border-border/50" />
              <Button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0" onClick={() => setDialogOpen(false)}>
                Enregistrer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 glass border-border/50"
        />
      </div>

      <div className="glass rounded-xl p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Nom</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Ville</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Téléphone</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden lg:table-cell">Email</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Projets</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                  <td className="py-3 px-2 font-medium text-foreground">{c.nom}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{c.ville}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden md:table-cell font-mono text-xs">{c.telephone}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden lg:table-cell text-xs">{c.email}</td>
                  <td className="py-3 px-2">
                    <span className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      c.projetsEnCours > 0
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        : 'bg-muted text-muted-foreground border-border/50'
                    )}>
                      {c.projetsEnCours} en cours
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
