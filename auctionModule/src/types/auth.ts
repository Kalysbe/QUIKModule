export type UserRole = 'admin' | 'operator' | 'minfin';

export interface AuthUser {
  id: number;
  login: string;
  first_name: string;
  last_name: string;
  firm_code: string;
  role: UserRole;
  last_activity_at?: string | null;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
}

export function isMinfinRole(role: UserRole | undefined): boolean {
  return role === 'minfin';
}

export function canAccessFullAuction(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'operator';
}

export function getUserDisplayName(user: AuthUser | null): string {
  if (!user) return '';
  const name = `${user.first_name} ${user.last_name}`.trim();
  return name || user.login;
}
