-- Роль minfin для пользователей KSE (доступ к ведомостям аукционов)
ALTER TABLE public.kse_users
  DROP CONSTRAINT IF EXISTS kse_users_role_check;

ALTER TABLE public.kse_users
  ADD CONSTRAINT kse_users_role_check
  CHECK (role IN ('admin', 'operator', 'minfin'));

COMMENT ON COLUMN public.kse_users.role IS 'admin | operator | minfin';
