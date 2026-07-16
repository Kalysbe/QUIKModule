import pgKsePool from "../config/dbKse.js";

const TABLE = "public.kse_users";

const USER_COLS_PUBLIC = "id, login, first_name, last_name, firm_code, role, last_activity_at, created_at, updated_at";

/**
 * Список пользователей с пагинацией (без password_hash).
 * @param {{ limit?: number, offset?: number }}
 */
export async function findAll({ limit = 100, offset = 0 } = {}) {
  const countResult = await pgKsePool.query(`SELECT COUNT(*)::int AS total FROM ${TABLE}`);
  const total = countResult.rows[0]?.total ?? 0;
  const result = await pgKsePool.query(
    `SELECT ${USER_COLS_PUBLIC} FROM ${TABLE} ORDER BY id LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return { rows: result.rows, total };
}

/**
 * Найти пользователя по id (без password_hash).
 */
export async function findById(id) {
  const result = await pgKsePool.query(
    `SELECT ${USER_COLS_PUBLIC} FROM ${TABLE} WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Найти пользователя по логину (для входа).
 * @param {string} login
 * @returns {Promise<{ id, login, first_name, last_name, firm_code, role, password_hash, last_activity_at, created_at, updated_at } | null>}
 */
export async function findByLogin(login) {
  const result = await pgKsePool.query(
    `SELECT id, login, first_name, last_name, firm_code, role, password_hash, last_activity_at, created_at, updated_at
     FROM ${TABLE}
     WHERE login = $1`,
    [login]
  );
  return result.rows[0] || null;
}

/**
 * Обновить время последней активности пользователя.
 * @param {number} userId
 */
export async function updateLastActivity(userId) {
  await pgKsePool.query(
    `UPDATE ${TABLE}
     SET last_activity_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
}

/**
 * Создать пользователя (для скрипта создания admin).
 * @param {{ login: string, first_name: string, last_name: string, firm_code: string, role: string, password_hash: string }}
 */
export async function createUser({ login, first_name, last_name, firm_code, role, password_hash }) {
  const result = await pgKsePool.query(
    `INSERT INTO ${TABLE} (login, first_name, last_name, firm_code, role, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, login, first_name, last_name, firm_code, role, last_activity_at, created_at, updated_at`,
    [login, first_name, last_name, firm_code, role, password_hash]
  );
  return result.rows[0];
}

/**
 * Обновить пользователя (частичное обновление: имя, фамилия, firm_code, role; опционально пароль).
 * @param {number} id
 * @param {{ first_name?: string, last_name?: string, firm_code?: string, role?: string, password_hash?: string }}
 */
export async function updateUser(id, { first_name, last_name, firm_code, role, password_hash }) {
  const updates = [];
  const values = [];
  let pos = 1;
  if (first_name !== undefined) { updates.push(`first_name = $${pos++}`); values.push(first_name); }
  if (last_name !== undefined) { updates.push(`last_name = $${pos++}`); values.push(last_name); }
  if (firm_code !== undefined) { updates.push(`firm_code = $${pos++}`); values.push(firm_code); }
  if (role !== undefined) { updates.push(`role = $${pos++}`); values.push(role); }
  if (password_hash !== undefined) { updates.push(`password_hash = $${pos++}`); values.push(password_hash); }
  if (updates.length === 0) return await findById(id);
  updates.push(`updated_at = NOW()`);
  values.push(id);
  const result = await pgKsePool.query(
    `UPDATE ${TABLE} SET ${updates.join(", ")} WHERE id = $${pos} RETURNING ${USER_COLS_PUBLIC}`,
    values
  );
  return result.rows[0] || null;
}
