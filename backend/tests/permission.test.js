const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../server');
const DevicePermission = require('../models/DevicePermission');
const Device = require('../models/Device');
const User = require('../models/User');
const { testUtils, testDb } = global;

describe('Device Permission API', () => {
    let adminToken;
    let facultyToken;
    let studentToken;
    let adminUser;
    let facultyUser;
    let studentUser;
    let testDevice;

    beforeAll(async () => {
        await testDb.connect();
    });

    afterAll(async () => {
        await testDb.disconnect();
    });

    beforeEach(async () => {
        await testDb.clear();

        // Create test users
        adminUser = await User.create({
            name: 'Admin User',
            email: 'admin@example.com',
            password: 'password123',
            role: 'admin',
            isActive: true,
            isApproved: true
        });

        facultyUser = await User.create({
            name: 'Faculty User',
            email: 'faculty@example.com',
            password: 'password123',
            role: 'faculty',
            department: 'Computer Science',
            isActive: true,
            isApproved: true
        });

        studentUser = await User.create({
            name: 'Student User',
            email: 'student@example.com',
            password: 'password123',
            role: 'student',
            department: 'Computer Science',
            isActive: true,
            isApproved: true
        });

        // Generate tokens
        adminToken = testUtils.generateTestToken(adminUser._id, adminUser.role);
        facultyToken = testUtils.generateTestToken(facultyUser._id, facultyUser.role);
        studentToken = testUtils.generateTestToken(studentUser._id, studentUser.role);

        // Create test device
        testDevice = await Device.create({
            name: 'Test Classroom Device',
            macAddress: 'AA:BB:CC:DD:EE:FF',
            ipAddress: '192.168.1.100',
            classroom: 'Computer Science-101',
            location: 'Room 101',
            type: 'switch',
            status: 'online'
        });
    });

    describe('POST /api/device-permissions/grant', () => {
        test('should grant device permission for admin', async () => {
            const permissionData = {
                userId: studentUser._id.toString(),
                deviceId: testDevice._id.toString(),
                permissions: {
                    canTurnOn: true,
                    canTurnOff: true,
                    canViewStatus: true,
                    canSchedule: false,
                    canModifySettings: false
                },
                restrictions: {
                    maxUsesPerDay: 5,
                    maxBrightnessLevel: 60
                },
                reason: 'Test permission grant'
            };

            const response = await request(app)
                .post('/api/device-permissions/grant')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(permissionData)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('permissions');
            expect(response.body.data.permissions.canTurnOn).toBe(true);
        });

        test('should reject permission grant for non-admin', async () => {
            const permissionData = {
                userId: studentUser._id.toString(),
                deviceId: testDevice._id.toString(),
                permissions: {
                    canTurnOn: true,
                    canTurnOff: true
                }
            };

            const response = await request(app)
                .post('/api/device-permissions/grant')
                .set('Authorization', `Bearer ${facultyToken}`)
                .send(permissionData)
                .expect(403);

            expect(response.body).toHaveProperty('message');
        });

        test('should reject duplicate permission grant', async () => {
            // Create existing permission
            await DevicePermission.create({
                user: studentUser._id,
                device: testDevice._id,
                classroom: testDevice.classroom,
                permissions: { canTurnOn: true },
                grantedBy: adminUser._id,
                isActive: true
            });

            const permissionData = {
                userId: studentUser._id.toString(),
                deviceId: testDevice._id.toString(),
                permissions: { canTurnOn: true }
            };

            const response = await request(app)
                .post('/api/device-permissions/grant')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(permissionData)
                .expect(400);

            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toMatch(/already has permission/i);
        });
    });

    describe('GET /api/device-permissions/user/:userId', () => {
        beforeEach(async () => {
            // Create test permission
            await DevicePermission.create({
                user: studentUser._id,
                device: testDevice._id,
                classroom: testDevice.classroom,
                permissions: {
                    canTurnOn: true,
                    canTurnOff: true,
                    canViewStatus: true
                },
                restrictions: {
                    maxUsesPerDay: 5
                },
                grantedBy: adminUser._id,
                isActive: true
            });
        });

        test('should return user permissions for admin', async () => {
            const response = await request(app)
                .get(`/api/device-permissions/user/${studentUser._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThan(0);
        });

        test('should return user permissions for self', async () => {
            const response = await request(app)
                .get(`/api/device-permissions/user/${studentUser._id}`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
        });

        test('should reject access to other user permissions', async () => {
            const otherUserId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .get(`/api/device-permissions/user/${otherUserId}`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(403);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('PUT /api/device-permissions/:permissionId', () => {
        let testPermission;

        beforeEach(async () => {
            testPermission = await DevicePermission.create({
                user: studentUser._id,
                device: testDevice._id,
                classroom: testDevice.classroom,
                permissions: { canTurnOn: true },
                grantedBy: adminUser._id,
                isActive: true
            });
        });

        test('should update permission for admin', async () => {
            const updateData = {
                permissions: {
                    canTurnOn: true,
                    canTurnOff: true,
                    canSchedule: true
                },
                restrictions: {
                    maxUsesPerDay: 10
                }
            };

            const response = await request(app)
                .put(`/api/device-permissions/${testPermission._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data.permissions.canSchedule).toBe(true);
            expect(response.body.data.restrictions.maxUsesPerDay).toBe(10);
        });

        test('should reject update for non-granter', async () => {
            const updateData = {
                permissions: { canTurnOn: false }
            };

            const response = await request(app)
                .put(`/api/device-permissions/${testPermission._id}`)
                .set('Authorization', `Bearer ${facultyToken}`)
                .send(updateData)
                .expect(403);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('DELETE /api/device-permissions/:permissionId', () => {
        let testPermission;

        beforeEach(async () => {
            testPermission = await DevicePermission.create({
                user: studentUser._id,
                device: testDevice._id,
                classroom: testDevice.classroom,
                permissions: { canTurnOn: true },
                grantedBy: adminUser._id,
                isActive: true
            });
        });

        test('should revoke permission for admin', async () => {
            const response = await request(app)
                .delete(`/api/device-permissions/${testPermission._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');

            // Verify permission is revoked
            const revokedPermission = await DevicePermission.findById(testPermission._id);
            expect(revokedPermission.isActive).toBe(false);
        });

        test('should reject revoke for non-granter', async () => {
            const response = await request(app)
                .delete(`/api/device-permissions/${testPermission._id}`)
                .set('Authorization', `Bearer ${facultyToken}`)
                .expect(403);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('GET /api/device-permissions/summary', () => {
        beforeEach(async () => {
            // Create multiple permissions
            await DevicePermission.create([
                {
                    user: studentUser._id,
                    device: testDevice._id,
                    classroom: testDevice.classroom,
                    permissions: { canTurnOn: true },
                    grantedBy: adminUser._id,
                    isActive: true
                },
                {
                    user: facultyUser._id,
                    device: testDevice._id,
                    classroom: testDevice.classroom,
                    permissions: { canTurnOn: true, canModifySettings: true },
                    grantedBy: adminUser._id,
                    isActive: true
                }
            ]);
        });

        test('should return permission summary for admin', async () => {
            const response = await request(app)
                .get('/api/device-permissions/summary')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        test('should reject summary access for non-admin', async () => {
            const response = await request(app)
                .get('/api/device-permissions/summary')
                .set('Authorization', `Bearer ${facultyToken}`)
                .expect(403);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('POST /api/device-permissions/:permissionId/override', () => {
        let testPermission;

        beforeEach(async () => {
            testPermission = await DevicePermission.create({
                user: studentUser._id,
                device: testDevice._id,
                classroom: testDevice.classroom,
                permissions: { canTurnOn: false }, // Restricted permission
                grantedBy: adminUser._id,
                isActive: true
            });
        });

        test('should grant temporary override for admin', async () => {
            const overrideData = {
                durationMinutes: 60,
                reason: 'Exam preparation override'
            };

            const response = await request(app)
                .post(`/api/device-permissions/${testPermission._id}/override`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(overrideData)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('expiresAt');
        });

        test('should reject override for non-admin', async () => {
            const overrideData = {
                durationMinutes: 30,
                reason: 'Test override'
            };

            const response = await request(app)
                .post(`/api/device-permissions/${testPermission._id}/override`)
                .set('Authorization', `Bearer ${facultyToken}`)
                .send(overrideData)
                .expect(403);

            expect(response.body).toHaveProperty('message');
        });
    });
});