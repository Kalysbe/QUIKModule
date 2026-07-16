export function isActiveOrderState(state?: string): boolean {
  const normalized = (state ?? '').toLowerCase();
  return normalized.includes('актив') || normalized === '' || normalized === '—';
}

/** Снятые / отменённые заявки — не показываем в аукционе и ведомостях. */
export function isCancelledOrderState(state?: string): boolean {
  const normalized = (state ?? '').toLowerCase();
  return (
    normalized.includes('снят') ||
    normalized.includes('отмен') ||
    normalized.includes('cancel') ||
    normalized.includes('reject')
  );
}

export function isExecutedOrderState(state?: string): boolean {
  const normalized = (state ?? '').toLowerCase();
  return normalized.includes('исполн');
}

/** Заявки для ведомости: активные и исполненные, без снятых/отменённых. */
export function isReportableOrderState(state?: string): boolean {
  if (isCancelledOrderState(state)) return false;
  if (isActiveOrderState(state)) return true;
  return isExecutedOrderState(state);
}
