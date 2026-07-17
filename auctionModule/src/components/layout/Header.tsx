import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/auth/AuthContext';
import {
  canAccessDirectories,
  canAccessFullAuction,
  getUserDisplayName,
  isAdminRole,
  isMinfinRole,
} from '@/types/auth';
import styles from './Header.module.css';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isHome = location.pathname === '/';
  const isDirectories = location.pathname.startsWith('/directories');
  const isPasswordPage = location.pathname.startsWith('/profile/password');
  const isMinfin = isMinfinRole(user?.role);
  const showDirectories = canAccessDirectories(user?.role);
  const showChangePassword = isAdminRole(user?.role);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.brand}>
          <img
            src="/logo-kse.png"
            alt="Кыргызская фондовая биржа"
            className={styles.logo}
          />
          <div className={styles.titles}>
            <h1 className={styles.title}>Аукционы ГЦБ</h1>
            <p className={styles.subtitle}>
              {isMinfin ? 'Ведомости' : 'Государственные ценные бумаги'}
            </p>
          </div>
        </Link>
        <div className={styles.right}>
          <nav className={styles.nav}>
            <Link
              to="/"
              className={`${styles.navLink} ${isHome ? styles.navLinkActive : ''}`}
            >
              {isMinfin ? 'Список ведомостей' : 'Список аукционов'}
            </Link>
            {showDirectories && (
              <Link
                to="/directories"
                className={`${styles.navLink} ${isDirectories ? styles.navLinkActive : ''}`}
              >
                Справочники
              </Link>
            )}
            {showChangePassword && (
              <Link
                to="/profile/password"
                className={`${styles.navLink} ${isPasswordPage ? styles.navLinkActive : ''}`}
              >
                Пароль
              </Link>
            )}
          </nav>
          {user && (
            <div className={styles.userBlock}>
              <div className={styles.userMeta}>
                <span className={styles.userName}>{getUserDisplayName(user)}</span>
                <span className={styles.userRole}>
                  {canAccessFullAuction(user.role) ? user.role : 'Минфин'}
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                Выйти
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
