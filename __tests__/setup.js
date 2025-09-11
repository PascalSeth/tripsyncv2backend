// Jest setup file for global test configuration

// Set test environment
process.env.NODE_ENV = 'test';

// Load test environment variables
require('dotenv').config({ path: '.env.test' });

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  // Keep log and error for debugging
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Global test utilities
global.testUtils = {
  // Helper to wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to generate random test data
  generateId: () => Math.random().toString(36).substr(2, 9),

  // Helper to create test user tokens (mock)
  createTestToken: (userId, role = 'CUSTOMER') => {
    return `test_token_${userId}_${role}_${Date.now()}`;
  }
};

// Setup axios defaults for tests
const axios = require('axios');
axios.defaults.baseURL = process.env.API_BASE || 'http://localhost:3000/api';
axios.defaults.timeout = 10000; // 10 second timeout for tests

// Mock external services if needed
jest.mock('../src/config/database', () => ({
  default: {
    // Mock Prisma client methods as needed
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    delivery: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  }
}));

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Clean up after all tests
afterAll(async () => {
  // Close any open connections
  await new Promise(resolve => setTimeout(resolve, 500));
});