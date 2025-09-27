const request = require('supertest');
const mongoose = require('mongoose');
const { app, server, mqttServer } = require('../server');
const User = require('../models/User');
const { testUtils, testDb } = global;

describe('Authentication API', () => {
    beforeAll(async () => {
        // Track servers for cleanup
        if (server) global.testServers.push(server);
        if (mqttServer) global.testServers.push(mqttServer);

        await testDb.connect();
    });

    afterAll(async () => {
        await testDb.disconnect();
    });

    beforeEach(async () => {
        await testDb.clear();
    });

    describe('POST /api/auth/register', () => {
        test('should register a new user successfully', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
                role: 'student',
                department: 'Computer Science'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body).toHaveProperty('message', 'Registration successful! Your account is pending admin approval.');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user).toHaveProperty('name', userData.name);
            expect(response.body.user).toHaveProperty('email', userData.email);
            expect(response.body.user).not.toHaveProperty('password');
        });

        test('should reject registration with existing email', async () => {
            // Create existing user
            await User.create({
                name: 'Existing User',
                email: 'existing@example.com',
                password: 'password123',
                role: 'student'
            });

            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'New User',
                    email: 'existing@example.com',
                    password: 'password123',
                    role: 'student'
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toMatch(/Validation failed/i);
        });

        test('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({})
                .expect(400);

            expect(response.body).toHaveProperty('errors');
            expect(Array.isArray(response.body.errors)).toBe(true);
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            // Create test user
            await User.create({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
                role: 'student',
                isActive: true,
                isApproved: true
            });
        });

        test('should login successfully with correct credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .expect(200);

            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user).toHaveProperty('email', 'test@example.com');
            expect(response.body.token).toBeValidJWT();
        });

        test('should reject login with wrong password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword'
                })
                .expect(401);

            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toMatch(/invalid/i);
        });

        test('should reject login with non-existent email', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'password123'
                })
                .expect(401);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('GET /api/auth/profile', () => {
        let token;

        beforeEach(async () => {
            // Create test user and get token
            const user = await User.create({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
                role: 'student',
                isActive: true,
                isApproved: true
            });

            token = testUtils.generateTestToken(user._id, user.role);
        });

        test('should return user profile with valid token', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body).toHaveProperty('user');
            expect(response.body.user).toHaveProperty('name', 'Test User');
            expect(response.body.user).toHaveProperty('email', 'test@example.com');
            expect(response.body.user).not.toHaveProperty('password');
        });

        test('should reject request without token', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .expect(401);

            expect(response.body).toHaveProperty('message');
        });

        test('should reject request with invalid token', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('PUT /api/auth/change-password', () => {
        let token;
        let user;

        beforeEach(async () => {
            // Create test user
            user = await User.create({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
                role: 'student',
                isActive: true,
                isApproved: true
            });

            token = testUtils.generateTestToken(user._id, user.role);
        });

        test('should change password successfully', async () => {
            const response = await request(app)
                .put('/api/auth/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    currentPassword: 'password123',
                    newPassword: 'newpassword123'
                })
                .expect(200);

            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toMatch(/password.*changed/i);
        });

        test('should reject with wrong current password', async () => {
            const response = await request(app)
                .put('/api/auth/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    currentPassword: 'wrongpassword',
                    newPassword: 'newpassword123'
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toMatch(/current.*password.*incorrect/i);
        });
    });
});