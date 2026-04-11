import { type UserRole } from '@/hooks/useCurrentUser';
import { ReactNode } from 'react';

interface RoleGuardProps {
  role: UserRole | UserRole[];
  currentRole: UserRole;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGuard({ role, currentRole, children, fallback = null }: RoleGuardProps) {
  const roles = Array.isArray(role) ? role : [role];
  if (!roles.includes(currentRole)) return <>{fallback}</>;
  return <>{children}</>;
}
