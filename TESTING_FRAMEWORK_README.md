# 🧪 Testing Framework

This document explains the comprehensive testing framework for the IoT Smart Classroom backend, including unit tests, integration tests, and CI/CD integration.

## Overview

The testing framework uses Jest with Supertest for API testing, providing comprehensive coverage of authentication, device management, permissions, and core functionality.

## Features

- **Unit Testing**: Individual component testing
- **Integration Testing**: End-to-end API testing
- **Authentication Testing**: JWT and user management
- **Device Testing**: Device CRUD operations and controls
- **Permission Testing**: Role-based access control
- **Coverage Reporting**: Detailed code coverage analysis
- **CI/CD Integration**: Automated testing pipelines

## Quick Start

### Run All Tests
```bash
cd backend
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Specific Test Suites
```bash
npm run test:auth      # Authentication tests
npm run test:device    # Device tests
npm run test:permission # Permission tests
```

### Watch Mode
```bash
npm run test:watch
```

## Test Structure

```
backend/tests/
├── setup.js              # Test configuration and utilities
├── auth.test.js          # Authentication API tests
├── device.test.js        # Device management tests
├── permission.test.js    # Permission system tests
├── server.test.js        # Server health tests
└── api.test.js           # General API tests
```

## Test Configuration

### Jest Configuration (`jest.config.js`)
```javascript
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js'
  ],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'models/**/*.js',
    'middleware/**/*.js',
    'routes/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    'server.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    }
  }
};
```

### Test Setup (`tests/setup.js`)
- Environment configuration
- Global test utilities
- Database connection helpers
- Custom Jest matchers
- Mock implementations

## Writing Tests

### Basic Test Structure
```javascript
const request = require('supertest');
const { app } = require('../server');
const { testUtils, testDb } = global;

describe('Feature Name', () => {
    beforeAll(async () => {
        await testDb.connect();
    });

    afterAll(async () => {
        await testDb.disconnect();
    });

    beforeEach(async () => {
        await testDb.clear();
    });

    test('should perform action successfully', async () => {
        // Arrange
        const testData = { /* test data */ };

        // Act
        const response = await request(app)
            .post('/api/endpoint')
            .send(testData)
            .expect(200);

        // Assert
        expect(response.body).toHaveProperty('success', true);
    });
});
```

### Test Utilities

#### Generate Test Tokens
```javascript
const token = testUtils.generateTestToken(userId, 'admin');
```

#### Create Mock Data
```javascript
const mockUser = testUtils.createMockUser({
    name: 'Test User',
    role: 'student'
});

const mockDevice = testUtils.createMockDevice({
    name: 'Test Device',
    classroom: 'Test Room'
});
```

#### Mock Request/Response
```javascript
const mockReq = testUtils.createMockRequest(body, params, query, user);
const mockRes = testUtils.createMockResponse();
```

#### Database Helpers
```javascript
await testDb.connect();    // Connect to test DB
await testDb.disconnect(); // Disconnect from test DB
await testDb.clear();      // Clear all collections
```

## Test Categories

### Authentication Tests
- User registration and validation
- Login/logout functionality
- JWT token verification
- Password change operations
- Profile management

### Device Tests
- Device CRUD operations
- Switch control and toggling
- Device status monitoring
- Bulk operations
- Device configuration

### Permission Tests
- Permission granting and revocation
- Role-based access control
- Usage limits and restrictions
- Time-based permissions
- Temporary overrides

## Coverage Requirements

The framework enforces minimum coverage thresholds:

```json
{
  "branches": 70,
  "functions": 75,
  "lines": 80,
  "statements": 80
}
```

### Coverage Reports
- **Text**: Console output summary
- **LCOV**: Detailed line-by-line coverage
- **HTML**: Interactive web report
- **JSON**: Machine-readable format

## Advanced Testing Features

### Custom Matchers
```javascript
expect(token).toBeValidJWT();
expect(response).toHaveStatus(200);
```

### Test Fixtures
Pre-configured test data for consistent testing:

```javascript
// Create test user with device permissions
const { user, device, permission } = await createTestFixture();
```

### Mock Services
Mock external dependencies for isolated testing:

```javascript
jest.mock('../services/emailService');
jest.mock('../services/deviceMonitoringService');
```

## Running Tests

### Development Mode
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npx jest auth.test.js

# Run tests matching pattern
npx jest --testNamePattern="should login"
```

### CI/CD Mode
```bash
# Run tests for CI (no watch, with coverage)
npm run test:ci

# Generate coverage report
npm run test:coverage
```

### Advanced Runner
```bash
# Using the enhanced test runner
node test-runner.js all --coverage
node test-runner.js auth --watch
node test-runner.js report
```

## Test Data Management

### Test Database
- Isolated MongoDB test database
- Automatic cleanup between tests
- Environment-specific configuration

### Seed Data
```javascript
// Create test data
const testUser = await User.create({
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    role: 'student'
});
```

### Cleanup
```javascript
// Automatic cleanup after each test
afterEach(async () => {
    await testDb.clear();
});
```

## Integration Testing

### API Integration Tests
```javascript
describe('API Integration', () => {
    test('should handle complete user workflow', async () => {
        // Register user
        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send(userData);

        // Login
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send(loginData);

        // Access protected resource
        const protectedResponse = await request(app)
            .get('/api/protected')
            .set('Authorization', `Bearer ${loginResponse.body.token}`);

        expect(protectedResponse.status).toBe(200);
    });
});
```

### Database Integration
```javascript
test('should persist data correctly', async () => {
    // Create record
    const created = await Device.create(deviceData);

    // Retrieve from database
    const retrieved = await Device.findById(created._id);

    expect(retrieved.name).toBe(deviceData.name);
});
```

## Mocking Strategies

### External Services
```javascript
jest.mock('../services/emailService', () => ({
    sendWelcomeEmail: jest.fn().mockResolvedValue(true)
}));
```

### Database Models
```javascript
jest.mock('../models/User');
User.findById.mockResolvedValue(mockUser);
```

### HTTP Requests
```javascript
jest.mock('axios');
axios.get.mockResolvedValue({ data: mockResponse });
```

## Performance Testing

### Load Testing
```javascript
test('should handle multiple concurrent requests', async () => {
    const promises = Array(100).fill().map(() =>
        request(app).get('/api/health')
    );

    const responses = await Promise.all(promises);
    responses.forEach(response => {
        expect(response.status).toBe(200);
    });
});
```

### Response Time Testing
```javascript
test('should respond within acceptable time', async () => {
    const start = Date.now();

    await request(app).get('/api/devices');

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000); // 1 second
});
```

## Debugging Tests

### Debug Mode
```bash
# Run tests with debug information
DEBUG=test npx jest

# Run single test with detailed output
npx jest --verbose auth.test.js
```

### Test Isolation
```javascript
// Ensure tests don't interfere with each other
beforeEach(async () => {
    jest.clearAllMocks();
    await testDb.clear();
});
```

## Best Practices

### Test Organization
1. **Arrange-Act-Assert**: Clear test structure
2. **Descriptive Names**: Self-documenting test names
3. **Independent Tests**: No test dependencies
4. **Fast Execution**: Quick feedback loop
5. **Realistic Data**: Use realistic test data

### Code Coverage
1. **Target Critical Paths**: Focus on business logic
2. **Avoid Vanity Metrics**: Quality over quantity
3. **Review Uncovered Code**: Identify gaps
4. **Maintain Thresholds**: Consistent quality standards

### Maintenance
1. **Regular Updates**: Keep tests current
2. **Refactor Tests**: Improve test code quality
3. **Documentation**: Document complex test scenarios
4. **CI Integration**: Automated test execution

## Troubleshooting

### Common Issues

#### Database Connection
```bash
# Ensure MongoDB is running
mongod --dbpath /path/to/test/db

# Check connection string
echo $MONGODB_URI
```

#### Port Conflicts
```bash
# Kill process on port
lsof -ti:3001 | xargs kill -9

# Use different port for tests
process.env.PORT = 3002;
```

#### Memory Issues
```bash
# Increase Node.js memory
node --max-old-space-size=4096 test-runner.js

# Run tests with less parallelism
npx jest --maxWorkers=2
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Backend Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: cd backend && npm install
      - run: cd backend && npm run test:ci
      - uses: codecov/codecov-action@v2
        with:
          directory: ./backend/coverage
```

### Docker Integration
```dockerfile
# Test stage
FROM node:18-alpine AS test
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run test:ci
```

## Contributing

### Adding New Tests
1. Create test file in `tests/` directory
2. Follow naming convention: `*.test.js`
3. Use descriptive test names
4. Include setup and teardown
5. Add to appropriate test suite

### Test Standards
- Minimum 80% code coverage
- All tests must pass
- No console errors or warnings
- Proper error handling
- Realistic test data

## Support

For testing issues:
1. Check test output for detailed errors
2. Verify test database connection
3. Review test setup and configuration
4. Check for missing dependencies
5. Review Jest configuration

## Future Enhancements

- **Visual Testing**: Screenshot comparison for UI
- **Performance Testing**: Load and stress testing
- **Security Testing**: Penetration testing integration
- **Contract Testing**: API contract validation
- **Chaos Testing**: Resilience testing