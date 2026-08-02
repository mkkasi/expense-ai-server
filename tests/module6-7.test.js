process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

require('./setup');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');

const registerAndLogin = async (overrides = {}) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Export Tester',
      email: `user${Date.now()}${Math.random()}@example.com`,
      password: 'Password123',
      ...overrides,
    });
  return { token: res.body.data.accessToken, user: res.body.data.user };
};

const authed = (token) => (method, url) => request(app)[method](url).set('Authorization', `Bearer ${token}`);

describe('Export Module', () => {
  it('exports transactions as CSV with correct headers', async () => {
    const { token } = await registerAndLogin();
    const api = authed(token);
    await api('post', '/api/expense').send({ title: 'Coffee', amount: 150, category: 'Food', date: '2026-07-05' });
    await api('post', '/api/income').send({ title: 'Salary', amount: 50000, category: 'Salary', date: '2026-07-01' });

    const res = await api('get', '/api/export/transactions?format=csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('Date,Type,Title,Category,Amount');
    expect(res.text).toContain('Coffee');
    expect(res.text).toContain('Salary');
  });

  it('exports transactions as Excel with correct content-type', async () => {
    const { token } = await registerAndLogin();
    const api = authed(token);
    await api('post', '/api/expense').send({ title: 'Fuel', amount: 2000, category: 'Fuel' });

    const res = await api('get', '/api/export/transactions?format=excel');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });

  it('exports transactions as PDF with correct content-type', async () => {
    const { token } = await registerAndLogin();
    const api = authed(token);
    await api('post', '/api/expense').send({ title: 'Movie', amount: 500, category: 'Entertainment' });

    const res = await api('get', '/api/export/transactions?format=pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });

  it('rejects an invalid export format', async () => {
    const { token } = await registerAndLogin();
    const res = await authed(token)('get', '/api/export/transactions?format=word');
    expect(res.status).toBe(400);
  });

  it('filters export by type=expense only', async () => {
    const { token } = await registerAndLogin();
    const api = authed(token);
    await api('post', '/api/expense').send({ title: 'Snacks', amount: 100, category: 'Food' });
    await api('post', '/api/income').send({ title: 'Bonus', amount: 5000, category: 'Business' });

    const res = await api('get', '/api/export/transactions?format=csv&type=expense');
    expect(res.text).toContain('Snacks');
    expect(res.text).not.toContain('Bonus');
  });
});

describe('Admin Module', () => {
  it('rejects a regular user from accessing the admin dashboard', async () => {
    const { token } = await registerAndLogin();
    const res = await authed(token)('get', '/api/admin/dashboard');
    expect(res.status).toBe(403);
  });

  it('allows an admin to view the dashboard and manage users', async () => {
    const { token, user } = await registerAndLogin();
    await User.findByIdAndUpdate(user.id, { role: 'admin' });

    // Re-login to get a fresh token reflecting admin role isn't necessary since
    // `protect` re-fetches the user from the DB on every request.
    const api = authed(token);

    const dashboard = await api('get', '/api/admin/dashboard');
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.totalUsers).toBeGreaterThanOrEqual(1);

    const users = await api('get', '/api/admin/users');
    expect(users.status).toBe(200);
    expect(users.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('allows an admin to deactivate a user', async () => {
    const { token, user } = await registerAndLogin();
    await User.findByIdAndUpdate(user.id, { role: 'admin' });
    const api = authed(token);

    const { user: otherUser } = await registerAndLogin();
    const update = await api('put', `/api/admin/users/${otherUser.id}`).send({ isActive: false });
    expect(update.status).toBe(200);
    expect(update.body.data.user.isActive).toBe(false);
  });

  it('allows an admin to create and delete a default category', async () => {
    const { token, user } = await registerAndLogin();
    await User.findByIdAndUpdate(user.id, { role: 'admin' });
    const api = authed(token);

    const create = await api('post', '/api/admin/categories').send({ name: 'Subscriptions', type: 'expense' });
    expect(create.status).toBe(201);
    expect(create.body.data.category.isDefault).toBe(true);

    const del = await api('delete', `/api/admin/categories/${create.body.data.category._id}`);
    expect(del.status).toBe(200);
  });

  it('logs an error to SystemLog and surfaces it via admin logs endpoint', async () => {
    const { token, user } = await registerAndLogin();
    await User.findByIdAndUpdate(user.id, { role: 'admin' });
    const api = authed(token);

    // Trigger a 404 (not a 5xx) - shouldn't create a log; then trigger a genuine
    // validation-independent server-side failure path via a bad ObjectId cast (400).
    // To reliably produce a persisted log we call the logger directly instead,
    // matching how the app itself would in a real 5xx scenario.
    const { logEvent } = require('../utils/systemLogger');
    logEvent('error', 'Simulated failure for test visibility', { meta: { path: '/api/test' } });
    await new Promise((r) => setTimeout(r, 50)); // let the fire-and-forget write land

    const logs = await api('get', '/api/admin/logs?level=error');
    expect(logs.status).toBe(200);
    expect(logs.body.data.items.some((l) => l.message === 'Simulated failure for test visibility')).toBe(true);
  });
});
