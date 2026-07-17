import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import logger from "../utils/logger.js";
import {
  findByLogin,
  findById,
  findByIdWithPassword,
  updateLastActivity,
  updateUser
} from "../repositories/kseUsersRepository.js";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

/**
 * POST /api/kse/auth/login
 * Тело: { login, password }
 * При успехе: обновляет last_activity_at, возвращает { token, user } (user без пароля).
 */
export async function login(req, res, next) {
  try {
    const { login, password } = req.body || {};
    if (!login || !password) {
      return res.status(400).json({
        success: false,
        message: "Не указаны логин или пароль",
        error: "VALIDATION_ERROR"
      });
    }

    const user = await findByLogin(String(login).trim());
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Неверный логин или пароль",
        error: "UNAUTHORIZED"
      });
    }

    const passwordHash = user.password_hash;
    if (!passwordHash || typeof passwordHash !== "string") {
      logger.warn("Login attempt for user without password_hash", { login: user.login, userId: user.id });
      return res.status(401).json({
        success: false,
        message: "Неверный логин или пароль",
        error: "UNAUTHORIZED"
      });
    }

    let match = false;
    try {
      match = await bcrypt.compare(password, passwordHash);
    } catch (bcryptErr) {
      logger.warn("bcrypt.compare failed", { message: bcryptErr.message, login: user.login });
      return res.status(401).json({
        success: false,
        message: "Неверный логин или пароль",
        error: "UNAUTHORIZED"
      });
    }
    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Неверный логин или пароль",
        error: "UNAUTHORIZED"
      });
    }

    await updateLastActivity(user.id);

    const payload = {
      userId: user.id,
      login: user.login,
      role: user.role
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const userResponse = {
      id: user.id,
      login: user.login,
      first_name: user.first_name,
      last_name: user.last_name,
      firm_code: user.firm_code,
      role: user.role,
      last_activity_at: new Date().toISOString()
    };

    res.json({
      success: true,
      token,
      user: userResponse
    });
  } catch (err) {
    logger.error("Login error", { message: err.message, stack: err.stack, name: err.name });
    next(err);
  }
}

/**
 * GET /api/kse/auth/me
 * Требует JWT. Возвращает данные текущего пользователя.
 */
export async function getMe(req, res, next) {
  try {
    const user = await findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Пользователь не найден",
        error: "NOT_FOUND"
      });
    }
    const userResponse = {
      ...user,
      last_activity_at: user.last_activity_at ? new Date(user.last_activity_at).toISOString() : null
    };
    res.json({ user: userResponse });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/kse/auth/change-password
 * Требует JWT и роль admin. Тело: { currentPassword, newPassword }
 */
export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Укажите текущий и новый пароль",
        error: "VALIDATION_ERROR"
      });
    }

    if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Новый пароль должен содержать не менее ${MIN_PASSWORD_LENGTH} символов`,
        error: "VALIDATION_ERROR"
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "Новый пароль должен отличаться от текущего",
        error: "VALIDATION_ERROR"
      });
    }

    const user = await findByIdWithPassword(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Пользователь не найден",
        error: "NOT_FOUND"
      });
    }

    const passwordHash = user.password_hash;
    if (!passwordHash || typeof passwordHash !== "string") {
      return res.status(400).json({
        success: false,
        message: "Смена пароля недоступна для этой учётной записи",
        error: "VALIDATION_ERROR"
      });
    }

    let match = false;
    try {
      match = await bcrypt.compare(currentPassword, passwordHash);
    } catch (bcryptErr) {
      logger.warn("bcrypt.compare failed on change-password", {
        message: bcryptErr.message,
        userId: user.id
      });
      return res.status(401).json({
        success: false,
        message: "Неверный текущий пароль",
        error: "UNAUTHORIZED"
      });
    }

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Неверный текущий пароль",
        error: "UNAUTHORIZED"
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await updateUser(user.id, { password_hash: newPasswordHash });

    res.json({
      success: true,
      message: "Пароль успешно изменён"
    });
  } catch (err) {
    logger.error("Change password error", { message: err.message, stack: err.stack, name: err.name });
    next(err);
  }
}
