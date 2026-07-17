import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { changePasswordRequest } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { isAdminRole } from '@/types/auth';
import styles from './ChangePasswordPage.module.css';

export default function ChangePasswordPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdminRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Новый пароль и подтверждение не совпадают');
      return;
    }

    setSubmitting(true);

    try {
      await changePasswordRequest(currentPassword, newPassword);
      navigate('/login', {
        replace: true,
        state: { passwordChanged: true },
      });
      logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сменить пароль');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Смена пароля</h1>
        <p className={styles.subtitle}>
          После сохранения вы будете перенаправлены на страницу входа с новым паролем.
        </p>
      </div>

      <div className={styles.card}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            label="Текущий пароль"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <Input
            label="Новый пароль"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <Input
            label="Подтверждение нового пароля"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <Button type="submit" variant="primary" loading={submitting} className={styles.submit}>
              Сохранить
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/')}>
              Отмена
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
