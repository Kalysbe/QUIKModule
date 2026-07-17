import type { RouteObject } from 'react-router-dom';
import { AuthGuard, GuestGuard } from '@/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { AuctionDetailPage, DirectoriesPage, HomePage, LoginPage } from './lazyPages';
import { PageSuspense } from './PageSuspense';

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: <GuestGuard />,
    children: [
      {
        index: true,
        element: (
          <PageSuspense>
            <LoginPage />
          </PageSuspense>
        ),
      },
    ],
  },
  {
    path: '/',
    element: <AuthGuard />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: (
              <PageSuspense>
                <HomePage />
              </PageSuspense>
            ),
          },
          {
            path: 'auction/:auctionId',
            element: (
              <PageSuspense>
                <AuctionDetailPage />
              </PageSuspense>
            ),
          },
          {
            path: 'directories',
            element: (
              <PageSuspense>
                <DirectoriesPage />
              </PageSuspense>
            ),
          },
        ],
      },
    ],
  },
];
