import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getMeRequest, loginRequest } from '@/api/auth';
import { AuthContext } from '@/auth/AuthContext';
import { clearStoredSession, getStoredToken, getStoredUser, setStoredSession } from '@/auth/storage';
import type { AuthUser } from '@/types/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = getStoredToken();
    return token ? getStoredUser() : null;
  });
  const [loading, setLoading] = useState(() => Boolean(getStoredToken()));

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const token = getStoredToken();
      const cachedUser = getStoredUser();

      if (!token) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const me = await getMeRequest();
        if (!cancelled && (!cachedUser || me.login === cachedUser.login)) {
          setUser(me);
          setStoredSession(token, me);
        }
      } catch {
        if (!cancelled && !cachedUser) {
          clearStoredSession();
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (loginValue: string, password: string) => {
    const response = await loginRequest(loginValue, password);
    setStoredSession(response.token, response.user);
    setUser(response.user);
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
