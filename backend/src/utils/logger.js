import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Консоль в UTF-8, чтобы сообщения об ошибках (в т.ч. от PostgreSQL) отображались корректно
if (process.stdout.setDefaultEncoding) process.stdout.setDefaultEncoding('utf8');
if (process.stderr.setDefaultEncoding) process.stderr.setDefaultEncoding('utf8');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Создаем директорию для логов, если её нет
const logsDir = path.join(__dirname, '../../logs');
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

/**
 * Настройка логгера Winston
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'quikmodule',
    environment: process.env.NODE_ENV || 'production'
  },
  transports: [
    // Логи ошибок в отдельный файл
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    // Все логи в общий файл
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
  // Обработка необработанных исключений
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ],
  // Обработка необработанных промисов
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// В режиме разработки также выводим в консоль
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
          msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
      })
    )
  }));
} else {
  // В продакшене — читаемый вывод в консоль (одна строка: время, уровень, сообщение)
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let out = `${timestamp} [${level}]: ${message}`;
        const rest = { ...meta };
        delete rest.service;
        delete rest.environment;
        if (Object.keys(rest).length > 0) out += ' ' + JSON.stringify(rest);
        return out;
      })
    )
  }));
}

/**
 * Middleware для Express для логирования запросов
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  // Логируем запрос
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.clientIP || req.ip,
    userAgent: req.headers['user-agent']
  });

  // Перехватываем окончание ответа
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.clientIP || req.ip
    };

    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  // Добавляем logger в request для использования в контроллерах
  req.logger = logger;
  next();
}

export default logger;

