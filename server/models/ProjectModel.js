import mongoose from 'mongoose';

// Full Project schema
const projectSchema = new mongoose.Schema({
  ProjectName: { type: String, required: true, trim: true },
  Description: { type: String, trim: true, default: '' },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
  },
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user'
    },
  ],
  // Tasks within a project. Each task may be assigned to a member (user ObjectId).
  tasks: [
    {
      title: { type: String, required: true, trim: true },
      description: { type: String, trim: true, default: '' },
      assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: false },
      status: { type: String, enum: ['todo', 'in-progress', 'done'], default: 'todo' },
      dueDate: { type: Date, required: false },
      isDelayed: { type: Boolean, default: false },
      delayAlertSent: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
    }
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
  },
}, { timestamps: true });

// Ensure each user cannot create two projects with the same name
projectSchema.index({ createdBy: 1, ProjectName: 1 }, { unique: true, background: true });

const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);

export default Project;

