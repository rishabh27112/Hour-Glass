import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: false },
  taskId: { type: mongoose.Schema.Types.ObjectId, required: false }, // subdocument id
  taskTitle: { type: String, required: false },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: false },
  recipientEmail: { type: String, required: false },
  type: { type: String, required: true }, // e.g. 'due_soon'
  message: { type: String, required: false },
  isSent: { type: Boolean, default: false },
  sentAt: { type: Date },
}, { timestamps: true });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;
