import pgKsePool from "../config/dbKse.js";
import logger from "../utils/logger.js";

/**
 * Вставка записи лога API-запроса в таблицу api_logs.
 * Ошибки записи не пробрасываются наружу, чтобы не влиять на работу API.
 *
 * @param {Object} log
 */
export async function insertApiLog(log) {
  const query = `
    INSERT INTO api_logs (
      request_id,
      "timestamp",
      method,
      url,
      route,
      query_params,
      request_body,
      headers,
      ip_address,
      user_agent,
      user_id,
      role,
      status_code,
      response_body,
      response_message,
      response_time_ms,
      error_message,
      error_stack,
      error_type,
      truncated,
      level
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6::jsonb, $7::jsonb, $8::jsonb, $9, $10,
      $11, $12, $13, $14::jsonb, $15,
      $16, $17, $18, $19, $20,
      $21
    )
  `;

  // Для jsonb-полей всегда передаём валидные JSON-строки или null
  const queryParamsJson =
    log.queryParams != null ? JSON.stringify(log.queryParams) : null;
  const requestBodyJson =
    log.requestBody != null ? JSON.stringify(log.requestBody) : null;
  const headersJson =
    log.headers != null ? JSON.stringify(log.headers) : null;
  const responseBodyJson =
    log.responseBody != null ? JSON.stringify(log.responseBody) : null;

  const values = [
    log.requestId,
    log.timestamp,
    log.method,
    log.url,
    log.route,
    queryParamsJson,
    requestBodyJson,
    headersJson,
    log.ipAddress ?? null,
    log.userAgent ?? null,
    log.userId ?? null,
    log.role ?? null,
    log.statusCode ?? null,
    log.responseBody ?? null,
    log.responseMessage ?? null,
    log.responseTimeMs ?? null,
    log.errorMessage ?? null,
    log.errorStack ?? null,
    log.errorType ?? null,
    Boolean(log.truncated),
    log.level ?? null
  ];

  try {
    await pgKsePool.query(query, values);
  } catch (error) {
    logger.error("Failed to insert API log", {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Удаляет логи старше указанного количества месяцев.
 * Используется для регулярной очистки (cron-задача).
 *
 * @param {number} months
 * @returns {Promise<number>} количество удалённых строк
 */
export async function cleanupOldLogs(months = 12) {
  const query = `
    DELETE FROM api_logs
    WHERE "timestamp" < NOW() - ($1::text || ' months')::interval
  `;

  try {
    const result = await pgKsePool.query(query, [String(months)]);
    const deleted = result.rowCount ?? 0;

    logger.info("API logs cleanup completed", {
      deleted,
      months
    });

    return deleted;
  } catch (error) {
    logger.error("Failed to cleanup old API logs", {
      error: error.message,
      stack: error.stack,
      months
    });
    return 0;
  }
}

export default {
  insertApiLog,
  cleanupOldLogs
};

