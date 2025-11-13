import mongoose from 'mongoose';

const itemSnapshotSchema = new mongoose.Schema({
  apptitle: { type: String },
  appname: { type: String },
  start: { type: Date },
  end: { type: Date },
  duration: { type: Number },
  project: { type: String },
}, { _id: false });

const memberReportSchema = new mongoose.Schema({
  username: { type: String, index: true },
  itemsCount: { type: Number, default: 0 },
  summary: { type: String },
  items: { type: [itemSnapshotSchema], default: [] }
}, { _id: false });

const aiSummarySchema = new mongoose.Schema({
  type: { type: String, enum: ['daily-user', 'manager'], required: true },
  date: { type: Date, required: true, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  // Manager identity for manager summaries
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  managerUsername: { type: String },
  // For daily-user summaries, the target user
  username: { type: String },
  summary: { type: String },
  reports: { type: [memberReportSchema], default: [] },
}, { timestamps: true });

// Uniqueness: one manager summary per project per day
aiSummarySchema.index({ type: 1, project: 1, date: 1 }, { unique: true, partialFilterExpression: { type: 'manager' } });
// Optional: one daily-user summary per user per day
aiSummarySchema.index({ type: 1, username: 1, date: 1 }, { unique: true, partialFilterExpression: { type: 'daily-user' } });

const AiSummary = mongoose.models.AiSummary || mongoose.model('AiSummary', aiSummarySchema);

export default AiSummary;
