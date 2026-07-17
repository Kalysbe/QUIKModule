import pgKsePool from "../config/dbKse.js";
import pgQuikPool from "../config/dbPostgres.js";

const DICT_TABLE = "public.firm_status_dict";
const STATUS_TABLE = "public.firm_status";

/**
 * Список значений справочника статусов фирм.
 */
export async function listStatusDict() {
  const result = await pgKsePool.query(
    `SELECT id, name_ru, created_at, updated_at
     FROM ${DICT_TABLE}
     ORDER BY id`
  );
  return result.rows;
}

/**
 * Создать значение справочника.
 * @param {string} nameRu
 */
export async function createStatusDict(nameRu) {
  const result = await pgKsePool.query(
    `INSERT INTO ${DICT_TABLE} (name_ru)
     VALUES ($1)
     RETURNING id, name_ru, created_at, updated_at`,
    [nameRu]
  );
  return result.rows[0];
}

/**
 * Обновить значение справочника.
 * @param {number} id
 * @param {string} nameRu
 */
export async function updateStatusDict(id, nameRu) {
  const result = await pgKsePool.query(
    `UPDATE ${DICT_TABLE}
     SET name_ru = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, name_ru, created_at, updated_at`,
    [id, nameRu]
  );
  return result.rows[0] || null;
}

/**
 * Удалить значение справочника (status у связанных фирм станет NULL).
 * @param {number} id
 */
export async function deleteStatusDict(id) {
  const result = await pgKsePool.query(
    `DELETE FROM ${DICT_TABLE}
     WHERE id = $1
     RETURNING id, name_ru`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Проверить существование значения справочника.
 * @param {number} id
 */
export async function findStatusDictById(id) {
  const result = await pgKsePool.query(
    `SELECT id, name_ru FROM ${DICT_TABLE} WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Список фирм из QUIK.Firms с назначенным статусом/резидентством из quik_kse.firm_status.
 * @param {{ search?: string }} opts
 */
export async function listFirmsWithStatus({ search = "" } = {}) {
  const params = [];
  let where = "";
  if (search && String(search).trim()) {
    params.push(`%${String(search).trim()}%`);
    where = `WHERE f."FirmId" ILIKE $1 OR f."FirmName" ILIKE $1`;
  }

  const firmsResult = await pgQuikPool.query(
    `SELECT f."FirmId" AS firm_id,
            f."FirmName" AS firm_name,
            f."Status" AS quik_status,
            f."StatusFlag" AS quik_status_flag,
            f."Exchange" AS exchange
     FROM public."Firms" f
     ${where}
     ORDER BY f."FirmName" NULLS LAST, f."FirmId"`,
    params
  );

  const statusResult = await pgKsePool.query(
    `SELECT fs.firm_id,
            fs.status,
            fs.resident,
            fs.updated_at,
            d.name_ru AS status_name
     FROM ${STATUS_TABLE} fs
     LEFT JOIN ${DICT_TABLE} d ON d.id = fs.status`
  );

  const byFirmId = new Map(
    statusResult.rows.map((row) => [String(row.firm_id), row])
  );

  return firmsResult.rows.map((firm) => {
    const assigned = byFirmId.get(String(firm.firm_id));
    return {
      firm_id: firm.firm_id,
      firm_name: firm.firm_name,
      exchange: firm.exchange,
      quik_status: firm.quik_status,
      quik_status_flag: firm.quik_status_flag,
      status: assigned?.status ?? null,
      status_name: assigned?.status_name ?? null,
      resident: assigned?.resident ?? null,
      updated_at: assigned?.updated_at ?? null,
    };
  });
}

/**
 * Upsert статуса/резидентства фирмы.
 * @param {string} firmId
 * @param {{ status: number|null, resident: boolean }} data
 */
export async function upsertFirmStatus(firmId, { status, resident }) {
  const result = await pgKsePool.query(
    `INSERT INTO ${STATUS_TABLE} (firm_id, status, resident, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (firm_id) DO UPDATE
       SET status = EXCLUDED.status,
           resident = EXCLUDED.resident,
           updated_at = NOW()
     RETURNING firm_id, status, resident, created_at, updated_at`,
    [firmId, status, resident]
  );

  const row = result.rows[0];
  let statusName = null;
  if (row.status != null) {
    const dict = await findStatusDictById(row.status);
    statusName = dict?.name_ru ?? null;
  }

  return {
    ...row,
    status_name: statusName,
  };
}

/**
 * Проверить, что firm_id есть в QUIK.Firms.
 * @param {string} firmId
 */
export async function firmExistsInQuik(firmId) {
  const result = await pgQuikPool.query(
    `SELECT "FirmId" AS firm_id
     FROM public."Firms"
     WHERE "FirmId" = $1
     LIMIT 1`,
    [firmId]
  );
  return Boolean(result.rows[0]);
}
