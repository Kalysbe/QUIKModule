/**
 * Middleware для проверки IP адресов
 * Разрешает доступ только из локальной сети организации.
 *
 * За reverse proxy (qauct.kse.kg → nginx → backend) клиентский IP приходит
 * в X-Forwarded-For / X-Real-IP, а socket — IP прокси (Docker/LAN).
 * Разрешаем, если клиент ИЛИ непосредственный peer (прокси) в ALLOWED_NETWORKS.
 */

const DEFAULT_ALLOWED_NETWORKS = [
  '192.168.0.0/16',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '127.0.0.0/8'
];

/**
 * Нормализует IP: ::ffff:x.x.x.x → x.x.x.x, [ipv6]:port / ipv4:port → без порта.
 * @param {string | undefined | null} raw
 * @returns {string}
 */
export function normalizeIp(raw) {
  if (!raw || typeof raw !== 'string') {
    return 'unknown';
  }

  let ip = raw.trim();

  // [2001:db8::1]:443 или [2001:db8::1]
  if (ip.startsWith('[')) {
    const end = ip.indexOf(']');
    if (end !== -1) {
      ip = ip.slice(1, end);
    }
  } else if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
    // IPv4-mapped мог прийти как ::ffff:192.168.0.1:1234 (редко)
    if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) {
      ip = ip.replace(/:\d+$/, '');
    }
  } else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) {
    // IPv4:port (некоторые прокси)
    ip = ip.replace(/:\d+$/, '');
  }

  return ip || 'unknown';
}

/**
 * @param {import('express').Request} req
 * @returns {{ clientIP: string, socketIP: string }}
 */
export function resolveRequestIps(req) {
  const socketIP = normalizeIp(
    req.socket?.remoteAddress ||
      req.connection?.remoteAddress ||
      req.ip ||
      'unknown'
  );

  const forwarded = req.headers['x-forwarded-for'];
  const forwardedClient =
    typeof forwarded === 'string'
      ? normalizeIp(forwarded.split(',')[0])
      : Array.isArray(forwarded)
        ? normalizeIp(String(forwarded[0]).split(',')[0])
        : null;

  const realIpHeader = req.headers['x-real-ip'];
  const realIP =
    typeof realIpHeader === 'string'
      ? normalizeIp(realIpHeader)
      : Array.isArray(realIpHeader)
        ? normalizeIp(String(realIpHeader[0]))
        : null;

  const clientIP = forwardedClient || realIP || socketIP;

  return { clientIP, socketIP };
}

/**
 * Проверяет, принадлежит ли IP адрес локальной сети
 * @param {string} ip - IP адрес для проверки
 * @param {string[]} allowedNetworks - Массив разрешенных сетей (CIDR или IP)
 * @returns {boolean}
 */
function isLocalNetworkIP(ip, allowedNetworks = []) {
  ip = normalizeIp(ip);

  // Разрешаем localhost
  if (ip === '127.0.0.1' || ip === '::1') {
    return true;
  }

  // Если не указаны разрешенные сети, используем стандартные локальные диапазоны
  if (allowedNetworks.length === 0) {
    allowedNetworks = DEFAULT_ALLOWED_NETWORKS;
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

  // IPv6 (кроме уже обработанного ::1) в CIDR IPv4 не проверяем
  if (ip.includes(':')) {
    return false;
  }

  const [networkIP, prefixLength] = network.split('/');
  const prefix = parseInt(prefixLength, 10);

  // Конвертируем IP в число
  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(networkIP);

  if (isNaN(ipNum) || isNaN(networkNum) || Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  // Вычисляем маску сети
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

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

function getAllowedNetworks() {
  return process.env.ALLOWED_NETWORKS
    ? process.env.ALLOWED_NETWORKS.split(',').map((n) => n.trim()).filter(Boolean)
    : [];
}

/**
 * Доверять IP непосредственного peer (nginx/IIS), если X-Forwarded-For «внешний».
 * Нужно для qauct.kse.kg → reverse proxy → backend.
 * Отключить: TRUST_PROXY=false
 */
export function isTrustProxyEnabled() {
  if (process.env.TRUST_PROXY === 'false') return false;
  if (process.env.TRUST_PROXY === 'true') return true;
  // В Docker auction-nginx всегда в 172.x/10.x — включаем по умолчанию
  return process.env.RUNNING_IN_DOCKER === 'true';
}

/**
 * Middleware для проверки IP адреса клиента
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next
 */
export function ipWhitelistMiddleware(req, res, next) {
  const { clientIP, socketIP } = resolveRequestIps(req);
  const allowedNetworks = getAllowedNetworks();

  // Клиент из заголовков прокси; при TRUST_PROXY — ещё и peer (Docker/IIS hop).
  // После привязки к домену X-Forwarded-For часто содержит IP edge вне LAN,
  // а socket остаётся адресом доверенного hop в 10/172/192.168.
  const allowed =
    isLocalNetworkIP(clientIP, allowedNetworks) ||
    (isTrustProxyEnabled() &&
      socketIP !== clientIP &&
      isLocalNetworkIP(socketIP, allowedNetworks));

  if (!allowed) {
    if (req.logger) {
      req.logger.warn(`Access denied for IP: ${clientIP}`, {
        ip: clientIP,
        socketIP,
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

  req.clientIP = clientIP;
  req.socketIP = socketIP;
  next();
}

export default ipWhitelistMiddleware;

/**
 * Проверка IP для raw TCP/WebSocket (нет объекта req).
 * @param {import('net').Socket} socket
 * @returns {boolean}
 */
export function isSocketIpWhitelisted(socket) {
  let clientIP = normalizeIp(socket.remoteAddress || 'unknown');
  return isLocalNetworkIP(clientIP, getAllowedNetworks());
}
