import { createContext, useContext } from 'react';
import type { AuthUser } from '@/types/auth';

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
