import Notification from "../models/NotificationModel.js";

export const getUserNotifications = async (req, res) => {
  try {
    // Use authenticated user id from middleware to prevent users fetching others' notifications
    const authUserId = req.userId || (req.user && (req.user._id || req.user.id));
    if (!authUserId) return res.status(401).json({ msg: 'Not authenticated' });
    // If a param is provided, ensure it matches authenticated user (prevent enumeration)
    if (req.params.userId && String(req.params.userId) !== String(authUserId)) {
      return res.status(403).json({ msg: 'Forbidden' });
    }
    const notifications = await Notification.find({ recipient: authUserId })
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ msg: "Server error" });
  }
};
