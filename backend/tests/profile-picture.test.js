const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { app, server, mqttServer } = require('../server');
const User = require('../models/User');
const { testUtils, testDb } = global;

describe('Profile Picture API', () => {
    let authToken;
    let testUser;

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

        // Create and approve a test user
        testUser = await User.create({
            name: 'Test User',
            email: 'test@example.com',
            password: 'password123',
            role: 'student',
            department: 'Computer Science',
            isApproved: true,
            isActive: true
        });

        // Login to get token
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'password123'
            });

        authToken = loginResponse.body.token;
    });

    describe('PATCH /api/users/me/profile-picture', () => {
        test('should upload profile picture successfully', async () => {
            // Create a test image file
            const testImagePath = path.join(__dirname, 'test-image.jpg');
            const testImageBuffer = Buffer.from('fake-image-data', 'utf8');
            fs.writeFileSync(testImagePath, testImageBuffer);

            const response = await request(app)
                .patch('/api/users/me/profile-picture')
                .set('Authorization', `Bearer ${authToken}`)
                .attach('profilePicture', fs.readFileSync(testImagePath), 'test-image.jpg')
                .expect(200);

            expect(response.body).toHaveProperty('message', 'Profile picture updated successfully');
            expect(response.body).toHaveProperty('profilePicture');
            expect(response.body.profilePicture).toMatch(/^\/uploads\/profiles\//);

            // Clean up test file
            fs.unlinkSync(testImagePath);

            // Verify user was updated in database
            const updatedUser = await User.findById(testUser._id);
            expect(updatedUser.profilePicture).toBeDefined();
            expect(updatedUser.profilePicture).toMatch(/^\/uploads\/profiles\//);
        });

        test('should reject invalid file type', async () => {
            const response = await request(app)
                .patch('/api/users/me/profile-picture')
                .set('Authorization', `Bearer ${authToken}`)
                .attach('profilePicture', Buffer.from('fake-text-file'), 'test.txt')
                .expect(400);

            expect(response.body).toHaveProperty('message', 'Only image files (jpeg, jpg, png, gif) are allowed!');
        });

        test('should reject file too large', async () => {
            // Create a large file (6MB)
            const largeFile = Buffer.alloc(6 * 1024 * 1024, 'x');

            const response = await request(app)
                .patch('/api/users/me/profile-picture')
                .set('Authorization', `Bearer ${authToken}`)
                .attach('profilePicture', largeFile, 'large-image.jpg')
                .expect(400);

            expect(response.body).toHaveProperty('message', 'File too large. Maximum size is 5MB.');
        });
    });

    describe('DELETE /api/users/me/profile-picture', () => {
        test('should delete profile picture successfully', async () => {
            // First upload a profile picture
            const testImagePath = path.join(__dirname, 'test-image.jpg');
            const testImageBuffer = Buffer.from('fake-image-data', 'utf8');
            fs.writeFileSync(testImagePath, testImageBuffer);

            await request(app)
                .patch('/api/users/me/profile-picture')
                .set('Authorization', `Bearer ${authToken}`)
                .attach('profilePicture', fs.readFileSync(testImagePath), 'test-image.jpg');

            // Now delete it
            const response = await request(app)
                .delete('/api/users/me/profile-picture')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('message', 'Profile picture removed successfully');

            // Clean up test file
            fs.unlinkSync(testImagePath);

            // Verify user was updated in database
            const updatedUser = await User.findById(testUser._id);
            expect(updatedUser.profilePicture).toBeNull();
        });
    });
});