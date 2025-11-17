import mongoose from 'mongoose';

const brainstormEntrySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  
  // Optional: link to an assigned task
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project.tasks', required: false },
  
  // User's detailed description of brainstorming activity
  description: { type: String, required: true, trim: true },
  
  // AI classification result: 'billable', 'non-billable', or 'ambiguous'
  classification: { 
    type: String, 
    enum: ['billable', 'non-billable', 'ambiguous'],
    default: 'ambiguous'
  },
  
  // AI confidence in the classification (0-1)
  confidence: { type: Number, min: 0, max: 1 },
  
  // Human readable reasoning from AI
  reasoning: { type: String },
  
  // Manual override by user/manager
  isBillable: { type: Boolean },
  notes: { type: String }
  
}, { timestamps: true });

// Index for common queries
brainstormEntrySchema.index({ userId: 1, project: 1, createdAt: -1 });

const BrainstormEntry = mongoose.model('BrainstormEntry', brainstormEntrySchema);
export default BrainstormEntry;
