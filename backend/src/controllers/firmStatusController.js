import { z } from "zod";
import {
  listStatusDict,
  createStatusDict,
  updateStatusDict,
  deleteStatusDict,
  findStatusDictById,
  listFirmsWithStatus,
  upsertFirmStatus,
  firmExistsInQuik,
} from "../repositories/firmStatusRepository.js";

const StatusNameSchema = z
  .string()
  .trim()
  .min(1, "Укажите название статуса")
  .max(150, "Название слишком длинное");

const UpsertFirmStatusSchema = z.object({
  status: z.number().int().positive().nullable(),
  resident: z.boolean(),
});

/**
 * GET /api/kse/directories/firm-status-dict
 */
export async function getFirmStatusDict(req, res, next) {
  try {
    const rows = await listStatusDict();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/kse/directories/firm-status-dict
 */
export async function postFirmStatusDict(req, res, next) {
  try {
    const parsed = StatusNameSchema.safeParse(req.body?.name_ru);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Ошибка валидации",
        error: "VALIDATION_ERROR",
      });
    }

    const row = await createStatusDict(parsed.data);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Такой статус уже существует",
        error: "CONFLICT",
      });
    }
    next(err);
  }
}

/**
 * PUT /api/kse/directories/firm-status-dict/:id
 */
export async function putFirmStatusDict(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Некорректный id статуса",
        error: "VALIDATION_ERROR",
      });
    }

    const parsed = StatusNameSchema.safeParse(req.body?.name_ru);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Ошибка валидации",
        error: "VALIDATION_ERROR",
      });
    }

    const row = await updateStatusDict(id, parsed.data);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Статус не найден",
        error: "NOT_FOUND",
      });
    }

    res.json({ success: true, data: row });
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Такой статус уже существует",
        error: "CONFLICT",
      });
    }
    next(err);
  }
}

/**
 * DELETE /api/kse/directories/firm-status-dict/:id
 */
export async function deleteFirmStatusDict(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Некорректный id статуса",
        error: "VALIDATION_ERROR",
      });
    }

    const row = await deleteStatusDict(id);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Статус не найден",
        error: "NOT_FOUND",
      });
    }

    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/kse/directories/firms
 */
export async function getFirmsDirectory(req, res, next) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : "";
    const rows = await listFirmsWithStatus({ search });
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/kse/directories/firms/:firmId
 */
export async function putFirmDirectory(req, res, next) {
  try {
    const firmId = String(req.params.firmId || "").trim();
    if (!firmId) {
      return res.status(400).json({
        success: false,
        message: "Не указан firm_id",
        error: "VALIDATION_ERROR",
      });
    }

    const parsed = UpsertFirmStatusSchema.safeParse({
      status: req.body?.status === undefined ? null : req.body.status,
      resident: req.body?.resident,
    });
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Ошибка валидации",
        error: "VALIDATION_ERROR",
      });
    }

    const exists = await firmExistsInQuik(firmId);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Фирма не найдена в QUIK.Firms",
        error: "NOT_FOUND",
      });
    }

    if (parsed.data.status != null) {
      const dict = await findStatusDictById(parsed.data.status);
      if (!dict) {
        return res.status(400).json({
          success: false,
          message: "Указанный статус отсутствует в справочнике",
          error: "VALIDATION_ERROR",
        });
      }
    }

    const row = await upsertFirmStatus(firmId, parsed.data);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}
