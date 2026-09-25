import Task from '../models/Task.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { sendTaskReminderEmail } from './emailService.js';

/**
 * Check for tasks with reminders due in the next minute and send notifications.
 * This should be called every minute by a setInterval in the server.
 */
export const processTaskReminders = async () => {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 30 * 1000);  // 30s ago
  const windowEnd = new Date(now.getTime() + 30 * 1000);    // 30s ahead

  try {
    // Find tasks with reminders enabled where the reminder time falls within our window
    const tasks = await Task.find({
      'reminder.enabled': true,
      status: { $ne: 'Done' },
    }).populate('userId', 'name email');

    for (const task of tasks) {
      if (!task.startDate || !task.userId) continue;

      const minutesBefore = task.reminder?.minutesBefore || 15;
      const taskStart = new Date(task.startDate);
      
      // If task has a startTime, combine with date
      if (task.startTime) {
        const [hours, minutes] = task.startTime.split(':').map(Number);
        taskStart.setHours(hours, minutes, 0, 0);
      }

      // Calculate when the reminder should fire
      const reminderFireTime = new Date(taskStart.getTime() - minutesBefore * 60 * 1000);

      // Check if reminder fire time falls in our window
      if (reminderFireTime >= windowStart && reminderFireTime <= windowEnd) {
        const user = task.userId;
        const taskDate = taskStart.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: task.startTime ? '2-digit' : undefined,
          minute: task.startTime ? '2-digit' : undefined,
        });

        // Send in-app notification
        const existingNotif = await Notification.findOne({
          userId: user._id,
          relatedTaskId: task._id,
          type: 'task_reminder',
          createdAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) }, // Don't duplicate within 2 min
        });

        if (!existingNotif) {
          await Notification.create({
            userId: user._id,
            title: `⏰ Reminder: ${task.title}`,
            message: `Your task starts in ${minutesBefore} minute${minutesBefore !== 1 ? 's' : ''}.`,
            type: 'task_reminder',
            relatedTaskId: task._id,
          });

          // Send email reminder
          if (user.email) {
            await sendTaskReminderEmail({
              toEmail: user.email,
              toName: user.name,
              taskTitle: task.title,
              taskDescription: task.description || '',
              dueDate: taskDate,
              priority: task.priority,
              minutesBefore,
            });
          }

          console.log(`[Reminders] Sent reminder for task "${task.title}" to ${user.email}`);
        }
      }
    }
  } catch (err) {
    console.error('[Reminders] Error processing task reminders:', err.message);
  }
};
