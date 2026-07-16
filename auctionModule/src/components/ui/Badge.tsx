import { getStatusVariant, type StatusVariant } from '@/utils/format';
import styles from './Badge.module.css';

interface BadgeProps {
  label: string;
  variant?: StatusVariant;
}

export function Badge({ label, variant }: BadgeProps) {
  const resolved = variant ?? getStatusVariant(label);
  return <span className={`${styles.badge} ${styles[resolved]}`}>{label}</span>;
}
