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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
  },
}, { timestamps: true });

// Create or reuse model (prevents OverwriteModelError during hot reloads/tests)
const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);

export default Project;

