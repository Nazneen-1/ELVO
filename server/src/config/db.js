import mongoose from 'mongoose';
import { config } from './env.js';

export const connectDB = async () => {
  const uri = config.MONGODB_URI || config.mongodbUri || process.env.MONGODB_URI;

  if (!uri) {
    console.warn('⚠️  MONGODB_URI is not defined in environment variables. Database not connected.');
    return;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // In production, failure to connect should exit process
    if (config.nodeEnv === 'production') {
      process.exit(1);
    }
  }
};
