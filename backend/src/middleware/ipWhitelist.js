/**
 * Middleware для проверки IP адресов
 * Разрешает доступ только из локальной сети организации
 */

/**
 * Проверяет, принадлежит ли IP адрес локальной сети
 * @param {string} ip - IP адрес для проверки
 * @param {string[]} allowedNetworks - Массив разрешенных сетей (CIDR или IP)
 * @returns {boolean}
 */
function isLocalNetworkIP(ip, allowedNetworks = []) {
  // Разрешаем localhost
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return true;
  }

  // Если IP начинается с ::ffff:, извлекаем IPv4 часть
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // Если не указаны разрешенные сети, используем стандартные локальные диапазоны
  if (allowedNetworks.length === 0) {
    allowedNetworks = [
      '192.168.0.0/16',
      '10.0.0.0/8',
      '172.16.0.0/12',
      '127.0.0.0/8'
    ];
  }

  // Проверяем каждый разрешенный диапазон
  for (const network of allowedNetworks) {
    if (isIPInNetwork(ip, network)) {
      return true;
    }
  }

  return false;
}

/**
 * Проверяет, входит ли IP в сеть (CIDR)
 * @param {string} ip - IP адрес
 * @param {string} network - Сеть в формате CIDR (например, 192.168.0.0/16)
 * @returns {boolean}
 */
function isIPInNetwork(ip, network) {
  // Если это точный IP без маски
  if (!network.includes('/')) {
    return ip === network;
  }

  const [networkIP, prefixLength] = network.split('/');
  const prefix = parseInt(prefixLength, 10);

  // Конвертируем IP в число
  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(networkIP);

  if (isNaN(ipNum) || isNaN(networkNum)) {
    return false;
  }

  // Вычисляем маску сети
  const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;

  // Проверяем, входит ли IP в сеть
  return (ipNum & mask) === (networkNum & mask);
}

/**
 * Конвертирует IP адрес в число
 * @param {string} ip - IP адрес
 * @returns {number}
 */
function ipToNumber(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return NaN;
  }
  return parts.reduce((acc, part) => (acc << 8) + parseInt(part, 10), 0) >>> 0;
}

/**
 * Middleware для проверки IP адреса клиента
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next
 */
export function ipWhitelistMiddleware(req, res, next) {
  // Получаем реальный IP клиента
  const clientIP = 
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown';

  // Получаем разрешенные сети из переменных окружения
  const allowedNetworks = process.env.ALLOWED_NETWORKS
    ? process.env.ALLOWED_NETWORKS.split(',').map(n => n.trim())
    : [];

  // Проверяем IP
  if (!isLocalNetworkIP(clientIP, allowedNetworks)) {
    // Логируем попытку доступа с запрещенного IP
    if (req.logger) {
      req.logger.warn(`Access denied for IP: ${clientIP}`, {
        ip: clientIP,
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent']
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Доступ запрещен. Приложение доступно только из локальной сети организации.',
      error: 'FORBIDDEN_IP'
    });
  }

  // Добавляем IP в request для логирования
  req.clientIP = clientIP;
  next();
}

export default ipWhitelistMiddleware;

/**
 * Проверка IP для raw TCP/WebSocket (нет объекта req).
 * @param {import('net').Socket} socket
 * @returns {boolean}
 */
export function isSocketIpWhitelisted(socket) {
  let clientIP = socket.remoteAddress || "unknown";
  if (clientIP.startsWith("::ffff:")) {
    clientIP = clientIP.slice(7);
  }

  const allowedNetworks = process.env.ALLOWED_NETWORKS
    ? process.env.ALLOWED_NETWORKS.split(",").map((n) => n.trim())
    : [];

  return isLocalNetworkIP(clientIP, allowedNetworks);
}

