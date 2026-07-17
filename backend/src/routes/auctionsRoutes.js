import express from "express";
import * as a from "../controllers/auctionsController.js";
import {
  auctionDenyMinfinWrite,
  auctionRequireAuth,
  auctionRequireReadRole,
} from "../middleware/auctionAuth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: QUIK - Auctions
 *   x-hidden: true
 *   description: API для управления аукционами
 */

/**
 * @swagger
 * /api/auctions:
 *   post:
 *     summary: Добавить аукцион
 *     tags: [QUIK - Auctions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Аукцион добавлен
 *       400:
 *         description: Ошибка валидации данных
 *       409:
 *         description: Бизнес-ошибка
 *       500:
 *         description: Ошибка сервера
 *   put:
 *     summary: Изменить аукцион
 *     tags: [QUIK - Auctions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Аукцион изменён
 *       400:
 *         description: Ошибка валидации данных
 *       409:
 *         description: Бизнес-ошибка
 *       500:
 *         description: Ошибка сервера
 *   delete:
 *     summary: Удалить аукцион
 *     tags: [QUIK - Auctions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [CustomAuctionId]
 *             properties:
 *               CustomAuctionId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Аукцион удалён
 *       400:
 *         description: Ошибка валидации данных
 *       409:
 *         description: Бизнес-ошибка
 *       500:
 *         description: Ошибка сервера
 *
 * /api/auctions/notification-time:
 *   post:
 *     summary: Изменить время нотификации
 *     tags: [QUIK - Auctions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Время нотификации изменено
 *       400:
 *         description: Ошибка валидации данных
 *       409:
 *         description: Бизнес-ошибка
 *       500:
 *         description: Ошибка сервера
 *
 * /api/auctions/date-time:
 *   post:
 *     summary: Изменить дату и время аукциона
 *     tags: [QUIK - Auctions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Расписание изменено
 *       400:
 *         description: Ошибка валидации данных
 *       409:
 *         description: Бизнес-ошибка
 *       500:
 *         description: Ошибка сервера
 *
 * /api/auctions/time:
 *   post:
 *     summary: Изменить параметры времени аукциона
 *     tags: [QUIK - Auctions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Время аукциона изменено
 *       400:
 *         description: Ошибка валидации данных
 *       409:
 *         description: Бизнес-ошибка
 *       500:
 *         description: Ошибка сервера
 */
/**
 * @swagger
 * /api/auctions/completed:
 *   get:
 *     summary: Публичный список завершённых аукционов
 *     tags: [QUIK - Auctions]
 *     description: |
 *       Без авторизации. Аукцион считается завершённым, если дата аукциона (TradeDate)
 *       и время окончания (endtime) уже прошли относительно текущего момента (APP_TIMEZONE).
 *
 *       Поля ответа:
 *       - date — дата dd/mm/yyyy
 *       - secCode — код бумаги
 *       - issueVolume — объём выпуска (issuesize)
 *       - demandVolume — объём спроса по заявкам (сумма Qty)
 *       - dealVolume — объём сделки (сумма Qty по уникальным TradeNum)
 *       - minYield / maxYield / avgYield — мин./макс./средневзе. доходность по сделкам
 *       - couponRate — купонная ставка как в Ведомости 1:
 *         Округление(365 / couponperiod) * couponvalue
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 500
 *           minimum: 1
 *           maximum: 2000
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *     responses:
 *       200:
 *         description: Список завершённых аукционов
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date: { type: string, example: "17/07/2026" }
 *                       secCode: { type: string, example: "GBA0526" }
 *                       issueVolume: { type: number }
 *                       demandVolume: { type: number }
 *                       dealVolume: { type: number }
 *                       minYield: { type: number, nullable: true }
 *                       maxYield: { type: number, nullable: true }
 *                       avgYield: { type: number, nullable: true }
 *                       couponRate: { type: number, nullable: true }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit: { type: integer }
 *                     offset: { type: integer }
 *                     count: { type: integer }
 *                     total: { type: integer }
 *       400:
 *         description: Некорректные limit/offset
 *       404:
 *         description: Таблица Params или обязательные столбцы не найдены
 *       500:
 *         description: Ошибка сервера
 */
router.get("/completed", a.getCompletedAuctionsList);

router.post("/", a.addAuctionSchedule);
router.put("/", a.editAuctionSchedule);
router.delete("/", a.deleteAuctionSchedule);
router.post("/notification-time", a.changeAuctionNotificationTime);
router.post("/date-time", a.changeAuctionDateAndTime);
router.post("/time", a.changeAuctionTime);
router.get("/orders", a.getAuctionOrders);
router.post("/allocate", a.allocateAuction);
router.post("/allocate/tri", a.downloadAllocationTri);
router.post("/preliminary-calculations", auctionRequireAuth, auctionDenyMinfinWrite, a.savePreliminaryCalculation);
router.get("/preliminary-calculations/history", auctionRequireAuth, auctionRequireReadRole, a.getPreliminaryCalculationHistory);
router.get("/preliminary-calculations", auctionRequireAuth, auctionRequireReadRole, a.getLatestPreliminaryCalculation);

export default router;

