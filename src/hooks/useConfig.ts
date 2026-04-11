import { useState, useEffect, useCallback } from 'react';

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

  return { config, updateConfig, updateEntreprise, updateDefaults, updateNotifications, updateDolibarr };
}
