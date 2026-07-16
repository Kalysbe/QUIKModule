import jwt from "jsonwebtoken";
import { updateLastActivity } from "../repositories/kseUsersRepository.js";
import logger from "../utils/logger.js";

/**
 * ВРЕМЕННО: true = JWT KSE не проверяется, admin не режется.
 * Вернуть защиту: false + перезапуск сервера.
 */
export const KSE_JWT_AUTH_DISABLED = true;

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";

const JWT_VERIFY_OPTS = { algorithms: ["HS256"], clockTolerance: 60 };

/**
 * Bearer из Authorization или дубликата X-KSE-Authorization (если прокси режет Authorization на POST).
 */
function extractBearerToken(req) {
  const raw =
    req.headers?.authorization ||
    req.headers?.["x-kse-authorization"] ||
    req.headers?.["x-access-token"];
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (s.startsWith("Bearer ")) return s.slice(7).trim();
  return s || null;
}

/**
 * Middleware: проверяет JWT в заголовке Authorization: Bearer <token>.
 * При успехе заполняет req.user (id, login, role) и опционально обновляет last_activity_at в БД.
 * При отсутствии или невалидном токене — next(err) с 401 UnauthorizedError.
 */
export function kseRequireAuth(req, res, next) {
  if (KSE_JWT_AUTH_DISABLED) {
    req.user = {
      id: 1,
      userId: 1,
      login: "auth-disabled",
      role: "admin",
    };
    return next();
  }

  const token = extractBearerToken(req);

  if (!token) {
    const err = new Error("Требуется авторизация");
    err.statusCode = 401;
    err.name = "UnauthorizedError";
    err.code = "KSE_TOKEN_MISSING";
    return next(err);
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTS);
  } catch (e) {
    if (process.env.DEBUG_KSE_JWT === "true") {
      logger.warn("JWT verify failed", { name: e?.name, message: e?.message });
    }
    const err = new Error("Недействительный или истёкший токен");
    err.statusCode = 401;
    err.name = "UnauthorizedError";
    err.code =
      e?.name === "TokenExpiredError" ? "KSE_TOKEN_EXPIRED" : "KSE_TOKEN_INVALID";
    return next(err);
  }

  req.user = {
    id: payload.userId,
    userId: payload.userId,
    login: payload.login,
    role: payload.role
  };

  // Обновляем last_activity_at асинхронно, не блокируя ответ
  updateLastActivity(payload.userId).catch(() => {});

  next();
}

/**
 * Middleware: допускает только пользователей с ролью admin.
 * Должен использоваться после kseRequireAuth.
 */
export function kseRequireAdmin(req, res, next) {
  if (KSE_JWT_AUTH_DISABLED) {
    return next();
  }
  if (!req.user || req.user.role !== "admin") {
    const err = new Error("Доступ запрещён: требуется роль admin");
    err.statusCode = 403;
    err.name = "ForbiddenError";
    return next(err);
  }
  next();
}
