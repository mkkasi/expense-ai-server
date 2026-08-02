const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const aiService = require('../services/aiService');
const Expense = require('../models/Expense');
const uploadBufferToCloudinary = require('../utils/uploadBufferToCloudinary');

// POST /api/ai/categorize  { title, description }
const categorize = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  if (!title) throw ApiError.badRequest('title is required');
  const result = await aiService.categorizeExpense({ title, description });
  new ApiResponse(200, 'Category predicted', result).send(res);
});

// POST /api/ai/receipt  (multipart: image) -> extracts data AND creates the expense
const scanReceipt = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('A receipt image file is required (field name: "image")');

  const base64Image = req.file.buffer.toString('base64');
  const extracted = await aiService.analyzeReceipt({ base64Image, mimeType: req.file.mimetype });

  // Upload the receipt image itself to Cloudinary so it's attached to the expense.
  const { url: receiptUrl, publicId } = await uploadBufferToCloudinary(req.file.buffer, 'expense-ai/receipts');

  const autoCreate = req.body.autoCreate === 'true' || req.body.autoCreate === true;
  let expense = null;

  if (autoCreate && extracted.amount) {
    expense = await Expense.create({
      user: req.user._id,
      title: extracted.storeName || 'Receipt Purchase',
      amount: extracted.amount,
      category: extracted.suggestedCategory,
      date: extracted.date ? new Date(extracted.date) : new Date(),
      description: extracted.items?.map((i) => i.name).join(', ') || '',
      receiptImage: { url: receiptUrl, publicId },
      isAiGenerated: true,
    });
  }

  new ApiResponse(200, 'Receipt processed', { extracted, receiptUrl, expense }).send(res);
});

// POST /api/ai/suggestions  -> saving suggestions
const suggestions = asyncHandler(async (req, res) => {
  const result = await aiService.getSavingSuggestions(req.user._id);
  new ApiResponse(200, 'Saving suggestions generated', result).send(res);
});

// GET /api/ai/analysis -> spending analysis
const analysis = asyncHandler(async (req, res) => {
  const result = await aiService.getSpendingAnalysis(req.user._id);
  new ApiResponse(200, 'Spending analysis generated', result).send(res);
});

// GET /api/ai/budget-recommendation
const budgetRecommendation = asyncHandler(async (req, res) => {
  const result = await aiService.getBudgetRecommendation(req.user._id);
  new ApiResponse(200, 'Budget recommendation generated', result).send(res);
});

// POST /api/ai/predict
const predict = asyncHandler(async (req, res) => {
  const result = await aiService.predictNextMonthExpense(req.user._id);
  new ApiResponse(200, 'Next month expense predicted', result).send(res);
});

// GET /api/ai/anomalies
const anomalies = asyncHandler(async (req, res) => {
  const result = await aiService.detectAnomalies(req.user._id);
  new ApiResponse(200, 'Anomaly detection complete', result).send(res);
});

// POST /api/ai/chat  { message }
const chat = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) throw ApiError.badRequest('message is required');
  const result = await aiService.chatWithAssistant(req.user._id, message.trim());
  new ApiResponse(200, 'Assistant replied', result).send(res);
});

// GET /api/ai/chat/history
const chatHistory = asyncHandler(async (req, res) => {
  const messages = await aiService.getChatHistory(req.user._id);
  new ApiResponse(200, 'Chat history fetched', { messages }).send(res);
});

// DELETE /api/ai/chat/history
const clearChat = asyncHandler(async (req, res) => {
  await aiService.clearChatHistory(req.user._id);
  new ApiResponse(200, 'Chat history cleared').send(res);
});

module.exports = {
  categorize,
  scanReceipt,
  suggestions,
  analysis,
  budgetRecommendation,
  predict,
  anomalies,
  chat,
  chatHistory,
  clearChat,
};
