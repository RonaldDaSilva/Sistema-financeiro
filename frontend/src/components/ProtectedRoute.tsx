import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { LoadingState } from './LoadingState';
import { sanitizeInternalRedirect } from '../utils/redirect';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isAuthRestoring } = useAuth();
  const location = useLocation();

  if (isAuthRestoring) {
    return <LoadingState fullScreen label="Restaurando sessão" />;
  }

  if (!isAuthenticated) {
    const redirect = sanitizeInternalRedirect(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  return children;
}

