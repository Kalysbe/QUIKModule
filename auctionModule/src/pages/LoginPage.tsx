import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/auth/AuthContext';
import { isMinfinRole } from '@/types/auth';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { login, user } = useAuth();
  const location = useLocation();
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo =
    (location.state as { from?: string } | null)?.from ??
    (user && isMinfinRole(user.role) ? '/' : '/');

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(loginValue.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <img src="/logo-kse.png" alt="Кыргызская фондовая биржа" className={styles.logo} />
          <h1 className={styles.title}>Аукционы ГЦБ</h1>
          <p className={styles.subtitle}>Вход в систему</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            label="Логин"
            value={loginValue}
            onChange={(event) => setLoginValue(event.target.value)}
            autoComplete="username"
            required
          />
          <Input
            label="Пароль"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          {error && <div className={styles.error}>{error}</div>}

          <Button type="submit" variant="primary" loading={submitting} className={styles.submit}>
            Войти
          </Button>
        </form>
      </div>
    </div>
  );
}
