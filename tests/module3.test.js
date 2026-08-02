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
    name: 'Budget Tester',
    email: `user${Date.now()}${Math.random()}@example.com`,
    password: 'Password123',
  });
  return res.body.data.accessToken;
};

const authed = (token) => (method, url) => request(app)[method](url).set('Authorization', `Bearer ${token}`);

describe('Expense Module', () => {
  it('creates, lists, filters, updates, and deletes an expense', async () => {
    const token = await registerAndLogin();
    const api = authed(token);

    const create = await api('post', '/api/expense').send({
      title: 'Groceries',
      amount: 1200,
      category: 'Food',
      date: '2026-07-01',
      tags: ['weekly', 'essentials'],
    });
    expect(create.status).toBe(201);
    const expenseId = create.body.data.expense._id;

    const list = await api('get', '/api/expense?category=Food');
    expect(list.status).toBe(200);
    expect(list.body.data.items.length).toBe(1);
    expect(list.body.data.totalAmount).toBe(1200);

    const update = await api('put', `/api/expense/${expenseId}`).send({ amount: 1500 });
    expect(update.status).toBe(200);
    expect(update.body.data.expense.amount).toBe(1500);

    const summary = await api('get', '/api/expense/summary');
    expect(summary.status).toBe(200);
    expect(summary.body.data.totalExpense).toBe(1500);

    const del = await api('delete', `/api/expense/${expenseId}`);
    expect(del.status).toBe(200);

    const listAfter = await api('get', '/api/expense');
    expect(listAfter.body.data.items.length).toBe(0);
  });

  it('rejects an invalid category', async () => {
    const token = await registerAndLogin();
    const res = await authed(token)('post', '/api/expense').send({
      title: 'Bad',
      amount: 100,
      category: 'NotACategory',
    });
    expect(res.status).toBe(400);
  });

  it('supports pagination', async () => {
    const token = await registerAndLogin();
    const api = authed(token);
    for (let i = 0; i < 5; i++) {
      await api('post', '/api/expense').send({ title: `Item ${i}`, amount: 10 + i, category: 'Other' });
    }
    const page1 = await api('get', '/api/expense?limit=2&page=1');
    expect(page1.body.data.items.length).toBe(2);
    expect(page1.body.data.meta.total).toBe(5);
    expect(page1.body.data.meta.totalPages).toBe(3);
  });
});

describe('Income Module', () => {
  it('creates and summarizes income', async () => {
    const token = await registerAndLogin();
    const api = authed(token);

    const create = await api('post', '/api/income').send({
      title: 'Monthly Salary',
      amount: 50000,
      category: 'Salary',
    });
    expect(create.status).toBe(201);

    const summary = await api('get', '/api/income/summary');
    expect(summary.body.data.totalIncome).toBe(50000);
  });
});

describe('Budget Module', () => {
  it('creates a budget and computes progress against real expenses', async () => {
    const token = await registerAndLogin();
    const api = authed(token);

    const create = await api('post', '/api/budget').send({
      month: '2026-07',
      totalBudget: 20000,
      categoryBudgets: [{ category: 'Food', limit: 5000 }],
    });
    expect(create.status).toBe(201);

    await api('post', '/api/expense').send({
      title: 'Dinner',
      amount: 4500,
      category: 'Food',
      date: '2026-07-10',
    });

    const progress = await api('get', '/api/budget/2026-07/progress');
    expect(progress.status).toBe(200);
    expect(progress.body.data.totalSpent).toBe(4500);
    expect(progress.body.data.categoryProgress[0].isNearLimit).toBe(true);
    expect(progress.body.data.categoryProgress[0].isOverBudget).toBe(false);
  });

  it('rejects a duplicate budget for the same month', async () => {
    const token = await registerAndLogin();
    const api = authed(token);
    await api('post', '/api/budget').send({ month: '2026-08', totalBudget: 1000 });
    const dupe = await api('post', '/api/budget').send({ month: '2026-08', totalBudget: 2000 });
    expect(dupe.status).toBe(409);
  });
});

describe('Goal Module', () => {
  it('creates a goal and tracks contributions/progress', async () => {
    const token = await registerAndLogin();
    const api = authed(token);

    const create = await api('post', '/api/goal').send({
      title: 'Emergency Fund',
      targetAmount: 10000,
      targetDate: '2027-01-01',
    });
    expect(create.status).toBe(201);
    const goalId = create.body.data.goal._id;

    const contribute = await api('patch', `/api/goal/${goalId}/contribute`).send({ amount: 3000 });
    expect(contribute.status).toBe(200);
    expect(contribute.body.data.goal.currentAmount).toBe(3000);
    expect(contribute.body.data.goal.progressPercentage).toBe(30);

    const complete = await api('patch', `/api/goal/${goalId}/contribute`).send({ amount: 8000 });
    expect(complete.body.data.goal.isCompleted).toBe(true);
  });
});

describe('Category Module', () => {
  it('lists seeded default categories', async () => {
    const { seedDefaultCategories } = require('../services/categoryService');
    await seedDefaultCategories();

    const token = await registerAndLogin();
    const res = await authed(token)('get', '/api/categories?type=expense');
    expect(res.status).toBe(200);
    expect(res.body.data.categories.some((c) => c.name === 'Food' && c.isDefault)).toBe(true);
  });

  it('creates a custom category and prevents deleting defaults', async () => {
    const { seedDefaultCategories } = require('../services/categoryService');
    await seedDefaultCategories();

    const token = await registerAndLogin();
    const api = authed(token);

    const create = await api('post', '/api/categories').send({ name: 'Pet Care', type: 'expense' });
    expect(create.status).toBe(201);

    const defaultCat = await api('get', '/api/categories?type=expense');
    const foodCat = defaultCat.body.data.categories.find((c) => c.name === 'Food');
    const del = await api('delete', `/api/categories/${foodCat._id}`);
    expect(del.status).toBe(403);
  });
});

describe('Notification Module', () => {
  it('creates, lists, and marks notifications as read', async () => {
    const token = await registerAndLogin();
    const api = authed(token);

    const registerRes = await request(app).post('/api/auth/register').send({
      name: 'Notif User',
      email: `notif${Date.now()}@example.com`,
      password: 'Password123',
    });
    const userToken = registerRes.body.data.accessToken;
    const userId = registerRes.body.data.user.id;

    const { createNotification } = require('../services/notificationService');
    await createNotification(userId, {
      type: 'budget_alert',
      title: 'Over budget',
      message: 'You have exceeded your Food budget',
    });

    const list = await authed(userToken)('get', '/api/notifications');
    expect(list.status).toBe(200);
    expect(list.body.data.unreadCount).toBe(1);

    const notifId = list.body.data.items[0]._id;
    const markRead = await authed(userToken)('patch', `/api/notifications/${notifId}/read`);
    expect(markRead.status).toBe(200);

    const listAfter = await authed(userToken)('get', '/api/notifications');
    expect(listAfter.body.data.unreadCount).toBe(0);
  });

  it('fetches default notification preferences and updates them', async () => {
    const token = await registerAndLogin();
    const api = authed(token);

    const initial = await api('get', '/api/notifications/preferences');
    expect(initial.status).toBe(200);
    expect(initial.body.data.preferences.budgetAlerts).toBe(true);
    expect(initial.body.data.preferences.emailNotifications).toBe(true);

    const updated = await api('put', '/api/notifications/preferences').send({
      budgetAlerts: false,
      emailNotifications: false,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.preferences.budgetAlerts).toBe(false);
    expect(updated.body.data.preferences.emailNotifications).toBe(false);
    // Untouched keys should keep their default value.
    expect(updated.body.data.preferences.goalReminders).toBe(true);

    const refetched = await api('get', '/api/notifications/preferences');
    expect(refetched.body.data.preferences.budgetAlerts).toBe(false);
  });

  it('rejects non-boolean notification preference values', async () => {
    const token = await registerAndLogin();
    const api = authed(token);

    const res = await api('put', '/api/notifications/preferences').send({
      budgetAlerts: 'yes',
    });
    expect(res.status).toBe(400);
  });
});
