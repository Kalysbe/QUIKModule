import { kseRequireAuth } from "./kseAuth.js";

/** true — JWT обязателен для API аукционного модуля (params/auction, orders, preliminary-calculations) */
export const AUCTION_AUTH_ENABLED = process.env.AUCTION_AUTH_ENABLED === "true";

const AUCTION_READ_ROLES = new Set(["admin", "operator", "minfin"]);

/**
 * JWT для маршрутов AuctionModule. При AUCTION_AUTH_ENABLED=false пропускает без проверки.
 */
export function auctionRequireAuth(req, res, next) {
  if (!AUCTION_AUTH_ENABLED) return next();
  return kseRequireAuth(req, res, next);
}

/**
 * GET: admin, operator, minfin. POST/PUT/DELETE — только admin и operator.
 */
export function auctionRequireReadRole(req, res, next) {
  if (!AUCTION_AUTH_ENABLED) return next();
  if (!req.user || !AUCTION_READ_ROLES.has(req.user.role)) {
    const err = new Error("Доступ запрещён");
    err.statusCode = 403;
    err.name = "ForbiddenError";
    return next(err);
  }
  next();
}

export function auctionDenyMinfinWrite(req, res, next) {
  if (!AUCTION_AUTH_ENABLED) return next();
  if (req.user?.role === "minfin") {
    const err = new Error("Доступ запрещён: роль minfin может только просматривать данные");
    err.statusCode = 403;
    err.name = "ForbiddenError";
    return next(err);
  }
  next();
}
