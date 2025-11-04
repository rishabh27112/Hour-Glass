import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    taskId: { type: mongoose.Schema.Types.ObjectId }, // subdocument _id
    taskTitle: { type: String },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    recipientEmail: { type: String },
    type: {
      type: String,
      enum: ["due_soon", "reminder", "general"],
      required: true,
    },
    message: { type: String },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },
    isSent: { type: Boolean, default: false },
    sentAt: { type: Date },
  },
  { timestamps: true }
);

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
