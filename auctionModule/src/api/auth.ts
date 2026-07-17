import apiClient from '@/lib/axios';
import type { AuthUser, ChangePasswordResponse, LoginResponse, MeResponse } from '@/types/auth';

export async function loginRequest(login: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/kse/auth/login', { login, password });
  if (!data.success || !data.token) {
    throw new Error('Не удалось выполнить вход');
  }
  return data;
}

export async function getMeRequest(): Promise<AuthUser> {
  const { data } = await apiClient.get<MeResponse>('/kse/auth/me');
  if (!data.user) {
    throw new Error('Пользователь не найден');
  }
  return data.user;
}

export async function changePasswordRequest(
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResponse> {
  const { data } = await apiClient.post<ChangePasswordResponse>('/kse/auth/change-password', {
    currentPassword,
    newPassword,
  });
  if (!data.success) {
    throw new Error('Не удалось сменить пароль');
  }
  return data;
}
