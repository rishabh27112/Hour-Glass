import Notification from "../models/NotificationModel.js";

export const getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.params.userId })
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ msg: "Server error" });
  }
};
