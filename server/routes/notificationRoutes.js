import express from "express";
import Notification from "../models/NotificationModel.js";
import { getUserNotifications } from "../controllers/notificationcontroller.js";
import userAuth  from "../middleware/userAuth.js"; // authentication middleware
import runNotificationJob from "../cron/notificationJob.js";
import sendEmail from "../utils/sendEmail.js";

const router = express.Router();

// Diagnostic log to confirm this router is loaded
console.log('[router] notificationRoutes loaded');

// GET /api/notifications/:userId - fetch notifications for a user
router.get('/:userId', userAuth, getUserNotifications);

// Test route to trigger the notification job manually
router.post("/test/run-reminders-now", async (req, res) => {
  try {
    console.log('[route] POST /test/run-reminders-now called');
    await runNotificationJob(); // call the cron job function manually
    res.json({ msg: "Notification job executed successfully" });
  } catch (err) {
    console.error("Error running job:", err);
    res.status(500).json({ error: err.message });
  }
});

// Test route to send a single email (helpful for debugging transporter / provider)
router.post('/test/send-email', async (req, res) => {
  try {
    console.log('[route] POST /test/send-email called with body:', req.body);
    const { to, subject, text } = req.body || {};
    if (!to) return res.status(400).json({ error: 'to is required in JSON body' });
    const ok = await sendEmail(to, subject || 'Test Email from Hour-Glass', text || 'This is a test email.');
    if (ok) return res.json({ ok: true, msg: `Email sent to ${to}` });
    return res.status(500).json({ ok: false, error: 'sendEmail returned false' });
  } catch (err) {
    console.error('test send-email error:', err && (err.response || err.message || err));
    return res.status(500).json({ ok: false, error: String(err && (err.response || err.message || err)) });
  }
});

export default router;
