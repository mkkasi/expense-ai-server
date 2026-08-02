process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

require('./setup');
const request = require('supertest');
const app = require('../app');

const registerAndLogin = async () => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Analytics Tester',
    email: `user${Date.now()}${Math.random()}@example.com`,
    password: 'Password123',
  });
  return res.body.data.accessToken;
};

const authed = (token) => (method, url) => request(app)[method](url).set('Authorization', `Bearer ${token}`);

const seedTransactions = async (api) => {
  await api('post', '/api/income').send({ title: 'Salary', amount: 60000, category: 'Salary', date: '2026-07-01' });
  await api('post', '/api/expense').send({ title: 'Rent', amount: 15000, category: 'Bills', date: '2026-07-02' });
  await api('post', '/api/expense').send({ title: 'Groceries', amount: 5000, category: 'Food', date: '2026-07-05' });
  await api('post', '/api/budget').send({ month: '2026-07', totalBudget: 30000 });
};

describe('Dashboard Module', () => {
  it('computes balance, income, expense, savings, and budget remaining', async () => {
    const token = await registerAndLogin();
    const api = authed(token);
    await seedTransactions(api);

    const res = await api('get', '/api/dashboard?month=2026-07');
    expect(res.status).toBe(200);
    expect(res.body.data.income).toBe(60000);
    expect(res.body.data.expense).toBe(20000);
    expect(res.body.data.savings).toBe(40000);
    expect(res.body.data.monthlyBudget).toBe(30000);
    expect(res.body.data.budgetRemaining).toBe(10000);
    expect(res.body.data.recentTransactions.length).toBeGreaterThan(0);
    expect(res.body.data.financialHealthScore).toBeGreaterThanOrEqual(0);
    expect(res.body.data.financialHealthScore).toBeLessThanOrEqual(100);
  });
});

describe('Analytics Module', () => {
  it('returns category distribution with correct percentages', async () => {
    const token = await registerAndLogin();
    const api = authed(token);
    await seedTransactions(api);

    const res = await api('get', '/api/analytics/category-distribution?month=2026-07');
    expect(res.status).toBe(200);
    const bills = res.body.data.data.find((c) => c.category === 'Bills');
    const food = res.body.data.data.find((c) => c.category === 'Food');
    expect(bills.total).toBe(15000);
    expect(food.total).toBe(5000);
    expect(bills.percentage).toBe(75);
    expect(food.percentage).toBe(25);
  });

  it('returns monthly spending and cash flow with net computed', async () => {
    const token = await registerAndLogin();
    const api = authed(token);
    await seedTransactions(api);

    const cashFlow = await api('get', '/api/analytics/cash-flow?months=6');
    expect(cashFlow.status).toBe(200);
    const julyEntry = cashFlow.body.data.data.find((m) => m.month === '2026-07');
    expect(julyEntry.income).toBe(60000);
    expect(julyEntry.expense).toBe(20000);
    expect(julyEntry.net).toBe(40000);
  });
});

describe('Reports Module', () => {
  it('generates a monthly report with top categories and extremes', async () => {
    const token = await registerAndLogin();
    const api = authed(token);
    await seedTransactions(api);

    const res = await api('get', '/api/reports/monthly?month=2026-07');
    expect(res.status).toBe(200);
    expect(res.body.data.totalIncome).toBe(60000);
    expect(res.body.data.totalExpense).toBe(20000);
    expect(res.body.data.netSavings).toBe(40000);
    expect(res.body.data.highestExpense.title).toBe('Rent');
    expect(res.body.data.lowestExpense.title).toBe('Groceries');
  });

  it('rejects a malformed month parameter', async () => {
    const token = await registerAndLogin();
    const res = await authed(token)('get', '/api/reports/monthly?month=2026-13');
    expect(res.status).toBe(400);
  });

  it('generates a yearly report with monthly breakdown', async () => {
    const token = await registerAndLogin();
    const api = authed(token);
    await seedTransactions(api);

    const res = await api('get', '/api/reports/yearly?year=2026');
    expect(res.status).toBe(200);
    expect(res.body.data.totalIncome).toBe(60000);
    const july = res.body.data.monthlyBreakdown.find((m) => m.month === '2026-07');
    expect(july.expense).toBe(20000);
  });
});
