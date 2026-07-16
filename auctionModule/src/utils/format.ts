export function formatPrice(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const num = parseFloat(value);
  if (Number.isNaN(num)) return value;
  if (num === 0) return '0.00';
  return num.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  return value.slice(0, 8);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    const date = new Date(value);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return value;
  }
}

export function formatReportMoney(value: number): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatReportPercent(value: number): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export type StatusVariant = 'frozen' | 'closed' | 'active' | 'default';

export function getStatusVariant(status: string | null | undefined): StatusVariant {
  if (!status) return 'default';
  const lower = status.toLowerCase();
  if (lower.includes('заморож') || lower.includes('frozen')) return 'frozen';
  if (lower.includes('закрыт') || lower.includes('closed')) return 'closed';
  if (lower.includes('торг') || lower.includes('open') || lower.includes('active'))
    return 'active';
  return 'default';
}
