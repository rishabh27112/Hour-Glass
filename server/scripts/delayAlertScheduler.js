import cron from 'node-cron';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Project from '../models/ProjectModel.js';
import userModel from '../models/userModel.js';
import Notification from '../models/NotificationModel.js';
import transporter from '../config/nodemailer.js';

dotenv.config();

// Resolve MongoDB connection string: prefer MONGO_URI, fall back to MONGODB_URL, then local default
const MONGO = process.env.MONGO_URI || process.env.MONGODB_URL || 'mongodb://localhost:27017/hourglass';

async function connect() {
  try {
    await mongoose.connect(MONGO);
    console.log('Delay alert scheduler connected to DB');
  } catch (err) {
    console.error('Delay alert scheduler DB connect error', err);
    throw err;
  }
}

// Run hourly and check for tasks that are due in roughly 24 hours (±30 minutes)
async function runCheck() {
  try {
    const now = new Date();
    const in24hMin = new Date(now.getTime() + (24 * 60 - 30) * 60 * 1000); // 23.5h
    const in24hMax = new Date(now.getTime() + (24 * 60 + 30) * 60 * 1000); // 24.5h

    // Find projects which have tasks with dueDate between in24hMin and in24hMax and delayAlertSent === false
    const projects = await Project.find({
      'tasks.dueDate': { $gte: in24hMin, $lte: in24hMax },
    }).populate('members', 'username email').populate('createdBy', 'username email');

    for (const project of projects) {
      for (const task of project.tasks) {
        if (!task.dueDate) continue;
        const due = new Date(task.dueDate);
        if (due.getTime() >= in24hMin.getTime() && due.getTime() <= in24hMax.getTime() && !task.delayAlertSent) {
          // notify the assignee if exists, otherwise notify project creator
          let recipients = [];
          if (task.assignee) {
            const assignee = await userModel.findById(task.assignee).select('email username');
            if (assignee && assignee.email) recipients.push({ id: assignee._id, email: assignee.email, username: assignee.username });
          } else {
            // notify all project members
            for (const m of project.members) {
              if (m.email) recipients.push({ id: m._id, email: m.email, username: m.username });
            }
          }

          // Fallback to project creator if no recipients
          if (recipients.length === 0 && project.createdBy && project.createdBy.email) {
            recipients.push({ id: project.createdBy._id, email: project.createdBy.email, username: project.createdBy.username });
          }

          const subject = `Task due soon: ${task.title}`;
          const text = `The task "${task.title}" in project "${project.ProjectName}" is due on ${due.toISOString()}. Please take action.`;

          for (const r of recipients) {
            try {
              // send email
              await transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: r.email,
                subject,
                text,
              });

              // create notification record
              await Notification.create({
                project: project._id,
                taskId: task._id,
                taskTitle: task.title,
                recipient: r.id,
                recipientEmail: r.email,
                type: 'due_soon',
                message: text,
                isSent: true,
                sentAt: new Date(),
              });
            } catch (e) {
              console.error('Failed to send email to', r.email, e);
              // create failed notification record
              await Notification.create({
                project: project._id,
                taskId: task._id,
                taskTitle: task.title,
                recipient: r.id,
                recipientEmail: r.email,
                type: 'due_soon',
                message: `FAILED: ${e.message}`,
                isSent: false,
              });
            }
          }

          // mark task.delayAlertSent = true to avoid duplicate alerts
          task.delayAlertSent = true;
        }
      }

      // save project if any task was modified
      await project.save();
    }
  } catch (err) {
    console.error('Error in delayAlertScheduler runCheck:', err);
  }
}

async function start() {
  await connect();
  console.log('Delay alert scheduler connected to DB');

  // Run immediately once on startup
  await runCheck();

  // Schedule to run every hour at minute 5
  cron.schedule('5 * * * *', () => {
    console.log('Delay alert scheduler running at', new Date().toISOString());
    runCheck();
  });
}

start().catch(err => {
  console.error('Scheduler failed to start', err);
  process.exit(1);
});
