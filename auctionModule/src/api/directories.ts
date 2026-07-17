import apiClient from '@/lib/axios';

export interface FirmStatusDictItem {
  id: number;
  name_ru: string;
  created_at?: string;
  updated_at?: string;
}

export interface FirmDirectoryItem {
  firm_id: string;
  firm_name: string | null;
  exchange: string | null;
  quik_status: string | null;
  quik_status_flag: number | null;
  status: number | null;
  status_name: string | null;
  resident: boolean | null;
  updated_at: string | null;
}

export async function getFirmStatusDict(): Promise<FirmStatusDictItem[]> {
  const { data } = await apiClient.get<{ success: boolean; data: FirmStatusDictItem[] }>(
    '/kse/directories/firm-status-dict',
  );
  return data.data ?? [];
}

export async function createFirmStatusDict(nameRu: string): Promise<FirmStatusDictItem> {
  const { data } = await apiClient.post<{ success: boolean; data: FirmStatusDictItem }>(
    '/kse/directories/firm-status-dict',
    { name_ru: nameRu },
  );
  return data.data;
}

export async function updateFirmStatusDict(
  id: number,
  nameRu: string,
): Promise<FirmStatusDictItem> {
  const { data } = await apiClient.put<{ success: boolean; data: FirmStatusDictItem }>(
    `/kse/directories/firm-status-dict/${id}`,
    { name_ru: nameRu },
  );
  return data.data;
}

export async function deleteFirmStatusDict(id: number): Promise<void> {
  await apiClient.delete(`/kse/directories/firm-status-dict/${id}`);
}

export async function getFirmsDirectory(search = ''): Promise<FirmDirectoryItem[]> {
  const { data } = await apiClient.get<{
    success: boolean;
    data: FirmDirectoryItem[];
    total: number;
  }>('/kse/directories/firms', {
    params: search ? { search } : undefined,
  });
  return data.data ?? [];
}

export async function updateFirmDirectory(
  firmId: string,
  payload: { status: number | null; resident: boolean },
): Promise<FirmDirectoryItem> {
  const { data } = await apiClient.put<{ success: boolean; data: FirmDirectoryItem }>(
    `/kse/directories/firms/${encodeURIComponent(firmId)}`,
    payload,
  );
  return data.data;
}
