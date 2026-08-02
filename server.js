require('dotenv').config();
console.log("CLIENT_URL =", process.env.CLIENT_URL);
console.log("Current directory:", process.cwd());
console.log("MONGO_URI =", process.env.MONGO_URI);
const app = require('./app');
const connectDB = require('./config/db');
const { seedDefaultCategories } = require('./services/categoryService');

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  await seedDefaultCategories();

  const server = app.listen(PORT, () => {
    console.log(`[Server] Expense AI API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log('[Server] Closed remaining connections.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (err) => {
    console.error('[Server] Unhandled Rejection:', err);
    server.close(() => process.exit(1));
  });
};

start();
