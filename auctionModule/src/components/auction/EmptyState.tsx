import styles from './EmptyState.module.css';

interface EmptyStateProps {
  todayOnly?: boolean;
}

export function EmptyState({ todayOnly }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <div className={styles.radar} aria-hidden>
        <div className={styles.ring} />
        <div className={styles.ring} />
        <div className={styles.ring} />
        <div className={styles.dot} />
        <div className={styles.sweep} />
      </div>
      <h2 className={styles.title}>Аукционов ГЦБ сейчас нет</h2>
      <p className={styles.hint}>
        {todayOnly
          ? 'На сегодня активных аукционов не найдено. Попробуйте отключить фильтр «Только сегодня», чтобы увидеть все запланированные торги.'
          : 'В данный момент в системе нет доступных аукционов государственных ценных бумаг. Загляните позже или включите фильтр «Только сегодня».'}
      </p>
    </div>
  );
}
