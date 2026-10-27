import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { ensureReminderJobIndexes } from '../utils/reminderScheduler.js';

/**
 * Dedicated, explicit migration script to backfill legacy ReminderJob documents,
 * verify occurrence identities, ensure the new unique compound index,
 * and safely drop the obsolete index only after verification succeeds.
 *
 * Usage:
 *   npm run migrate:reminder-indexes (from server/ directory)
 *   or node src/scripts/migrateReminderIndexes.js
 */
async function runMigration() {
  console.log('🔄 [Migration] Starting ReminderJob queue identity index migration...');
  try {
    await connectDB();

    const result = await ensureReminderJobIndexes({ log: true });

    if (!result.success) {
      console.error('\n❌ [Migration] Migration failed:');
      if (result.reason === 'ambiguous_records_found') {
        console.error(`   Found ${result.ambiguousCount} ambiguous legacy jobs that cannot be mapped deterministically.`);
        console.error('   Action: Inspect and resolve ambiguous task records before re-running migration.');
      } else if (result.reason === 'duplicates_found') {
        console.error(`   Found ${result.duplicateCount} duplicate identity sets in database.`);
        console.error('   Action: Resolve duplicate reminder jobs before re-running migration.');
      } else if (result.error) {
        console.error(`   Index creation/verification error: ${result.error}`);
      }
      console.error('   Existing database indexes and documents were left untouched.');

      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('\n✅ [Migration] ReminderJob index migration completed successfully:');
    console.log(`   - Backfilled documents: ${result.backfilled}`);
    console.log(`   - New unique index verified: true ({ taskId: 1, userId: 1, occurrenceKey: 1 })`);
    console.log(`   - Old index removed: ${result.indexDropped ? 'yes (taskId_1_userId_1_taskStartDate_1)' : 'already absent'}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('💥 [Migration] Unexpected migration error:', err.message);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

runMigration();
