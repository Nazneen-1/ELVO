import mongoose from 'mongoose';
import { config } from './env.js';

export const connectDB = async () => {
  const uri = config.MONGODB_URI || config.mongodbUri || process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in .env file!');
    return;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB Connected Successfully: ${conn.connection.host} (DB: ${conn.connection.name})`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    if (config.nodeEnv === 'production') {
      process.exit(1);
    }
  }
};
