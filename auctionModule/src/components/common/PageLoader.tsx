import styles from './PageLoader.module.css';

interface PageLoaderProps {
  message?: string;
  skeleton?: boolean;
}

export function PageLoader({
  message = 'Загрузка данных…',
  skeleton = false,
}: PageLoaderProps) {
  if (skeleton) {
    return (
      <div className={styles.loader}>
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loader}>
      <div className={styles.ring} />
      <span className={styles.text}>{message}</span>
    </div>
  );
}
