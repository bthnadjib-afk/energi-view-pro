import { useState } from 'react';
import { Settings, Eye, EyeOff, BookOpen, Sun, Moon, Mail, Lock, FileText, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUserPrefs } from '@/contexts/UserPrefsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthContext } from '@/contexts/AuthContext';
import TemplatePlayground from '@/components/TemplatePlayground';

export default function Preferences() {
  const { tutorialEnabled, setTutorialEnabled } = useUserPrefs();
  const { theme, toggleTheme } = useTheme();
  const { session } = useAuthContext();

  // Password change
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  // Email change
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const handleChangePassword = async () => {
    if (!newPwd || newPwd.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      toast.success('Mot de passe mis à jour');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (e: any) {
      toast.error(`Erreur : ${e.message || e}`);
    }
    setSavingPwd(false);
  };

  const handleChangeEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Adresse email invalide');
      return;
    }
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success('Un email de confirmation a été envoyé à la nouvelle adresse');
      setNewEmail('');
    } catch (e: any) {
      toast.error(`Erreur : ${e.message || e}`);
    }
    setSavingEmail(false);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6" /> Préférences
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Personnalisez votre expérience</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general" className="gap-2"><SlidersHorizontal className="h-4 w-4" /> Général</TabsTrigger>
          <TabsTrigger value="template" className="gap-2"><FileText className="h-4 w-4" /> Template</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6 max-w-2xl">

      {/* Apparence */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-base font-semibold text-foreground">Apparence</h2>

        <div className="flex items-center justify-between py-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium text-foreground">Thème</p>
              <p className="text-xs text-muted-foreground">{theme === 'dark' ? 'Mode sombre activé' : 'Mode clair activé'}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={toggleTheme} className="gap-2">
            {theme === 'dark' ? <><Sun className="h-3.5 w-3.5" /> Passer en clair</> : <><Moon className="h-3.5 w-3.5" /> Passer en sombre</>}
          </Button>
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Tutoriels intégrés</p>
              <p className="text-xs text-muted-foreground">Affiche les icônes d'aide (ⓘ) dans l'application</p>
            </div>
          </div>
          <Switch
            checked={tutorialEnabled}
            onCheckedChange={(v) => {
              setTutorialEnabled(v);
              toast.success(v ? 'Tutoriels activés' : 'Tutoriels désactivés');
            }}
          />
        </div>
      </div>

      {/* Sécurité du compte */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-base font-semibold text-foreground">Compte</h2>

        {session?.user?.email && (
          <p className="text-sm text-muted-foreground">
            Email actuel : <strong className="text-foreground">{session.user.email}</strong>
          </p>
        )}

        {/* Changer l'email */}
        <div className="space-y-3 pb-5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Changer l'adresse email</h3>
          </div>
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="Nouvelle adresse email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Un email de confirmation sera envoyé à la nouvelle adresse.</p>
          </div>
          <Button
            onClick={handleChangeEmail}
            disabled={savingEmail || !newEmail}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            {savingEmail ? 'Envoi...' : 'Envoyer la confirmation'}
          </Button>
        </div>

        {/* Changer le mot de passe */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Changer le mot de passe</h3>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showPwd ? 'text' : 'password'}
                placeholder="Nouveau mot de passe (8 caractères min.)"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPwd(v => !v)}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Input
              type={showPwd ? 'text' : 'password'}
              placeholder="Confirmer le nouveau mot de passe"
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={savingPwd || !newPwd || !confirmPwd}
            size="sm"
            className="gap-2"
          >
            {savingPwd ? 'Enregistrement...' : 'Changer le mot de passe'}
          </Button>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="template" className="mt-6">
          <TemplatePlayground />
        </TabsContent>
      </Tabs>
    </div>
  );
}
