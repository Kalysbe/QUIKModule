import express from "express";
import { kseRequireAuth } from "../middleware/kseAuth.js";
import {
  getFirmStatusDict,
  postFirmStatusDict,
  putFirmStatusDict,
  deleteFirmStatusDict,
  getFirmsDirectory,
  putFirmDirectory,
} from "../controllers/firmStatusController.js";

const router = express.Router();

const DIRECTORY_READ_ROLES = new Set(["admin", "operator", "minfin"]);
const DIRECTORY_WRITE_ROLES = new Set(["admin", "operator"]);

function directoriesRequireRead(req, res, next) {
  if (!req.user || !DIRECTORY_READ_ROLES.has(req.user.role)) {
    const err = new Error("Доступ запрещён");
    err.statusCode = 403;
    err.name = "ForbiddenError";
    return next(err);
  }
  next();
}

function directoriesRequireWrite(req, res, next) {
  if (!req.user || !DIRECTORY_WRITE_ROLES.has(req.user.role)) {
    const err = new Error("Доступ запрещён: изменение справочников доступно ролям admin и operator");
    err.statusCode = 403;
    err.name = "ForbiddenError";
    return next(err);
  }
  next();
}

router.use(kseRequireAuth);

/**
 * @swagger
 * /api/kse/directories/firm-status-dict:
 *   get:
 *     summary: Справочник статусов фирм
 *     tags: [KSE - Directories]
 *     security: [{ bearerAuth: [] }]
 */
router.get("/firm-status-dict", directoriesRequireRead, getFirmStatusDict);

/**
 * @swagger
 * /api/kse/directories/firm-status-dict:
 *   post:
 *     summary: Добавить статус в справочник
 *     tags: [KSE - Directories]
 *     security: [{ bearerAuth: [] }]
 */
router.post("/firm-status-dict", directoriesRequireWrite, postFirmStatusDict);

/**
 * @swagger
 * /api/kse/directories/firm-status-dict/{id}:
 *   put:
 *     summary: Изменить статус в справочнике
 *     tags: [KSE - Directories]
 *     security: [{ bearerAuth: [] }]
 */
router.put("/firm-status-dict/:id", directoriesRequireWrite, putFirmStatusDict);

/**
 * @swagger
 * /api/kse/directories/firm-status-dict/{id}:
 *   delete:
 *     summary: Удалить статус из справочника
 *     tags: [KSE - Directories]
 *     security: [{ bearerAuth: [] }]
 */
router.delete("/firm-status-dict/:id", directoriesRequireWrite, deleteFirmStatusDict);

/**
 * @swagger
 * /api/kse/directories/firms:
 *   get:
 *     summary: Список фирм QUIK с локальным статусом/резидентством
 *     tags: [KSE - Directories]
 *     security: [{ bearerAuth: [] }]
 */
router.get("/firms", directoriesRequireRead, getFirmsDirectory);

/**
 * @swagger
 * /api/kse/directories/firms/{firmId}:
 *   put:
 *     summary: Назначить статус и резидентство фирме
 *     tags: [KSE - Directories]
 *     security: [{ bearerAuth: [] }]
 */
router.put("/firms/:firmId", directoriesRequireWrite, putFirmDirectory);

export default router;
