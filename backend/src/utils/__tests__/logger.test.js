import logger from '../logger.js';
import { requestLogger } from '../logger.js';

describe('Logger', () => {
  test('should create logger instance', () => {
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.warn).toBeDefined();
  });

  test('should log info message', () => {
    const spy = jest.spyOn(logger, 'info');
    logger.info('Test message');
    expect(spy).toHaveBeenCalledWith('Test message');
    spy.mockRestore();
  });

  test('should log error message', () => {
    const spy = jest.spyOn(logger, 'error');
    logger.error('Test error');
    expect(spy).toHaveBeenCalledWith('Test error');
    spy.mockRestore();
  });
});

describe('Request Logger Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      url: '/api/test',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent'
      }
    };
    res = {
      statusCode: 200,
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          setTimeout(callback, 0);
        }
      })
    };
    next = jest.fn();
  });

  test('should add logger to request', () => {
    requestLogger(req, res, next);
    expect(req.logger).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  test('should log request on finish', (done) => {
    const spy = jest.spyOn(logger, 'info');
    requestLogger(req, res, next);
    
    // Симулируем завершение запроса
    res.on.mock.calls.forEach(([event, callback]) => {
      if (event === 'finish') {
        callback();
      }
    });
    
    setTimeout(() => {
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
      done();
    }, 10);
  });
});

