import { Suspense, type ReactNode } from 'react';
import { PageLoader } from '@/components/common/PageLoader';

export function PageSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader skeleton />}>{children}</Suspense>;
}
