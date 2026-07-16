import { ipWhitelistMiddleware } from '../ipWhitelist.js';

describe('IP Whitelist Middleware', () => {
  let req, res, next;

  beforeEach(() => {
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

