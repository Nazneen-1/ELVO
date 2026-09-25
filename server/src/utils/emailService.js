import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

// Create reusable transporter
const createTransporter = () => {
  // Use ethereal (dev) or configured SMTP
  if (config.emailHost) {
    return nodemailer.createTransport({
      host: config.emailHost,
      port: config.emailPort || 587,
      secure: config.emailSecure || false,
      auth: {
        user: config.emailUser,
        pass: config.emailPass,
      },
    });
  }

  // Fallback: Gmail via SMTP if GMAIL_USER/GMAIL_PASS is set
  if (config.gmailUser && config.gmailPass) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.gmailUser,
        pass: config.gmailPass,
      },
    });
  }

  return null;
};

/**
 * Send a workspace invitation email.
 * @param {Object} options
 * @param {string} options.toEmail - Recipient email
 * @param {string} options.toName - Recipient name
 * @param {string} options.inviterName - Name of the person sending the invite
 * @param {string} options.workspaceName - Name of the workspace
 * @param {string} options.inviteCode - The workspace invite code
 * @param {string} options.role - The role being invited as
 */
export const sendWorkspaceInviteEmail = async ({
  toEmail,
  toName,
  inviterName,
  workspaceName,
  inviteCode,
  role = 'member',
}) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.log('[Email] No email transporter configured. Skipping workspace invite email.');
    return false;
  }

  const clientUrl = config.clientUrl || 'http://localhost:5173';
  const joinUrl = `${clientUrl}/app/workspaces`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 40px; text-align: center; }
        .logo { font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
        .logo span { color: #a5b4fc; }
        .body { padding: 36px 40px; }
        .greeting { font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
        .message { font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px; }
        .workspace-card { background: #f1f5f9; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px; border-left: 4px solid #4f46e5; }
        .workspace-name { font-size: 18px; font-weight: 700; color: #1e293b; }
        .workspace-role { font-size: 13px; color: #64748b; margin-top: 4px; }
        .invite-code-label { font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 16px; margin-bottom: 6px; }
        .invite-code { font-family: monospace; font-size: 20px; font-weight: 700; color: #4f46e5; background: #ede9fe; border-radius: 8px; padding: 10px 16px; display: inline-block; letter-spacing: 0.1em; }
        .cta-btn { display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; margin-top: 8px; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 40px; text-align: center; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">EL<span>VO</span></div>
          <p style="color:#c7d2fe;font-size:14px;margin-top:6px;">Collaborative Task & Calendar Management</p>
        </div>
        <div class="body">
          <div class="greeting">You've been invited! 🎉</div>
          <p class="message">
            <strong>${inviterName}</strong> has invited you to join a workspace on ELVO.
          </p>
          <div class="workspace-card">
            <div class="workspace-name">${workspaceName}</div>
            <div class="workspace-role">You're being added as: <strong>${role.charAt(0).toUpperCase() + role.slice(1)}</strong></div>
            <div class="invite-code-label">Your Invite Code</div>
            <div class="invite-code">${inviteCode}</div>
          </div>
          <p class="message">
            Click below to join the workspace. Once you're logged in, go to <strong>Workspaces</strong> and use the invite code above.
          </p>
          <a href="${joinUrl}" class="cta-btn">Accept Invitation →</a>
          <p style="font-size:13px;color:#94a3b8;margin-top:24px;">
            If you weren't expecting this invitation, you can safely ignore this email.
          </p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} ELVO. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"ELVO" <${config.emailUser || config.gmailUser || 'noreply@elvo.app'}>`,
      to: toEmail,
      subject: `${inviterName} invited you to "${workspaceName}" on ELVO`,
      html,
    });
    console.log(`[Email] Workspace invite sent to ${toEmail}`);
    return true;
  } catch (err) {
    console.error('[Email] Failed to send workspace invite:', err.message);
    return false;
  }
};

/**
 * Send a task reminder email.
 * @param {Object} options
 * @param {string} options.toEmail - Recipient email
 * @param {string} options.toName - Recipient name
 * @param {string} options.taskTitle - Title of the task
 * @param {string} options.taskDescription - Description of the task
 * @param {string} options.dueDate - Due date string
 * @param {string} options.priority - Task priority
 * @param {number} options.minutesBefore - Minutes before the task when reminder fires
 */
export const sendTaskReminderEmail = async ({
  toEmail,
  toName,
  taskTitle,
  taskDescription,
  dueDate,
  priority,
  minutesBefore,
}) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.log('[Email] No email transporter configured. Skipping task reminder email.');
    return false;
  }

  const priorityColor = priority === 'High' ? '#ef4444' : priority === 'Medium' ? '#f59e0b' : '#10b981';
  const clientUrl = config.clientUrl || 'http://localhost:5173';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 28px 40px; }
        .logo { font-size: 22px; font-weight: 800; color: #ffffff; }
        .logo span { color: #a5b4fc; }
        .alert-badge { display:inline-block; background: rgba(255,255,255,0.2); color:#fff; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 8px; }
        .body { padding: 32px 40px; }
        .reminder-msg { font-size: 17px; font-weight: 600; color: #0f172a; margin-bottom: 20px; }
        .task-card { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
        .task-header { padding: 16px 20px; border-left: 4px solid ${priorityColor}; }
        .task-title { font-size: 16px; font-weight: 700; color: #1e293b; }
        .task-meta { font-size: 13px; color: #64748b; margin-top: 6px; }
        .task-desc { padding: 14px 20px; background: #f8fafc; font-size: 14px; color: #475569; border-top: 1px solid #e2e8f0; }
        .priority-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; color: ${priorityColor}; background: ${priorityColor}18; }
        .cta-btn { display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 40px; text-align: center; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">EL<span>VO</span></div>
          <div class="alert-badge">⏰ Task Reminder</div>
        </div>
        <div class="body">
          <div class="reminder-msg">Your task starts in ${minutesBefore} minute${minutesBefore !== 1 ? 's' : ''}!</div>
          <div class="task-card">
            <div class="task-header">
              <div class="task-title">${taskTitle}</div>
              <div class="task-meta">
                📅 ${dueDate} &nbsp;&nbsp;
                <span class="priority-badge">${priority} Priority</span>
              </div>
            </div>
            ${taskDescription ? `<div class="task-desc">${taskDescription}</div>` : ''}
          </div>
          <a href="${clientUrl}/app/tasks" class="cta-btn">View Task →</a>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} ELVO. You received this because you enabled task reminders.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"ELVO Reminders" <${config.emailUser || config.gmailUser || 'noreply@elvo.app'}>`,
      to: toEmail,
      subject: `⏰ Reminder: "${taskTitle}" starts in ${minutesBefore} min`,
      html,
    });
    console.log(`[Email] Task reminder sent to ${toEmail}`);
    return true;
  } catch (err) {
    console.error('[Email] Failed to send task reminder:', err.message);
    return false;
  }
};
