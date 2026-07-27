import { z } from "zod";
import {
  listClassRegistry,
  upsertClassMarketType,
} from "../repositories/classRegistryRepository.js";

const MarketTypeSchema = z.enum(["primary", "secondary"]).nullable();

/**
 * GET /api/kse/directories/class-registry
 */
export async function getClassRegistry(req, res, next) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : "";
    let marketType = null;
    if (typeof req.query.market_type === "string" && req.query.market_type.trim()) {
      const raw = req.query.market_type.trim();
      if (raw === "unset" || raw === "primary" || raw === "secondary") {
        marketType = raw;
      } else {
        return res.status(400).json({
          success: false,
          message: "Некорректный market_type (primary | secondary | unset)",
          error: "VALIDATION_ERROR",
        });
      }
    }

    const rows = await listClassRegistry({
      search,
      market_type: marketType,
    });
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/kse/directories/class-registry/:classCode
 * Body: { market_type: 'primary' | 'secondary' | null }
 */
export async function putClassRegistry(req, res, next) {
  try {
    const classCode = decodeURIComponent(String(req.params.classCode || "")).trim();
    if (!classCode) {
      return res.status(400).json({
        success: false,
        message: "Не указан class_code",
        error: "VALIDATION_ERROR",
      });
    }

    const parsed = MarketTypeSchema.safeParse(
      req.body?.market_type === undefined ? null : req.body.market_type
    );
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Укажите market_type: primary, secondary или null",
        error: "VALIDATION_ERROR",
      });
    }

    const result = await upsertClassMarketType(classCode, parsed.data);
    if (!result.ok) {
      return res.status(404).json({
        success: false,
        message: "Класс не найден в таблице Classes",
        error: "NOT_FOUND",
      });
    }

    res.json({ success: true, data: result.row });
  } catch (err) {
    next(err);
  }
}
