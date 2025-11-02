import express from "express";
import Notification from "../models/NotificationModel.js";
import { getUserNotifications } from "../controllers/notificationcontroller.js";
import userAuth  from "../middleware/userAuth.js"; // authentication middleware
import runNotificationJob from "../cron/notificationJob.js";

const router = express.Router();

// GET /api/notifications/:userId - fetch notifications for a user
router.get('/:userId', userAuth, getUserNotifications);

// Test route to trigger the notification job manually
router.post("/test/run-reminders-now", async (req, res) => {
  try {
    await runNotificationJob(); // call the cron job function manually
    res.json({ msg: "Notification job executed successfully" });
  } catch (err) {
    console.error("Error running job:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
