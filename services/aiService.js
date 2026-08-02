const Expense = require('../models/Expense');
const Income = require('../models/Income');
const AIChat = require('../models/AIChat');
const ApiError = require('../utils/ApiError');
const parseJsonSafely = require('../utils/parseJsonSafely');
const { generateCompletion, generateVisionCompletion } = require('../config/aiProvider');
const { EXPENSE_CATEGORIES } = require('../config/constants');
const analyticsService = require('./analyticsService');
const dashboardService = require('./dashboardService');

const MAX_CHAT_HISTORY = 20;

// ---------- 1. AI Expense Categorization ----------

/**
 * Simple keyword-based fallback so categorization still works (roughly)
 * with zero AI cost/latency, and so the feature degrades gracefully if
 * no AI provider key is configured.
 */
const keywordCategorize = (title = '', description = '') => {
  const text = `${title} ${description}`.toLowerCase();
  const rules = [
    { category: 'Food', words: ['restaurant', 'cafe', 'food', 'grocery', 'zomato', 'swiggy', 'pizza', 'lunch', 'dinner'] },
    { category: 'Travel', words: ['flight', 'uber', 'ola', 'taxi', 'train', 'bus', 'hotel', 'trip'] },
    { category: 'Shopping', words: ['amazon', 'flipkart', 'mall', 'clothes', 'shoes', 'shopping'] },
    { category: 'Medical', words: ['pharmacy', 'hospital', 'doctor', 'medicine', 'clinic'] },
    { category: 'Bills', words: ['electricity', 'water bill', 'internet', 'rent', 'wifi', 'gas bill'] },
    { category: 'Fuel', words: ['petrol', 'diesel', 'fuel', 'gas station'] },
    { category: 'Entertainment', words: ['movie', 'netflix', 'spotify', 'concert', 'game'] },
    { category: 'Investment', words: ['mutual fund', 'stock', 'sip', 'investment', 'crypto'] },
    { category: 'Education', words: ['course', 'tuition', 'school', 'college', 'book'] },
    { category: 'EMI', words: ['emi', 'loan installment'] },
    { category: 'Business', words: ['invoice', 'client', 'office supplies'] },
  ];

  for (const rule of rules) {
    if (rule.words.some((w) => text.includes(w))) return rule.category;
  }
  return 'Other';
};

const categorizeExpense = async ({ title, description }) => {
  try {
    const raw = await generateCompletion(
      [
        {
          role: 'system',
          content: `You are an expense categorization engine. Reply with ONLY a JSON object: {"category": "<one of: ${EXPENSE_CATEGORIES.join(', ')}>", "confidence": <0-1 number>}. No other text.`,
        },
        { role: 'user', content: `Title: ${title}\nDescription: ${description || 'N/A'}` },
      ],
      { temperature: 0.1 }
    );
    const parsed = parseJsonSafely(raw);
    if (parsed?.category && EXPENSE_CATEGORIES.includes(parsed.category)) {
      return { category: parsed.category, confidence: parsed.confidence ?? 0.8, source: 'ai' };
    }
  } catch (err) {
    // AI unavailable/misconfigured - fall through to keyword heuristic.
  }
  return { category: keywordCategorize(title, description), confidence: 0.5, source: 'keyword-fallback' };
};

// ---------- 2. Receipt Scanner (OCR) ----------

const analyzeReceipt = async ({ base64Image, mimeType }) => {
  if (!base64Image) throw ApiError.badRequest('A receipt image is required');

  const prompt = `Extract structured data from this receipt image. Reply with ONLY a JSON object in this exact shape:
{
  "storeName": "string or null",
  "amount": number or null,
  "gst": number or null,
  "date": "YYYY-MM-DD or null",
  "items": [{"name": "string", "price": number}],
  "suggestedCategory": "one of: ${EXPENSE_CATEGORIES.join(', ')}"
}
No prose, no markdown fences - just the JSON object.`;

  let raw;
  try {
    raw = await generateVisionCompletion(base64Image, mimeType, prompt);
  } catch (err) {
    throw ApiError.badRequest(`Receipt scanning failed: ${err.message}`);
  }

  const parsed = parseJsonSafely(raw);
  if (!parsed) throw ApiError.internal('Could not parse receipt data from the AI response');

  return {
    storeName: parsed.storeName || null,
    amount: typeof parsed.amount === 'number' ? parsed.amount : null,
    gst: typeof parsed.gst === 'number' ? parsed.gst : null,
    date: parsed.date || null,
    items: Array.isArray(parsed.items) ? parsed.items : [],
    suggestedCategory: EXPENSE_CATEGORIES.includes(parsed.suggestedCategory) ? parsed.suggestedCategory : 'Other',
  };
};

// ---------- 3. AI Spending Analysis ----------

const getSpendingAnalysis = async (userId) => {
  const [monthly, categoryDist, highestExpense, lowestExpense] = await Promise.all([
    analyticsService.getMonthlySpending(userId, 6),
    analyticsService.getCategoryDistribution(userId),
    Expense.findOne({ user: userId }).sort('-amount').lean(),
    Expense.findOne({ user: userId }).sort('amount').lean(),
  ]);

  const topCategories = categoryDist.slice(0, 5);

  // "Unnecessary spending" heuristic: discretionary categories whose share
  // of total spend exceeds 20% - a simple, explainable rule rather than a
  // black-box judgment call.
  const discretionary = ['Entertainment', 'Shopping', 'Food'];
  const unnecessarySpending = categoryDist.filter((c) => discretionary.includes(c.category) && c.percentage > 20);

  const weeklyTrend = await analyticsService.getWeeklySpending(userId, 4);

  return {
    topCategories,
    unnecessarySpending,
    monthlyTrend: monthly,
    weeklyTrend,
    highestExpense: highestExpense || null,
    lowestExpense: lowestExpense || null,
  };
};

// ---------- 4. AI Budget Recommendation ----------

const getBudgetRecommendation = async (userId) => {
  const monthly = await analyticsService.getMonthlySpending(userId, 3);
  const categoryDist = await analyticsService.getCategoryDistribution(userId);

  if (monthly.length === 0) {
    return {
      recommendedTotal: 0,
      recommendedByCategory: [],
      note: 'Not enough transaction history yet to generate a recommendation. Add a few expenses first.',
    };
  }

  const avgMonthlyExpense = monthly.reduce((sum, m) => sum + m.expense, 0) / monthly.length;
  // Recommend last-3-months average + a 10% buffer.
  const recommendedTotal = Math.round(avgMonthlyExpense * 1.1);

  const recommendedByCategory = categoryDist.map((c) => ({
    category: c.category,
    recommendedLimit: Math.round((c.percentage / 100) * recommendedTotal),
  }));

  return { recommendedTotal, recommendedByCategory, basedOnMonths: monthly.length };
};

// ---------- 5. AI Saving Suggestions ----------

const getSavingSuggestions = async (userId) => {
  const categoryDist = await analyticsService.getCategoryDistribution(userId, dashboardService.currentMonthKey());
  const discretionary = categoryDist.filter((c) => ['Food', 'Entertainment', 'Shopping'].includes(c.category) && c.total > 0);

  const suggestions = discretionary.map((c) => {
    const reducePercent = 15;
    const potentialSaving = Math.round(c.total * (reducePercent / 100));
    return {
      category: c.category,
      currentSpend: c.total,
      message: `You spent ₹${c.total} on ${c.category} this month. Reducing by ${reducePercent}% can save ₹${potentialSaving}.`,
      potentialSaving,
    };
  });

  return { suggestions: suggestions.sort((a, b) => b.potentialSaving - a.potentialSaving) };
};

// ---------- 7. Expense Prediction ----------

const predictNextMonthExpense = async (userId) => {
  const monthly = await analyticsService.getMonthlySpending(userId, 6);
  if (monthly.length < 2) {
    return { predictedAmount: monthly[0]?.expense || 0, confidence: 'low', basedOnMonths: monthly.length };
  }

  // Simple weighted moving average - recent months count more.
  const weights = monthly.map((_, i) => i + 1);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const predictedAmount = Math.round(
    monthly.reduce((sum, m, i) => sum + m.expense * weights[i], 0) / weightSum
  );

  return {
    predictedAmount,
    confidence: monthly.length >= 4 ? 'medium' : 'low',
    basedOnMonths: monthly.length,
    history: monthly,
  };
};

// ---------- 8. Anomaly Detection ----------

const detectAnomalies = async (userId) => {
  const expenses = await Expense.find({ user: userId }).lean();
  if (expenses.length < 5) return { anomalies: [] };

  const byCategory = {};
  expenses.forEach((e) => {
    byCategory[e.category] = byCategory[e.category] || [];
    byCategory[e.category].push(e);
  });

  const anomalies = [];
  Object.entries(byCategory).forEach(([category, items]) => {
    if (items.length < 3) return; // not enough data to judge "unusual" for this category
    const amounts = items.map((i) => i.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, a) => sum + (a - mean) ** 2, 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    items.forEach((item) => {
      if (stdDev > 0 && item.amount > mean + 2 * stdDev) {
        anomalies.push({
          expenseId: item._id,
          title: item.title,
          amount: item.amount,
          category,
          categoryAverage: Math.round(mean),
          date: item.date,
          reason: `This ${category} expense is significantly higher than your usual ₹${Math.round(mean)} average for this category.`,
        });
      }
    });
  });

  const flaggedIds = anomalies.map((a) => a.expenseId);
  if (flaggedIds.length > 0) {
    await Expense.updateMany({ _id: { $in: flaggedIds } }, { $set: { isAnomaly: true } });
  }

  return { anomalies: anomalies.sort((a, b) => new Date(b.date) - new Date(a.date)) };
};

// ---------- 6. AI Chat Assistant ----------

const buildFinancialContext = async (userId) => {
  const [summary, spending] = await Promise.all([
    dashboardService.getDashboardSummary(userId),
    getSpendingAnalysis(userId),
  ]);
  return `Current month (${summary.month}): income ₹${summary.income}, expense ₹${summary.expense}, savings ₹${summary.savings}, financial health score ${summary.financialHealthScore}/100.
Top spending categories: ${spending.topCategories.map((c) => `${c.category} (₹${c.total})`).join(', ') || 'none yet'}.
Highest single expense: ${spending.highestExpense ? `${spending.highestExpense.title} - ₹${spending.highestExpense.amount}` : 'none'}.`;
};

const chatWithAssistant = async (userId, userMessage) => {
  let chat = await AIChat.findOne({ user: userId });
  if (!chat) chat = new AIChat({ user: userId, messages: [] });

  const context = await buildFinancialContext(userId);

  const systemPrompt = `You are the AI Financial Assistant inside the "Expense AI" app. Answer questions about the user's spending, income, budget, and savings using the financial context below. Be concise, specific, and use ₹ for currency. If the context doesn't contain enough information to answer precisely, say so rather than guessing.

FINANCIAL CONTEXT:
${context}`;

  const history = chat.messages.slice(-MAX_CHAT_HISTORY).map((m) => ({ role: m.role, content: m.content }));

  let reply;
  try {
    reply = await generateCompletion([
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ]);
  } catch (err) {
    throw ApiError.badRequest(`AI assistant is currently unavailable: ${err.message}`);
  }

  chat.messages.push({ role: 'user', content: userMessage });
  chat.messages.push({ role: 'assistant', content: reply });
  chat.messages = chat.messages.slice(-MAX_CHAT_HISTORY);
  await chat.save();

  return { reply, history: chat.messages };
};

const getChatHistory = async (userId) => {
  const chat = await AIChat.findOne({ user: userId }).lean();
  return chat?.messages || [];
};

const clearChatHistory = async (userId) => {
  await AIChat.findOneAndUpdate({ user: userId }, { $set: { messages: [] } });
};

module.exports = {
  categorizeExpense,
  analyzeReceipt,
  getSpendingAnalysis,
  getBudgetRecommendation,
  getSavingSuggestions,
  predictNextMonthExpense,
  detectAnomalies,
  chatWithAssistant,
  getChatHistory,
  clearChatHistory,
};
