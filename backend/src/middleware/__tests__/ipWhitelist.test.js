import { jest } from '@jest/globals';
import {
  ipWhitelistMiddleware,
  isTrustProxyEnabled,
  normalizeIp,
  resolveRequestIps
} from '../ipWhitelist.js';

describe('IP Whitelist Middleware', () => {
  let req, res, next;
  const originalTrustProxy = process.env.TRUST_PROXY;
  const originalDocker = process.env.RUNNING_IN_DOCKER;

  beforeEach(() => {
    process.env.TRUST_PROXY = 'true';
    delete process.env.RUNNING_IN_DOCKER;

    req = {
      headers: {},
      connection: {},
      socket: {},
      ip: null,
      logger: {
        warn: jest.fn()
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  afterEach(() => {
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = originalTrustProxy;
    if (originalDocker === undefined) delete process.env.RUNNING_IN_DOCKER;
    else process.env.RUNNING_IN_DOCKER = originalDocker;
  });

  describe('normalizeIp', () => {
    test('strips IPv4-mapped prefix', () => {
      expect(normalizeIp('::ffff:192.168.1.10')).toBe('192.168.1.10');
    });

    test('strips IPv4 port', () => {
      expect(normalizeIp('192.168.1.10:54321')).toBe('192.168.1.10');
    });

    test('strips brackets from IPv6', () => {
      expect(normalizeIp('[::1]')).toBe('::1');
    });
  });

  describe('Localhost IPs', () => {
    test('should allow 127.0.0.1', () => {
      req.ip = '127.0.0.1';
      ipWhitelistMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow ::1', () => {
      req.ip = '::1';
      ipWhitelistMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow ::ffff:127.0.0.1', () => {
      req.ip = '::ffff:127.0.0.1';
      ipWhitelistMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Local Network IPs', () => {
    test('should allow 192.168.1.1', () => {
      req.ip = '192.168.1.1';
      ipWhitelistMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow 10.0.0.1', () => {
      req.ip = '10.0.0.1';
      ipWhitelistMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow 172.16.0.1', () => {
      req.ip = '172.16.0.1';
      ipWhitelistMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('External IPs', () => {
    test('should reject 8.8.8.8', () => {
      req.ip = '8.8.8.8';
      ipWhitelistMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Доступ запрещен. Приложение доступно только из локальной сети организации.',
        error: 'FORBIDDEN_IP'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject 1.1.1.1', () => {
      req.ip = '1.1.1.1';
      ipWhitelistMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('X-Forwarded-For header', () => {
    test('should use X-Forwarded-For header when present', () => {
      req.headers['x-forwarded-for'] = '192.168.1.100, 8.8.8.8';
      req.ip = '8.8.8.8';
      ipWhitelistMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.clientIP).toBe('192.168.1.100');
    });

    test('should allow when X-Forwarded-For is public but socket peer is Docker/LAN proxy', () => {
      // Типичный кейс qauct.kse.kg → edge → auction nginx → backend
      process.env.TRUST_PROXY = 'true';
      req.headers['x-forwarded-for'] = '203.0.113.50';
      req.socket.remoteAddress = '172.18.0.5';
      ipWhitelistMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.clientIP).toBe('203.0.113.50');
      expect(req.socketIP).toBe('172.18.0.5');
    });

    test('should reject public X-Forwarded-For when TRUST_PROXY=false', () => {
      process.env.TRUST_PROXY = 'false';
      req.headers['x-forwarded-for'] = '203.0.113.50';
      req.socket.remoteAddress = '172.18.0.5';
      ipWhitelistMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('should still reject when both client and socket are public', () => {
      process.env.TRUST_PROXY = 'true';
      req.headers['x-forwarded-for'] = '203.0.113.50';
      req.socket.remoteAddress = '198.51.100.10';
      ipWhitelistMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('isTrustProxyEnabled', () => {
    test('defaults to true in Docker', () => {
      delete process.env.TRUST_PROXY;
      process.env.RUNNING_IN_DOCKER = 'true';
      expect(isTrustProxyEnabled()).toBe(true);
    });

    test('defaults to false outside Docker', () => {
      delete process.env.TRUST_PROXY;
      delete process.env.RUNNING_IN_DOCKER;
      expect(isTrustProxyEnabled()).toBe(false);
    });
  });

  describe('resolveRequestIps', () => {
    test('prefers X-Forwarded-For over socket', () => {
      req.headers['x-forwarded-for'] = '10.1.2.3';
      req.socket.remoteAddress = '172.18.0.2';
      expect(resolveRequestIps(req)).toEqual({
        clientIP: '10.1.2.3',
        socketIP: '172.18.0.2'
      });
    });
  });

  describe('Custom allowed networks', () => {
    test('should respect custom allowed networks from env', () => {
      const originalEnv = process.env.ALLOWED_NETWORKS;
      process.env.ALLOWED_NETWORKS = '203.0.113.0/24';

      req.ip = '203.0.113.10';
      ipWhitelistMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();

      process.env.ALLOWED_NETWORKS = originalEnv;
    });
  });
});
