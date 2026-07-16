import type { AuthUser } from '@/types/auth';

export const JWT_STORAGE_KEY = 'jwt_access_token';
export const USER_STORAGE_KEY = 'jwt_user';

export function getStoredToken(): string | null {
  return sessionStorage.getItem(JWT_STORAGE_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = sessionStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredSession(token: string | null, user: AuthUser | null): void {
  if (token) {
    sessionStorage.setItem(JWT_STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(JWT_STORAGE_KEY);
  }

  if (user) {
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    sessionStorage.removeItem(USER_STORAGE_KEY);
  }
}

export function clearStoredSession(): void {
  sessionStorage.removeItem(JWT_STORAGE_KEY);
  sessionStorage.removeItem(USER_STORAGE_KEY);
}
