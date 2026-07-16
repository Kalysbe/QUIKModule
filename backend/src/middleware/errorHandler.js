import logger from '../utils/logger.js';

function serializeError(err) {
  if (!err || typeof err !== 'object') {
    return err;
  }

  const serialized = {
    message: err.message,
    stack: err.stack,
    name: err.name
  };

  const extraKeys = [
    'code',
    'errno',
    'syscall',
    'address',
    'port',
    'path',
    'host',
    'hostname',
    'status',
    'statusCode'
  ];

  for (const key of extraKeys) {
    if (err[key] !== undefined) {
      serialized[key] = err[key];
    }
  }

  if (err.cause) {
    serialized.cause = serializeError(err.cause);
  }

  if (Array.isArray(err.errors)) {
    serialized.errors = err.errors;
  }

  return serialized;
}

/**
 * Централизованный обработчик ошибок Express
 */
export function errorHandler(err, req, res, next) {
  const serializedError = serializeError(err);

  // Сохраняем информацию об ошибке для последующего логирования в api_logs
  req._errorForLogging = {
    errorMessage: err.message,
    errorStack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    errorType: err.name
  };

  // Логируем ошибку: 401/404 — как предупреждение (ожидаемые случаи), остальное — как error
  const errorText = err && typeof err.message === 'string' ? err.message : String(err);
  const isExpectedClientError = err.name === 'UnauthorizedError' || err.name === 'NotFoundError' || err.name === 'ForbiddenError';
  const logPayload = {
    error: serializedError,
    request: {
      method: req.method,
      url: req.url,
      ip: req.clientIP || req.ip,
      body: req.body,
      params: req.params,
      query: req.query
    }
  };
  if (isExpectedClientError) {
    const prefix = err.name === 'UnauthorizedError' ? 'Unauthorized request: ' : err.name === 'ForbiddenError' ? 'Forbidden: ' : 'Not found: ';
    logger.warn(prefix + errorText, logPayload);
  } else {
    logger.error('Unhandled error: ' + errorText, logPayload);
  }

  // Определяем статус код
  const statusCode = err.statusCode || err.status || 500;

  // Формируем ответ клиенту — без stack и внутренних деталей (безопасность и удобство)
  const response = {
    success: false,
    message: err.message || 'Внутренняя ошибка сервера',
    error: err.name || 'InternalServerError'
  };

  // Специальная обработка для известных типов ошибок
  if (err.name === 'ValidationError') {
    response.error = 'VALIDATION_ERROR';
    response.details = err.details || err.errors;
  }

  if (err.name === 'UnauthorizedError') {
    response.error = 'UNAUTHORIZED';
    if (err.code) {
      response.code = err.code;
    }
  }

  if (err.name === 'ForbiddenError') {
    response.error = 'FORBIDDEN';
  }

  res.status(statusCode).json(response);
}

/**
 * Middleware для обработки 404 ошибок
 */
export function notFoundHandler(req, res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.url}`);
  err.statusCode = 404;
  err.name = 'NotFoundError';
  next(err);
}

/**
 * Обработчик для необработанных промисов
 */
export function setupUnhandledRejectionHandler() {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason instanceof Error ? serializeError(reason) : reason,
      promise: promise.toString()
    });

    // В продакшене не завершаем процесс, только логируем
    // PM2 автоматически перезапустит приложение при необходимости
  });
}

/**
 * Обработчик для необработанных исключений
 */
export function setupUncaughtExceptionHandler() {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      error: serializeError(error)
    });

    // Даем время на логирование, затем завершаем процесс
    // PM2 автоматически перезапустит приложение
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
}

