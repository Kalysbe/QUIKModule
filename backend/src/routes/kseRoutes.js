import express from "express";
import { login, getMe, changePassword } from "../controllers/kseAuthController.js";
import { kseRequireAuth, kseRequireAdmin } from "../middleware/kseAuth.js";

const router = express.Router();

/**
 * @swagger
 * KSE API — авторизация модуля аукциона. Источник: БД фондовой биржи (quik_kse).
 */

/**
 * @swagger
 * /api/kse/auth/login:
 *   post:
 *     summary: Вход (получить JWT)
 *     tags: [KSE - Auth]
 *     description: Возвращает JWT и данные пользователя при успешной проверке логина и пароля. Источник: БД KSE.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [login, password]
 *             properties:
 *               login:
 *                 type: string
 *                 description: Логин пользователя
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Пароль
 *     responses:
 *       200:
 *         description: Успешный вход
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 token: { type: string, description: JWT для заголовка Authorization Bearer }
 *                 user: { type: object, properties: { id, login, first_name, last_name, firm_code, role, last_activity_at } }
 *       400:
 *         description: Не указаны логин или пароль
 *       401:
 *         description: Неверный логин или пароль
 */
router.post("/auth/login", login);

// Все маршруты ниже требуют авторизацию по JWT
router.use(kseRequireAuth);

/**
 * @swagger
 * /api/kse/auth/me:
 *   get:
 *     summary: Текущий пользователь
 *     tags: [KSE - Auth]
 *     description: Возвращает данные текущего пользователя по JWT. Источник: БД KSE.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Данные пользователя
 *       401:
 *         description: Требуется авторизация
 */
router.get("/auth/me", getMe);

/**
 * @swagger
 * /api/kse/auth/change-password:
 *   post:
 *     summary: Смена пароля (admin)
 *     tags: [KSE - Auth]
 *     description: Администратор меняет свой пароль. Требуется текущий пароль.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Пароль изменён
 *       400:
 *         description: Ошибка валидации
 *       401:
 *         description: Неверный текущий пароль
 *       403:
 *         description: Требуется роль admin
 */
router.post("/auth/change-password", kseRequireAdmin, changePassword);

export default router;
