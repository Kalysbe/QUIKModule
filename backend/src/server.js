import app from "./app.js";
import dotenv from "dotenv";
import pgPool from "./config/dbPostgres.js"; // подключение к PostgreSQL
import pgKsePool from "./config/dbKse.js"; // подключение к PostgreSQL KSE
import job from "./cron/cronJob.js"; // ← импортируем задачу
import logger from "./utils/logger.js";
import { 
  setupUnhandledRejectionHandler, 
  setupUncaughtExceptionHandler 
} from "./middleware/errorHandler.js";

dotenv.config();

// Настройка обработчиков необработанных исключений
setupUnhandledRejectionHandler();
setupUncaughtExceptionHandler();

const PORT = process.env.PORT || 5000;

// КРИТИЧЕСКИ ВАЖНО: На «голом» Windows-сервере (без Docker) сервер НЕ должен слушать 0.0.0.0,
// чтобы не оказаться доступным снаружи локальной сети напрямую, минуя контроль на уровне приложения.
// Используем конкретный IP из переменных окружения или localhost.
// В Docker изоляция обеспечивается сетью контейнера и публикацией портов (docker-compose ports),
// поэтому для контейнера разрешаем 0.0.0.0 явно через RUNNING_IN_DOCKER=true (см. docker-compose.yml).
const HOST = process.env.SERVER_HOST || '127.0.0.1';
const RUNNING_IN_DOCKER = process.env.RUNNING_IN_DOCKER === 'true';

if (HOST === '0.0.0.0' && !RUNNING_IN_DOCKER) {
  logger.error('SECURITY ERROR: Server cannot listen on 0.0.0.0 outside Docker. Use specific IP or 127.0.0.1, or set RUNNING_IN_DOCKER=true.');
  process.exit(1);
}

let server;

async function testConnections() {
  logger.info("🔍 Проверяем подключения к базам...");

  // Проверка PostgreSQL (некритично — сервер запускается в любом случае)
  try {
    const res = await pgPool.query("SELECT NOW()");
    logger.info("✅ PostgreSQL подключен успешно", { timestamp: res.rows[0].now });
  } catch (err) {
    const msg = (err && err.message) ? String(err.message) : String(err);
    logger.warn("PostgreSQL недоступен (сервер запустится). Ошибка: " + msg);
  }

  // Проверка PostgreSQL KSE (некритично)
  try {
    const resKse = await pgKsePool.query("SELECT NOW()");
    logger.info("✅ PostgreSQL KSE подключен успешно", { timestamp: resKse.rows[0].now });
  } catch (err) {
    const msg = (err && err.message) ? String(err.message) : String(err);
    logger.warn("PostgreSQL KSE недоступен (сервер запустится). Ошибка: " + msg);
  }

  logger.info("✅ Проверка подключений завершена");
}

async function startServer() {
  try {
    // Проверяем подключения перед запуском
    await testConnections();

    // Запускаем сервер
    server = app.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running on ${HOST}:${PORT}`, {
        host: HOST,
        port: PORT,
        environment: process.env.NODE_ENV || 'production',
        allowedNetworks: process.env.ALLOWED_NETWORKS || 'default (192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12)'
      });
      if (HOST !== '127.0.0.1' && HOST !== 'localhost' && HOST !== '::1' && !RUNNING_IN_DOCKER) {
        logger.warn(
          `Vite по умолчанию шлёт /api на http://127.0.0.1:${PORT}. Слушаете только ${HOST} — задайте в auctionModule/vite.config.ts proxy target http://${HOST}:${PORT} или SERVER_HOST=127.0.0.1 для чисто локальной разработки. Иначе 401 из‑за другого процесса/секрета на 127.0.0.1.`
        );
      }

    });

    // Обработка ошибок сервера
    server.on('error', (error) => {
      logger.error('Server error', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Останавливаем прием новых подключений
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');

      // Останавливаем cron job
      job.stop();
      logger.info('Cron job stopped');

      // Закрываем подключения к БД (игнорируем ошибки — выходим с 0)
      Promise.allSettled([pgPool.end(), pgKsePool.end()])
        .then((results) => {
          results.forEach((r, i) => {
            if (r.status === "rejected") logger.warn("Пул БД при закрытии", { index: i, error: r.reason?.message });
          });
          logger.info('Database connections closed');
          process.exit(0);
        });
    });

    // Принудительное завершение через 10 секунд
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

// Запуск сервера
startServer();
