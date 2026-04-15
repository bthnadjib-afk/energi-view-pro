import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AppConfig {
  entreprise: {
    nom: string;
    adresse: string;
    codePostal: string;
    ville: string;
    siret: string;
    telephone: string;
    email: string;
  };
  defaults: {
    tauxTVA: number;
    delaiPaiement: number;
    dureeIntervention: number;
    tauxHoraire: number;
  };
  notifications: {
    nouveauDevis: boolean;
    interventionPlanifiee: boolean;
    factureEnRetard: boolean;
  };
  dolibarr: {
    apiUrl: string;
    apiKey: string;
    connected: boolean;
  };
  smtp: {
    host: string;
    port: string;
    user: string;
    pass: string;
    from: string;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  entreprise: {
    nom: 'Électricien du Genevois',
    adresse: '',
    codePostal: '',
    ville: '',
    siret: '',
    telephone: '',
    email: '',
  },
  defaults: {
    tauxTVA: 20,
    delaiPaiement: 30,
    dureeIntervention: 2,
    tauxHoraire: 45,
  },
  notifications: {
    nouveauDevis: true,
    interventionPlanifiee: true,
    factureEnRetard: true,
  },
  dolibarr: {
    apiUrl: '',
    apiKey: '',
    connected: false,
  },
  smtp: {
    host: '',
    port: '587',
    user: '',
    pass: '',
    from: '',
  },
};

export function useConfig() {
  const [config, setConfigState] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem('electropro-config');
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load from Supabase on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        const { data, error } = await supabase.functions.invoke('manage-config', { method: 'GET' });
        if (error || !data) { setLoading(false); return; }

        // data is a Record<string, string>
        const remote = data as Record<string, string>;
        if (Object.keys(remote).length > 0) {
          const parsed: Partial<AppConfig> = {};
          for (const [key, value] of Object.entries(remote)) {
            try {
              const [section, field] = key.split('.');
              if (section && field) {
                if (!parsed[section as keyof AppConfig]) {
                  parsed[section as keyof AppConfig] = { ...(DEFAULT_CONFIG as any)[section] } as any;
                }
                const sectionObj = parsed[section as keyof AppConfig] as any;
                // Try to parse numbers and booleans
                if (value === 'true') sectionObj[field] = true;
                else if (value === 'false') sectionObj[field] = false;
                else if (!isNaN(Number(value)) && value !== '') sectionObj[field] = Number(value);
                else sectionObj[field] = value;
              }
            } catch { /* skip malformed keys */ }
          }
          setConfigState(prev => {
            const merged = { ...prev };
            for (const [k, v] of Object.entries(parsed)) {
              (merged as any)[k] = { ...(merged as any)[k], ...v };
            }
            localStorage.setItem('electropro-config', JSON.stringify(merged));
            return merged;
          });
        }
      } catch (e) {
        console.warn('Failed to load remote config:', e);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem('electropro-config', JSON.stringify(config));
  }, [config]);

  const updateConfig = useCallback((updates: Partial<AppConfig>) => {
    setConfigState(prev => ({ ...prev, ...updates }));
  }, []);

  const updateEntreprise = useCallback((updates: Partial<AppConfig['entreprise']>) => {
    setConfigState(prev => ({ ...prev, entreprise: { ...prev.entreprise, ...updates } }));
  }, []);

  const updateDefaults = useCallback((updates: Partial<AppConfig['defaults']>) => {
    setConfigState(prev => ({ ...prev, defaults: { ...prev.defaults, ...updates } }));
  }, []);

  const updateNotifications = useCallback((updates: Partial<AppConfig['notifications']>) => {
    setConfigState(prev => ({ ...prev, notifications: { ...prev.notifications, ...updates } }));
  }, []);

  const updateDolibarr = useCallback((updates: Partial<AppConfig['dolibarr']>) => {
    setConfigState(prev => ({ ...prev, dolibarr: { ...prev.dolibarr, ...updates } }));
  }, []);

  const updateSmtp = useCallback((updates: Partial<AppConfig['smtp']>) => {
    setConfigState(prev => ({ ...prev, smtp: { ...prev.smtp, ...updates } }));
  }, []);

  const saveToSupabase = useCallback(async () => {
    setSaving(true);
    try {
      const flat: Record<string, string> = {};
      for (const [section, values] of Object.entries(config)) {
        if (typeof values === 'object' && values !== null) {
          for (const [field, val] of Object.entries(values)) {
            flat[`${section}.${field}`] = String(val);
          }
        }
      }
      const { error } = await supabase.functions.invoke('manage-config', {
        method: 'POST',
        body: flat,
      });
      if (error) throw error;
      toast.success('Configuration sauvegardée');
    } catch (e: any) {
      toast.error(`Erreur sauvegarde : ${e.message || e}`);
    }
    setSaving(false);
  }, [config]);

  return { config, loading, saving, updateConfig, updateEntreprise, updateDefaults, updateNotifications, updateDolibarr, updateSmtp, saveToSupabase };
}
