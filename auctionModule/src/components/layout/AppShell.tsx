import { AnimatePresence } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { PageTransition } from '@/components/common/PageTransition';
import { Header } from './Header';
import styles from './AppShell.module.css';

export function AppShell() {
  const location = useLocation();

  return (
    <div className={styles.shell}>
      <Header />
      <main className={styles.main}>
        <AnimatePresence mode="wait">
          <PageTransition keyId={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
    </div>
  );
}
