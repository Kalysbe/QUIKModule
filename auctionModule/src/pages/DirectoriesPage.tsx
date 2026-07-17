import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  createFirmStatusDict,
  deleteFirmStatusDict,
  getFirmStatusDict,
  getFirmsDirectory,
  updateFirmDirectory,
  updateFirmStatusDict,
  type FirmDirectoryItem,
  type FirmStatusDictItem,
} from '@/api/directories';
import { useAuth } from '@/auth/AuthContext';
import { ErrorState } from '@/components/common/ErrorState';
import { PageLoader } from '@/components/common/PageLoader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { canAccessDirectories } from '@/types/auth';
import styles from './DirectoriesPage.module.css';

type TabId = 'firms' | 'statuses';

function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  if (err instanceof Error) return err.message;
  return 'Не удалось загрузить справочники';
}

export default function DirectoriesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>('firms');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firms, setFirms] = useState<FirmDirectoryItem[]>([]);
  const [statuses, setStatuses] = useState<FirmStatusDictItem[]>([]);
  const [search, setSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [savingFirmId, setSavingFirmId] = useState<string | null>(null);
  const [newStatusName, setNewStatusName] = useState('');
  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);
  const [editingStatusName, setEditingStatusName] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAll = useCallback(async (searchValue = search) => {
    setLoading(true);
    setError(null);
    try {
      const [firmsData, statusData] = await Promise.all([
        getFirmsDirectory(searchValue),
        getFirmStatusDict(),
      ]);
      setFirms(firmsData);
      setStatuses(statusData);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void loadAll('');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draftSearch !== search) {
        setSearch(draftSearch);
        void loadAll(draftSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [draftSearch, search, loadAll]);

  const statusOptions = useMemo(
    () => [
      { value: '', label: '— не задан —' },
      ...statuses.map((s) => ({ value: String(s.id), label: s.name_ru })),
    ],
    [statuses],
  );

  const handleFirmChange = async (
    firm: FirmDirectoryItem,
    patch: { status?: number | null; resident?: boolean },
  ) => {
    const nextStatus = patch.status !== undefined ? patch.status : firm.status;
    const nextResident =
      patch.resident !== undefined ? patch.resident : Boolean(firm.resident);

    setSavingFirmId(firm.firm_id);
    setNotice(null);
    try {
      const updated = await updateFirmDirectory(firm.firm_id, {
        status: nextStatus,
        resident: nextResident,
      });
      setFirms((prev) =>
        prev.map((row) =>
          row.firm_id === firm.firm_id
            ? {
                ...row,
                status: updated.status,
                status_name: updated.status_name ?? null,
                resident: updated.resident,
                updated_at: updated.updated_at ?? null,
              }
            : row,
        ),
      );
      setNotice(`Сохранено: ${firm.firm_id}`);
    } catch (err) {
      setNotice(getErrorMessage(err));
    } finally {
      setSavingFirmId(null);
    }
  };

  const handleCreateStatus = async () => {
    const name = newStatusName.trim();
    if (!name) return;
    setStatusBusy(true);
    setNotice(null);
    try {
      const created = await createFirmStatusDict(name);
      setStatuses((prev) => [...prev, created].sort((a, b) => a.id - b.id));
      setNewStatusName('');
      setNotice('Статус добавлен');
    } catch (err) {
      setNotice(getErrorMessage(err));
    } finally {
      setStatusBusy(false);
    }
  };

  const handleSaveStatusEdit = async () => {
    if (editingStatusId == null) return;
    const name = editingStatusName.trim();
    if (!name) return;
    setStatusBusy(true);
    setNotice(null);
    try {
      const updated = await updateFirmStatusDict(editingStatusId, name);
      setStatuses((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setFirms((prev) =>
        prev.map((f) =>
          f.status === updated.id ? { ...f, status_name: updated.name_ru } : f,
        ),
      );
      setEditingStatusId(null);
      setEditingStatusName('');
      setNotice('Статус обновлён');
    } catch (err) {
      setNotice(getErrorMessage(err));
    } finally {
      setStatusBusy(false);
    }
  };

  const handleDeleteStatus = async (id: number) => {
    if (!window.confirm('Удалить статус из справочника?')) return;
    setStatusBusy(true);
    setNotice(null);
    try {
      await deleteFirmStatusDict(id);
      setStatuses((prev) => prev.filter((s) => s.id !== id));
      setFirms((prev) =>
        prev.map((f) =>
          f.status === id ? { ...f, status: null, status_name: null } : f,
        ),
      );
      setNotice('Статус удалён');
    } catch (err) {
      setNotice(getErrorMessage(err));
    } finally {
      setStatusBusy(false);
    }
  };

  if (!canAccessDirectories(user?.role)) {
    return <Navigate to="/" replace />;
  }

  if (loading && firms.length === 0 && statuses.length === 0) {
    return <PageLoader label="Загрузка справочников…" />;
  }

  if (error && firms.length === 0) {
    return <ErrorState message={error} onRetry={() => void loadAll(search)} />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Справочники</h1>
        <p className={styles.subtitle}>
          Статусы и резидентство фирм. Список фирм загружается из QUIK (таблица Firms).
        </p>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'firms' ? styles.tabActive : ''}`}
          onClick={() => setTab('firms')}
        >
          Фирмы
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'statuses' ? styles.tabActive : ''}`}
          onClick={() => setTab('statuses')}
        >
          Статусы
        </button>
      </div>

      {notice && <div className={styles.notice}>{notice}</div>}

      {tab === 'firms' && (
        <section className={styles.section}>
          <div className={styles.toolbar}>
            <Input
              label="Поиск"
              placeholder="FirmId или название…"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
            />
            <Button variant="secondary" size="sm" onClick={() => void loadAll(search)}>
              Обновить
            </Button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>FirmId</th>
                  <th>Название</th>
                  <th>Статус QUIK</th>
                  <th>Статус</th>
                  <th>Резидент</th>
                </tr>
              </thead>
              <tbody>
                {firms.map((firm) => (
                  <tr key={firm.firm_id}>
                    <td className={styles.mono}>{firm.firm_id}</td>
                    <td>{firm.firm_name ?? '—'}</td>
                    <td>{firm.quik_status ?? '—'}</td>
                    <td>
                      <Select
                        aria-label={`Статус ${firm.firm_id}`}
                        options={statusOptions}
                        value={firm.status != null ? String(firm.status) : ''}
                        disabled={savingFirmId === firm.firm_id}
                        onChange={(e) => {
                          const raw = e.target.value;
                          void handleFirmChange(firm, {
                            status: raw === '' ? null : Number(raw),
                          });
                        }}
                      />
                    </td>
                    <td>
                      <Select
                        aria-label={`Резидент ${firm.firm_id}`}
                        options={[
                          { value: 'false', label: 'false' },
                          { value: 'true', label: 'true' },
                        ]}
                        value={firm.resident ? 'true' : 'false'}
                        disabled={savingFirmId === firm.firm_id}
                        onChange={(e) => {
                          void handleFirmChange(firm, {
                            resident: e.target.value === 'true',
                          });
                        }}
                      />
                    </td>
                  </tr>
                ))}
                {firms.length === 0 && (
                  <tr>
                    <td colSpan={5} className={styles.empty}>
                      Фирмы не найдены
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'statuses' && (
        <section className={styles.section}>
          <div className={styles.addRow}>
            <Input
              label="Новый статус"
              placeholder="Название статуса"
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateStatus();
              }}
            />
            <Button
              size="sm"
              loading={statusBusy}
              disabled={!newStatusName.trim()}
              onClick={() => void handleCreateStatus()}
            >
              Добавить
            </Button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Название</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {statuses.map((status) => (
                  <tr key={status.id}>
                    <td className={styles.mono}>{status.id}</td>
                    <td>
                      {editingStatusId === status.id ? (
                        <Input
                          value={editingStatusName}
                          onChange={(e) => setEditingStatusName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleSaveStatusEdit();
                          }}
                        />
                      ) : (
                        status.name_ru
                      )}
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {editingStatusId === status.id ? (
                          <>
                            <Button
                              size="sm"
                              loading={statusBusy}
                              onClick={() => void handleSaveStatusEdit()}
                            >
                              Сохранить
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditingStatusId(null);
                                setEditingStatusName('');
                              }}
                            >
                              Отмена
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditingStatusId(status.id);
                                setEditingStatusName(status.name_ru);
                              }}
                            >
                              Изменить
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={statusBusy}
                              onClick={() => void handleDeleteStatus(status.id)}
                            >
                              Удалить
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {statuses.length === 0 && (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      Справочник пуст
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
