const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../server');
const User = require('../models/User');
const Notice = require('../models/Notice');

describe('Notice Board API', () => {
  let adminToken;
  let userToken;
  let testNotice;

  beforeAll(async () => {
    // Wait for database connection
    if (mongoose.connection.readyState !== 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Create test users
    const admin = await User.create({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      isActive: true,
      isApproved: true
    });

    const user = await User.create({
      name: 'Test User',
      email: 'user@test.com',
      password: 'password123',
      role: 'student',
      isActive: true,
      isApproved: true
    });

    // Login to get tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });

    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'password123' });

    adminToken = adminLogin.body.token;
    userToken = userLogin.body.token;
  });

  afterAll(async () => {
    // Clean up
    await User.deleteMany({ email: { $in: ['admin@test.com', 'user@test.com'] } });
    await Notice.deleteMany({ title: 'Test Notice' });
  });

  describe('POST /api/notices/submit', () => {
    it('should submit notice for approval', async () => {
      const response = await request(app)
        .post('/api/notices/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .field('title', 'Test Notice')
        .field('content', 'This is a test notice content')
        .field('type', 'text')
        .field('priority', 'medium');

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Notice submitted for approval');
      expect(response.body.notice.title).toBe('Test Notice');
      expect(response.body.notice.status).toBe('pending');

      testNotice = response.body.notice;
    });

    it('should reject submission without authentication', async () => {
      const response = await request(app)
        .post('/api/notices/submit')
        .field('title', 'Test Notice')
        .field('content', 'This is a test notice content');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/notices/my-notices', () => {
    it('should return user notices', async () => {
      const response = await request(app)
        .get('/api/notices/my-notices')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/notices/pending', () => {
    it('should return pending notices for admin', async () => {
      const response = await request(app)
        .get('/api/notices/pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject access for non-admin', async () => {
      const response = await request(app)
        .get('/api/notices/pending')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/notices/:id/approve', () => {
    it('should approve notice for admin', async () => {
      const response = await request(app)
        .put(`/api/notices/${testNotice._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Notice approved');
      expect(response.body.notice.status).toBe('approved');
    });

    it('should reject approval for non-admin', async () => {
      const response = await request(app)
        .put(`/api/notices/${testNotice._id}/approve`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });
});