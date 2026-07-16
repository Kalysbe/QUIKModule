import { Button } from '@/components/ui/Button';
import styles from './ErrorState.module.css';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Что-то пошло не так',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className={styles.error}>
      <span className={styles.icon} aria-hidden>
        ⚠
      </span>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <Button variant="primary" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  );
}
