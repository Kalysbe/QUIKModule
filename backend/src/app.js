import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.js";
import auctionsRoutes from "./routes/auctionsRoutes.js";
import ordersRoutes from "./routes/ordersRoutes.js";
import paramsRoutes from "./routes/paramsRoutes.js";
import kseRoutes from "./routes/kseRoutes.js";
import { requestLogger } from "./utils/logger.js";
import { ipWhitelistMiddleware } from "./middleware/ipWhitelist.js";
import { apiLoggerMiddleware } from "./middleware/apiLogger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();

// Лимит размера тела запросов (по умолчанию 5mb, можно переопределить через переменную окружения JSON_BODY_LIMIT)
const JSON_BODY_LIMIT = "50mb";

// Парсинг JSON и urlencoded с увеличенным лимитом
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ limit: JSON_BODY_LIMIT, extended: true }));

// Swagger JSON endpoint (должен быть самым первым, до любых middleware)
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.json(swaggerSpec);
});

// Swagger UI (должен быть до middleware, устанавливающих Content-Type)
// Добавляем middleware для правильной установки Content-Type для HTML
app.use("/api-docs", (req, res, next) => {
  // Для HTML страниц Swagger UI устанавливаем правильный Content-Type
  if (req.path === "/api-docs" || req.path === "/api-docs/") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
  }
  next();
});

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: `
      .swagger-ui .topbar { display: none }
    `,
    customSiteTitle: "QUIK Module API Documentation",
    swaggerOptions: {
      persistAuthorization: true,
      tryItOutEnabled: true,
    },
  })
);

// Установка заголовков (исключая Swagger UI и статические файлы)
app.use((req, res, next) => {
  // Не устанавливаем Content-Type для Swagger UI и статических файлов
  if (!req.path.startsWith("/api-docs") && !req.path.startsWith("/swagger-ui")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  next();
});

// Логирование запросов в файловый лог
app.use(requestLogger);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     description: Проверка работоспособности сервера. Доступен без проверки IP
 *     responses:
 *       200:
 *         description: Сервер работает
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 environment:
 *                   type: string
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "production"
  });
});


// Проверка IP адреса (только локальная сеть) - применяется ко всем остальным маршрутам
app.use(ipWhitelistMiddleware);

// Централизованное логирование всех API-вызовов в PostgreSQL
app.use(apiLoggerMiddleware);

// Маршруты (только модуль аукциона)
app.use("/api/auctions", auctionsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/params", paramsRoutes);
app.use("/api/kse", kseRoutes);

// Обработка 404
app.use(notFoundHandler);

// Централизованная обработка ошибок (должен быть последним)
app.use(errorHandler);

export default app;
