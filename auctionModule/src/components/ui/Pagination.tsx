import styles from './Pagination.module.css';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [1];

  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) pages.push('...');
  if (total > 1) pages.push(total);

  return pages;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = getPageNumbers(page, totalPages);

  return (
    <div className={styles.pagination}>
      <span className={styles.info}>
        Показано {from}–{to} из {total}
      </span>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.pageBtn}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Предыдущая страница"
        >
          ‹
        </button>
        {pages.map((p, idx) =>
          p === '...' ? (
            <span key={`ellipsis-${idx}`} className={styles.ellipsis}>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ''}`}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className={styles.pageBtn}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Следующая страница"
        >
          ›
        </button>
      </div>
    </div>
  );
}
