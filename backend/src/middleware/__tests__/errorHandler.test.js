import { errorHandler, notFoundHandler } from '../errorHandler.js';
import logger from '../../utils/logger.js';

jest.mock('../../utils/logger.js', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
}));

describe('Error Handler', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      url: '/api/test',
      ip: '127.0.0.1',
      body: {},
      params: {},
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  test('should handle generic error', () => {
    const error = new Error('Test error');
    errorHandler(error, req, res, next);
    
    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Test error',
      error: 'Error'
    });
  });

  test('should handle error with status code', () => {
    const error = new Error('Not found');
    error.statusCode = 404;
    errorHandler(error, req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('should include stack trace in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    const error = new Error('Test error');
    errorHandler(error, req, res, next);
    
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stack: expect.any(String)
      })
    );
    
    process.env.NODE_ENV = originalEnv;
  });

  test('should handle ValidationError', () => {
    const error = new Error('Validation error');
    error.name = 'ValidationError';
    error.details = [{ field: 'test', message: 'Invalid' }];
    errorHandler(error, req, res, next);
    
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'VALIDATION_ERROR',
        details: expect.any(Array)
      })
    );
  });
});

describe('Not Found Handler', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      url: '/api/unknown'
    };
    res = {};
    next = jest.fn();
  });

  test('should create 404 error and call next', () => {
    notFoundHandler(req, res, next);
    
    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(404);
    expect(error.message).toContain('Route not found');
  });
});

