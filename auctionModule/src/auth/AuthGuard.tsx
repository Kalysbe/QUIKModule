import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import { useAuth } from '@/auth/AuthContext';

export function AuthGuard() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader message="Проверка авторизации…" />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function GuestGuard() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader message="Загрузка…" />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
