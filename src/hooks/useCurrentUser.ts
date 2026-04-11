import { useState, useCallback } from 'react';

export type UserRole = 'admin' | 'secretaire' | 'technicien';

export interface AppUser {
  id: string;
  nom: string;
  email: string;
  role: UserRole;
  actif: boolean;
}

const MOCK_USERS: AppUser[] = [
  { id: '1', nom: 'Jean-Marc Dubois', email: 'jm.dubois@electropro.fr', role: 'admin', actif: true },
  { id: '2', nom: 'Marie Lefèvre', email: 'marie.l@electropro.fr', role: 'secretaire', actif: true },
  { id: '3', nom: 'Thomas Moreau', email: 'thomas.m@electropro.fr', role: 'technicien', actif: true },
  { id: '4', nom: 'Lucas Martin', email: 'lucas.m@electropro.fr', role: 'technicien', actif: true },
  { id: '5', nom: 'Nicolas Petit', email: 'nicolas.p@electropro.fr', role: 'technicien', actif: true },
];

export function useCurrentUser() {
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    return (localStorage.getItem('electropro-role') as UserRole) || 'admin';
  });

  const switchRole = useCallback((role: UserRole) => {
    setCurrentRole(role);
    localStorage.setItem('electropro-role', role);
  }, []);

  const currentUser = MOCK_USERS.find(u => u.role === currentRole) || MOCK_USERS[0];

  const canAccess = useCallback((feature: string): boolean => {
    const permissions: Record<string, UserRole[]> = {
      dashboard_ca: ['admin'],
      configuration: ['admin'],
      factures: ['admin'],
      clients: ['admin', 'secretaire'],
      devis: ['admin', 'secretaire'],
      agenda: ['admin', 'secretaire'],
      interventions: ['admin', 'secretaire', 'technicien'],
      upload: ['admin', 'secretaire', 'technicien'],
      utilisateurs: ['admin'],
    };
    return permissions[feature]?.includes(currentRole) ?? false;
  }, [currentRole]);

  return { currentUser, currentRole, switchRole, canAccess, allUsers: MOCK_USERS };
}
