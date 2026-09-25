import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import { processTaskReminders } from './utils/reminderScheduler.js';

const startServer = async () => {
  // Connect to Database
  await connectDB();

  // Start HTTP Server
  const server = app.listen(config.port, () => {
    console.log(`🚀 ELVO Server running in ${config.nodeEnv} mode on port ${config.port}`);
  });

  // Start task reminder scheduler (runs every 60 seconds)
  setInterval(processTaskReminders, 60 * 1000);
  console.log('⏰ Task reminder scheduler started (checks every 60s)');

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error(`💥 Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
};

startServer();
