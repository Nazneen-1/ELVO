import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import { processTaskReminders, gracefulSchedulerShutdown } from './utils/reminderScheduler.js';

const startServer = async () => {
  // Connect to Database
  await connectDB();

  // Start HTTP Server
  const server = app.listen(config.port, () => {
    console.log(`🚀 ELVO Server running in ${config.nodeEnv} mode on port ${config.port}`);
  });

  // In development mode (or if explicitly enabled), run local in-process scheduler.
  // In production, the service relies on the authenticated external scheduler trigger (POST /api/reminders/process).
  const enableInProcessScheduler =
    process.env.ENABLE_IN_PROCESS_SCHEDULER === 'true' ||
    (config.nodeEnv === 'development' && process.env.ENABLE_IN_PROCESS_SCHEDULER !== 'false');

  let schedulerInterval = null;
  if (enableInProcessScheduler) {
    schedulerInterval = setInterval(processTaskReminders, 60 * 1000);
    console.log('⏰ Local in-process reminder scheduler started (checks every 60s)');
  } else {
    console.log('⏰ In-process scheduler disabled in production (relying on external trigger POST /api/reminders/process)');
  }

  // Graceful shutdown handling
  let isShuttingDown = false;
  const handleShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);

    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
    }

    // Drain in-flight reminder processing safely (up to 10s)
    const shutdownResult = await gracefulSchedulerShutdown({ timeoutMs: 10000 });
    if (!shutdownResult.completedCleanly) {
      console.warn(`⚠️ Shutdown timeout reached with ${shutdownResult.remainingActive} active jobs still processing.`);
    }

    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        const mongoose = (await import('mongoose')).default;
        if (mongoose.connection && mongoose.connection.readyState !== 0) {
          await mongoose.connection.close(false);
          console.log('MongoDB connection closed.');
        }
      } catch (err) {
        console.error('Error closing MongoDB connection:', err.message);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error(`💥 Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
};

startServer();
