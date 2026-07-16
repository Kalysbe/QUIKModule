import request from 'supertest';
import app from '../app.js';

describe('App', () => {
  describe('Health Check', () => {
    test('GET /health should return 200', async () => {
      const response = await request(app)
        .get('/health')
        .set('X-Forwarded-For', '127.0.0.1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('IP Whitelist', () => {
    test('should allow localhost', async () => {
      const response = await request(app)
        .get('/api/orders/all')
        .set('X-Forwarded-For', '127.0.0.1');
      
      // Может быть 200 или 404/500 (нет БД в тестах), но не 403
      expect(response.status).not.toBe(403);
    });

    test('should reject external IP', async () => {
      const response = await request(app)
        .get('/api/orders/all')
        .set('X-Forwarded-For', '8.8.8.8');
      
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'FORBIDDEN_IP');
    });
  });

  describe('404 Handler', () => {
    test('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown')
        .set('X-Forwarded-For', '127.0.0.1');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
    });
  });
});

