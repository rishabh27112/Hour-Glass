import cron from "node-cron";
import Project from "../models/ProjectModel.js";
import Notification from "../models/NotificationModel.js";
import sendEmail from "../utils/sendEmail.js";

// Runs every hour
cron.schedule("0 * * * *", async () => {
  console.log("🔍 Checking for tasks due in next 24 hours...");

  const now = new Date();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Fetch all projects that have at least one task with a due date in next 24h
  const projects = await Project.find({
    "tasks.dueDate": { $gte: now, $lte: next24h },
  })
    .populate("tasks.assignee", "email") // only fetch email from user
    .populate("members", "email");

  for (const project of projects) {
    for (const task of project.tasks) {
      if (!task.dueDate || !task.assignee) continue;

      const dueIn = task.dueDate - now;
      if (dueIn > 0 && dueIn <= 24 * 60 * 60 * 1000) {
        // check if notification already exists
        const alreadyNotified = await Notification.findOne({
          taskId: task._id,
          type: "due_soon",
          isSent: true,
        });

        if (alreadyNotified) continue;

        const message = `Reminder: Task "${task.title}" in project "${project.ProjectName}" is due in 24 hours.`;

        // create new notification
        const notification = new Notification({
          project: project._id,
          taskId: task._id,
          taskTitle: task.title,
          recipient: task.assignee._id,
          recipientEmail: task.assignee.email,
          type: "due_soon",
          message,
          channels: { inApp: true, email: true },
        });

        await notification.save();

        // Send email if enabled
        if (notification.channels.email) {
          await sendEmail(task.assignee.email, "Task Due Reminder", message);
        }

        // Mark as sent
        notification.isSent = true;
        notification.sentAt = new Date();
        await notification.save();

        console.log(`📧 Sent reminder for task "${task.title}"`);
      }
    }
  }

  console.log("✅ Task reminder check complete.");
});
