import { useState, useEffect, useCallback, useRef } from 'react';
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
    chantierHeureDebut: string;
    chantierHeureFin: string;
    chantierJours: string;
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
  template: {
    logoUrl: string;        // URL du logo (depuis le bucket document-logos), vide = défaut
    couleurPrimaire: string;  // hex ex #1a1a1a — bandeau, titres
    couleurAccent: string;    // hex ex #cc0000 — alertes, acomptes
    couleurTexte: string;     // hex ex #1a1a1a
    police: 'helvetica' | 'times' | 'courier' | 'roboto';
    margeHaut: number;        // mm
    margeBas: number;         // mm
    margeGauche: number;      // mm
    margeDroite: number;      // mm
    tailleTitre: number;      // pt (ex 22)
    tailleTexte: number;      // pt (ex 8.5)
    piedDePage: string;       // texte libre du footer
    afficherRib: boolean;
    afficherCgv: boolean;
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
    chantierHeureDebut: '08:00',
    chantierHeureFin: '18:00',
    chantierJours: '1,2,3,4,5',
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
    port: '465',
    user: '',
    pass: '',
    from: '',
  },
  template: {
    logoUrl: '',
    couleurPrimaire: '#1a1a1a',
    couleurAccent: '#cc0000',
    couleurTexte: '#1a1a1a',
    police: 'roboto',
    margeHaut: 18,
    margeBas: 20,
    margeGauche: 15,
    margeDroite: 15,
    tailleTitre: 22,
    tailleTexte: 8.5,
    piedDePage: '',
    afficherRib: true,
    afficherCgv: true,
  },
};

function flattenConfig(cfg: AppConfig): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [section, values] of Object.entries(cfg)) {
    if (typeof values === 'object' && values !== null) {
      for (const [field, val] of Object.entries(values)) {
        flat[`${section}.${field}`] = String(val);
      }
    }
  }
  return flat;
}

function parseRemoteConfig(remote: Record<string, string>): Partial<AppConfig> {
  const parsed: Partial<AppConfig> = {};
  for (const [key, value] of Object.entries(remote)) {
    try {
      const dotIdx = key.indexOf('.');
      if (dotIdx === -1) continue;
      const section = key.slice(0, dotIdx);
      const field = key.slice(dotIdx + 1);
      if (!section || !field) continue;
      if (!parsed[section as keyof AppConfig]) {
        parsed[section as keyof AppConfig] = { ...(DEFAULT_CONFIG as any)[section] } as any;
      }
      const sectionObj = parsed[section as keyof AppConfig] as any;
      const defaultValue = (DEFAULT_CONFIG as any)[section]?.[field];

      if (typeof defaultValue === 'boolean') sectionObj[field] = value === 'true';
      else if (typeof defaultValue === 'number') sectionObj[field] = value === '' ? defaultValue : Number(value);
      else sectionObj[field] = value;
    } catch { /* skip malformed keys */ }
  }
  return parsed;
}

export function useConfig() {
  const [config, setConfigState] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem('electropro-config');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Deep merge with defaults to ensure all keys exist
        const merged: AppConfig = { ...DEFAULT_CONFIG };
        for (const section of Object.keys(DEFAULT_CONFIG) as (keyof AppConfig)[]) {
          if (parsed[section] && typeof parsed[section] === 'object') {
            (merged as any)[section] = { ...(DEFAULT_CONFIG as any)[section], ...parsed[section] };
          }
        }
        return merged;
      }
    } catch { /* ignore */ }
    return DEFAULT_CONFIG;
  });

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from Supabase on mount — works for ALL authenticated users
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); initialLoadDone.current = true; return; }

        const { data, error } = await supabase.functions.invoke('manage-config', { method: 'GET' });
        if (error || !data) { setLoading(false); initialLoadDone.current = true; return; }

        const remote = data as Record<string, string>;
        if (Object.keys(remote).length > 0) {
          const parsed = parseRemoteConfig(remote);
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
      // Mark initial load done after a tick so the auto-save effect doesn't fire on mount
      setTimeout(() => { initialLoadDone.current = true; }, 200);
    })();
  }, []);

  // Always keep localStorage in sync
  useEffect(() => {
    localStorage.setItem('electropro-config', JSON.stringify(config));
  }, [config]);

  // Auto-save to Supabase 2 seconds after any change (admin only — non-admins get 403, ignored silently)
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await supabase.functions.invoke('manage-config', {
          method: 'POST',
          body: flattenConfig(config),
        });
      } catch { /* silent — 403 for non-admins is expected */ }
    }, 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
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

  const updateTemplate = useCallback((updates: Partial<AppConfig['template']>) => {
    setConfigState(prev => ({ ...prev, template: { ...prev.template, ...updates } }));
  }, []);

  // Manual save — shows toast confirmation, for the "Sauvegarder les paramètres" button
  const saveToSupabase = useCallback(async () => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('manage-config', {
        method: 'POST',
        body: flattenConfig(config),
      });
      if (error) throw error;
      toast.success('Configuration sauvegardée');
    } catch (e: any) {
      toast.error(`Erreur sauvegarde : ${e.message || e}`);
    }
    setSaving(false);
  }, [config]);

  return { config, loading, saving, updateConfig, updateEntreprise, updateDefaults, updateNotifications, updateDolibarr, updateSmtp, updateTemplate, saveToSupabase };
}
