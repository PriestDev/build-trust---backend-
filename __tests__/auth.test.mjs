import { jest } from '@jest/globals';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../src/server.js';
import pool from '../src/config/database.js';

describe('Auth, Profile and Document Flows (ESM)', () => {
  jest.setTimeout(20000);
  let testEmail;
  const password = 'Abc!2345';
  let userId;
  let token;

  beforeAll(async () => {
    testEmail = `test+${Date.now()}@example.com`;
  });

  afterAll(async () => {
    try {
      // Remove any documents and users created during tests
      await pool.query('DELETE FROM user_documents WHERE user_id IN (SELECT id FROM users WHERE email = ?)', [testEmail]);
      await pool.query('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = ?)', [testEmail]);
      await pool.query('DELETE FROM users WHERE email = ?', [testEmail]);

      // Give background tasks (audit/logs) a short moment to finish before closing the pool
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (err) {
      console.error('Cleanup error', err);
    } finally {
      await pool.end();
    }
  });

  test('signup with developer intent creates developer role', async () => {
    const res = await request(app)
      .post('/api/auth/signup?intent=developer-setup')
      .send({ email: testEmail, password });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBe('developer');
    expect(res.body.token).toBeDefined();

    userId = res.body.user.id;
    token = res.body.token;
  });

  test('updateProfile rejects invalid years_experience', async () => {
    const res = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ years_experience: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  test('uploadDocument without type returns 400 and does not leave file in uploads', async () => {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const before = fs.readdirSync(uploadsDir);

    const res = await request(app)
      .post(`/api/users/${userId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', path.join(new URL(import.meta.url).pathname, '../__tests__/fixtures/sample.png'));

    expect(res.status).toBe(400);

    const after = fs.readdirSync(uploadsDir);
    expect(after).toEqual(before);
  });
});