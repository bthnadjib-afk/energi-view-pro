import { useAuthContext } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';

interface RouteGuardProps {
  feature: string;
  children: ReactNode;
}

export function RouteGuard({ feature, children }: RouteGuardProps) {
  const { canAccess, loading } = useAuthContext();

  if (loading) return null;

  if (!canAccess(feature)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
