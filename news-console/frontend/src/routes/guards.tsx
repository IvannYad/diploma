import { Navigate } from 'react-router-dom';
import { ADMIN_ROLE, CONNECTION_KEY, LOGIN_KEY, LOGIN_ROLE_KEY, PROCESSED_KEY } from '../lib/session';

export function RequireConnection({ children }: { children: React.ReactNode }) {
  if (sessionStorage.getItem(CONNECTION_KEY) !== '1') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function RequireLogin({ children }: { children: React.ReactNode }) {
  if (!sessionStorage.getItem(LOGIN_KEY)) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function RequireProcessed({ children }: { children: React.ReactNode }) {
  if (sessionStorage.getItem(PROCESSED_KEY) !== '1') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  if (sessionStorage.getItem(LOGIN_ROLE_KEY) !== ADMIN_ROLE) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
