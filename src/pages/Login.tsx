import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import logo from '@/assets/logo.png';
import logoDark from '@/assets/logo-dark.png';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: 'Erreur de connexion', description: error.message, variant: 'destructive' });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Email envoyé', description: 'Vérifiez votre boîte mail pour réinitialiser votre mot de passe.' });
      setForgotMode(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="bg-card rounded-xl p-8 w-full max-w-md space-y-6 border border-border shadow-lg">
        <div className="flex flex-col items-center gap-3">
          <img src={theme === 'dark' ? logoDark : logo} alt="Electricien Du Genevois" className="h-16 w-16 object-contain" />
          <h1 className="text-2xl font-bold text-foreground text-center">Electricien Du Genevois</h1>
          <p className="text-sm text-muted-foreground">
            {forgotMode ? 'Réinitialisation du mot de passe' : 'Connectez-vous à votre compte'}
          </p>
        </div>

        <form onSubmit={forgotMode ? handleForgotPassword : handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="votre@email.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {!forgotMode && (
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {forgotMode ? 'Envoyer le lien' : 'Se connecter'}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setForgotMode(!forgotMode)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {forgotMode ? '← Retour à la connexion' : 'Mot de passe oublié ?'}
          </button>
        </div>
      </div>
    </div>
  );
}
