import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger.js";
import { insertApiLog } from "../repositories/apiLogsRepository.js";

const MAX_BODY_BYTES = 1024 * 1024; // 1MB - предел принимаемого тела для логирования
const MAX_SAVED_BYTES = 64 * 1024; // 64KB - фактически сохраняем в БД

const SENSITIVE_KEYS = [
  "password",
  "pass",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "cookie",
  "secret",
  "api_key"
];

function isObject(value) {
  return value !== null && typeof value === "object";
}

function maskSensitiveValue(key, value) {
  if (!key) return value;

  const lower = String(key).toLowerCase();
  if (SENSITIVE_KEYS.includes(lower)) {
    return "***";
  }

  return value;
}

/**
 * Рекурсивно маскирует чувствительные поля в объекте.
 * Глубина ограничена, чтобы избежать проблем с очень глубокими структурами.
 */
function maskSensitiveData(data, depth = 0, maxDepth = 5) {
  if (!isObject(data) || depth > maxDepth) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, depth + 1, maxDepth));
  }

  const result = {};
  for (const [key, value] of Object.entries(data)) {
    const maskedValue = maskSensitiveValue(key, value);
    result[key] = isObject(maskedValue)
      ? maskSensitiveData(maskedValue, depth + 1, maxDepth)
      : maskedValue;
  }

  return result;
}

/**
 * Обрезает строковое представление данных до указанного лимита
 * и возвращает флаг truncated.
 */
function truncateString(str, maxBytes) {
  if (typeof str !== "string") {
    str = String(str);
  }

  if (Buffer.byteLength(str, "utf8") <= maxBytes) {
    return { data: str, truncated: false };
  }

  // Обрезаем по байтам, чтобы не разорвать многобайтные символы
  const buffer = Buffer.from(str, "utf8");
  const sliced = buffer.subarray(0, maxBytes);
  return { data: sliced.toString("utf8"), truncated: true };
}

/**
 * Маскирование и обрезка тела запроса/ответа.
 * Возвращаемое значение всегда должно быть корректным JSON для jsonb-колонок.
 */
function sanitizeAndTruncateBody(body) {
  if (body === undefined) {
    return { data: null, truncated: false };
  }

  let raw = body;
  let wasString = typeof raw === "string";

  if (!wasString && !isObject(raw)) {
    raw = String(raw);
    wasString = true;
  }

  if (isObject(raw)) {
    const jsonStr = JSON.stringify(raw);
    if (Buffer.byteLength(jsonStr, "utf8") > MAX_BODY_BYTES) {
      const { data, truncated } = truncateString(jsonStr, MAX_SAVED_BYTES);
      // Заворачиваем превью в объект, чтобы сохранить валидный JSON
      return {
        data: {
          truncated: true,
          preview: data
        },
        truncated: true
      };
    }
    const masked = maskSensitiveData(raw);
    return { data: masked, truncated: false };
  }

  if (wasString) {
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      const { data, truncated } = truncateString(raw, MAX_SAVED_BYTES);
      return {
        data: {
          truncated: true,
          preview: data
        },
        truncated: true
      };
    }
    // Оборачиваем строку в объект, чтобы она была валидным JSON
    return {
      data: {
        value: raw
      },
      truncated: false
    };
  }

  return { data: null, truncated: false };
}

/**
 * Маскирование чувствительных заголовков.
 */
function sanitizeHeaders(headers) {
  if (!headers || !isObject(headers)) {
    return null;
  }

  const result = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = maskSensitiveValue(key, value);
  }
  return result;
}

/**
 * Определяет уровень логирования по статус-коду.
 */
function getLevelByStatus(statusCode) {
  if (statusCode >= 500) return "ERROR";
  if (statusCode >= 400) return "WARN";
  return "INFO";
}

/**
 * Нормализованный маршрут: baseUrl + route.path
 */
function getNormalizedRoute(req) {
  if (req.baseUrl || (req.route && req.route.path)) {
    const base = req.baseUrl || "";
    const path = (req.route && req.route.path) || "";
    return `${base}${path}` || null;
  }
  return null;
}

/**
 * Middleware для логирования всех HTTP-запросов в PostgreSQL (таблица api_logs).
 * Логирование выполняется асинхронно и не влияет на ответ клиенту.
 */
export function apiLoggerMiddleware(req, res, next) {
  const requestId = uuidv4();
  const start = process.hrtime.bigint();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const { data: sanitizedRequestBody, truncated: requestTruncated } =
    sanitizeAndTruncateBody(req.body);
  const sanitizedHeaders = sanitizeHeaders(req.headers);

  let responseBodyRaw;
  let responseMessage;

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = (body) => {
    responseBodyRaw = body;
    if (body && typeof body === "object" && "message" in body) {
      responseMessage = body.message;
    } else if (typeof body === "string") {
      responseMessage = body;
    }
    return originalJson(body);
  };

  res.send = (body) => {
    responseBodyRaw = body;
    if (body && typeof body === "object" && "message" in body) {
      responseMessage = body.message;
    } else if (typeof body === "string") {
      responseMessage = body;
    }
    return originalSend(body);
  };

  res.on("finish", () => {
    try {
      const end = process.hrtime.bigint();
      const durationNs = end - start;
      const responseTimeMs = Number(durationNs / 1_000_000n);

      const isPost = req.method === "POST";
      const { data: sanitizedResponseBody, truncated: responseTruncated } = isPost
        ? sanitizeAndTruncateBody(responseBodyRaw)
        : { data: null, truncated: false };

      const ipAddress = req.clientIP || req.ip || null;

      const user = req.user || {};
      const userId = user.id || user.userId || null;
      const role = user.role || user.roles || null;

      const errorInfo = req._errorForLogging || {};

      const statusCode = res.statusCode || 0;
      const level = getLevelByStatus(statusCode);

      const logEntry = {
        requestId,
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl || req.url,
        route: getNormalizedRoute(req),
        queryParams: req.query || null,
        requestBody: sanitizedRequestBody,
        headers: sanitizedHeaders,
        ipAddress,
        userAgent: req.headers["user-agent"] || null,
        userId,
        role,
        statusCode,
        responseBody: isPost ? sanitizedResponseBody : null,
        responseMessage: responseMessage || null,
        responseTimeMs,
        errorMessage: errorInfo.errorMessage || null,
        errorStack: errorInfo.errorStack || null,
        errorType: errorInfo.errorType || null,
        truncated: Boolean(requestTruncated || responseTruncated),
        level
      };

      // Асинхронная запись лога, не блокируем ответ
      insertApiLog(logEntry).catch((error) => {
        logger.error("Failed to write API log", {
          error: error.message,
          stack: error.stack
        });
      });
    } catch (error) {
      logger.error("Unexpected error in apiLoggerMiddleware", {
        error: error.message,
        stack: error.stack
      });
    }
  });

  next();
}

export default apiLoggerMiddleware;

