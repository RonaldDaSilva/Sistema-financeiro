import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { sanitizeInternalRedirect } from '../utils/redirect';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isAuthRestoring } = useAuth();
  const location = useLocation();

  if (isAuthRestoring) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center text-sm font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        Restaurando sessão...
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirect = sanitizeInternalRedirect(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  return children;
}

