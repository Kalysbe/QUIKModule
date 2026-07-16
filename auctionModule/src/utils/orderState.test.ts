import { describe, expect, it } from 'vitest';
import {
  isActiveOrderState,
  isCancelledOrderState,
  isReportableOrderState,
} from '@/utils/orderState';

describe('orderState', () => {
  it('treats active states as active and reportable', () => {
    expect(isActiveOrderState('Активна')).toBe(true);
    expect(isReportableOrderState('Активна')).toBe(true);
  });

  it('treats executed orders as reportable but not active', () => {
    expect(isActiveOrderState('Исполнена')).toBe(false);
    expect(isReportableOrderState('Исполнена')).toBe(true);
  });

  it('excludes cancelled orders from auction and reports', () => {
    expect(isCancelledOrderState('Снята')).toBe(true);
    expect(isCancelledOrderState('Отменена')).toBe(true);
    expect(isReportableOrderState('Снята')).toBe(false);
    expect(isReportableOrderState('Отменена')).toBe(false);
  });
});
