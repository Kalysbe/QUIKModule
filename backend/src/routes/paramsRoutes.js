import express from "express";
import { getAuctionParams } from "../controllers/paramsController.js";
import { auctionRequireAuth, auctionRequireReadRole } from "../middleware/auctionAuth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Params
 *   description: API для работы с параметрами (таблица Params в PostgreSQL)
 */

/**
 * @swagger
 * /api/params/auction:
 *   get:
 *     summary: Получить параметры только по аукционным классам
 *     tags: [QUIK - Params]
 *     description: Возвращает данные из таблицы Params (PostgreSQL) только для тех записей, где ClassCode присутствует в локальном реестре quik_kse и помечен как trade segment = auction, и поле auction_id не пустое (IS NOT NULL).
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 200
 *           minimum: 1
 *           maximum: 1000
 *         description: Максимальное количество записей (по умолчанию 200, максимум 1000)
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Смещение для постраничной выборки
 *       - in: query
 *         name: today
 *         required: false
 *         schema:
 *           type: string
 *           example: "1"
 *         description: По умолчанию включен фильтр за текущий день. Для отключения передайте 0/false/no
 *       - in: query
 *         name: paramName
 *         required: false
 *         schema:
 *           type: string
 *         description: Дополнительный фильтр по любому столбцу таблицы Params
 *     responses:
 *       200:
 *         description: Список записей из Params по аукционным классам (или объект с data/pagination при передаче limit/offset)
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: array
 *                   items:
 *                     type: object
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         limit: { type: integer }
 *                         offset: { type: integer }
 *                         count: { type: integer }
 *       400:
 *         description: Некорректные limit/offset
 *       404:
 *         description: Таблица Params или столбец ClassCode не найдены
 *       500:
 *         description: Ошибка сервера
 */
router.get("/auction", auctionRequireAuth, auctionRequireReadRole, getAuctionParams);

export default router;
