process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';
// Intentionally no OPENAI_API_KEY / GEMINI_API_KEY set here, so AI-provider
// calls fail fast and we can verify the app degrades gracefully (keyword
// fallback for categorization; a clean 400 for features with no fallback).

require('./setup');
const request = require('supertest');
const app = require('../app');

const registerAndLogin = async () => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'AI Tester',
    email: `ai${Date.now()}${Math.random()}@example.com`,
    password: 'Password123',
  });
  return res.body.data.accessToken;
};

const authed = (token) => (method, url) => request(app)[method](url).set('Authorization', `Bearer ${token}`);

describe('AI Module - categorization (keyword fallback, no AI key configured)', () => {
  it('falls back to keyword categorization when no AI provider is configured', async () => {
    const token = await registerAndLogin();
    const res = await authed(token)('post', '/api/ai/categorize').send({
      title: 'Swiggy order',
      description: 'dinner delivery',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.category).toBe('Food');
    expect(res.body.data.source).toBe('keyword-fallback');
  });

  it('defaults to Other for unrecognized text', async () => {
    const token = await registerAndLogin();
    const res = await authed(token)('post', '/api/ai/categorize').send({ title: 'xyz123 abstract thing' });
    expect(res.status).toBe(200);
    expect(res.body.data.category).toBe('Other');
  });

  it('rejects a categorize request without a title', async () => {
    const token = await registerAndLogin();
    const res = await authed(token)('post', '/api/ai/categorize').send({ description: 'no title here' });
    expect(res.status).toBe(400);
  });
});

describe('AI Module - spending analysis, suggestions, recommendation, prediction (statistical, no AI call)', () => {
  const seed = async (api) => {
    await api('post', '/api/expense').send({ title: 'Dinner out', amount: 3000, category: 'Food', date: '2026-06-10' });
    await api('post', '/api/expense').send({ title: 'Groceries', amount: 2000, category: 'Food', date: '2026-06-15' });
    await api('post', '/api/expense').send({ title: 'Movie', amount: 1000, category: 'Entertainment', date: '2026-07-01' });
    await api('post', '/api/expense').send({ title: 'Rent', amount: 15000, category: 'Bills', date: '2026-07-02' });
  };

  it('generates a spending analysis with top categories and extremes', async () => {
    const token = await registerAndLogin();
    const api = authed(token);
    await seed(api);

    const res = await api('get', '/api/ai/analysis');
    expect(res.status).toBe(200);
    expect(res.body.data.topCategories.length).toBeGreaterThan(0);
    expect(res.body.data.highestExpense.title).toBe('Rent');
    expect(res.body.data.lowestExpense.title).toBe('Movie');
  });

  it('generates saving suggestions for discretionary categories with the standard 15% framing', async () => {
    const token = await registerAndLogin();
    const api = authed(token);
    await api('post', '/api/expense').send({ title: 'Takeout', amount: 4000, category: 'Food', date: `${new Date().toISOString().slice(0, 7)}-05` });

    const res = await api('get', '/api/ai/budget-recommendation');
    expect(res.status).toBe(200);

    const suggestions = await api('post', '/api/ai/suggestions');
    expect(suggestions.status).toBe(200);
    expect(Array.isArray(suggestions.body.data.suggestions)).toBe(true);
    if (suggestions.body.data.suggestions.length > 0) {
      expect(suggestions.body.data.suggestions[0].message).toMatch(/Reducing by 15%/);
    }
  });

  it('predicts next month expense using a weighted moving average', async () => {
    const token = await registerAndLogin();
    const api = authed(token);
    await seed(api);

    const res = await api('post', '/api/ai/predict');
    expect(res.status).toBe(200);
    expect(res.body.data.predictedAmount).toBeGreaterThanOrEqual(0);
  });

  it('detects a statistical anomaly within a category', async () => {
    const token = await registerAndLogin();
    const api = authed(token);
    // Establish a normal baseline for Food, then one huge outlier.
    await api('post', '/api/expense').send({ title: 'Lunch 1', amount: 200, category: 'Food', date: '2026-05-01' });
    await api('post', '/api/expense').send({ title: 'Lunch 2', amount: 220, category: 'Food', date: '2026-05-02' });
    await api('post', '/api/expense').send({ title: 'Lunch 3', amount: 210, category: 'Food', date: '2026-05-03' });
    await api('post', '/api/expense').send({ title: 'Huge outlier dinner', amount: 9000, category: 'Food', date: '2026-05-04' });

    const res = await api('get', '/api/ai/anomalies');
    expect(res.status).toBe(200);
    expect(res.body.data.anomalies.some((a) => a.title === 'Huge outlier dinner')).toBe(true);
  });
});

describe('AI Module - chat assistant (fails gracefully without a configured provider)', () => {
  it('returns a clean 400 rather than a crash when no AI key is configured', async () => {
    const token = await registerAndLogin();
    const res = await authed(token)('post', '/api/ai/chat').send({ message: 'Where did I spend the most?' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects an empty chat message', async () => {
    const token = await registerAndLogin();
    const res = await authed(token)('post', '/api/ai/chat').send({ message: '   ' });
    expect(res.status).toBe(400);
  });
});
