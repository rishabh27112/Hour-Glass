import mongoose from 'mongoose';

// Sub-schema for individual ideas/notes within a brainstorm session
const ideaSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true, trim: true },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['new', 'under-review', 'approved', 'rejected', 'implemented'],
    default: 'new'
  },
  tags: [{ type: String, trim: true }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: true });

// Sub-schema for attachments/links
const attachmentSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['link', 'file', 'image', 'document'],
    required: true 
  },
  url: { type: String, required: true, trim: true },
  name: { type: String, trim: true },
  description: { type: String, trim: true },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

// Sub-schema for participants in collaborative brainstorming
const participantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  username: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['owner', 'contributor', 'viewer'],
    default: 'contributor'
  },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });

// Main brainstorm session schema
const brainstormEntrySchema = new mongoose.Schema({
  // Session metadata
  title: { type: String, required: true, trim: true },
  userId: { type: String, required: true, index: true }, // Primary owner
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  
  // Optional: link to an assigned task
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project.tasks', required: false },
  
  // Session details
  description: { type: String, required: true, trim: true }, // Overall session description
  sessionType: {
    type: String,
    enum: ['individual', 'team', 'client', 'planning', 'problem-solving', 'ideation'],
    default: 'individual'
  },
  
  // Duration tracking
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  duration: { type: Number }, // in minutes, calculated from start/end
  
  // Ideas/notes generated during the session
  ideas: [ideaSchema],
  
  // Attachments, links, references
  attachments: [attachmentSchema],
  
  // Collaborative participants (if team session)
  participants: [participantSchema],
  
  // Tags/categories for organization
  tags: [{ type: String, trim: true }],
  category: {
    type: String,
    enum: ['feature-design', 'bug-solving', 'architecture', 'ui-ux', 'research', 'strategy', 'other'],
    default: 'other'
  },
  
  // Session status
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'cancelled', 'archived'],
    default: 'completed'
  },
  
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
  
  // Additional notes/comments
  notes: { type: String, trim: true },
  
  // Summary/outcome
  summary: { type: String, trim: true },
  actionItems: [{ type: String, trim: true }],
  
  // Metrics
  ideasCount: { type: Number, default: 0 },
  approvedIdeasCount: { type: Number, default: 0 }
  
}, { timestamps: true });

// Indexes for efficient querying
brainstormEntrySchema.index({ userId: 1, project: 1, createdAt: -1 });
brainstormEntrySchema.index({ project: 1, status: 1 });
brainstormEntrySchema.index({ tags: 1 });
brainstormEntrySchema.index({ category: 1 });
brainstormEntrySchema.index({ 'participants.userId': 1 });

// Pre-save middleware to calculate duration and idea counts
brainstormEntrySchema.pre('save', function(next) {
  // Calculate duration if endTime is set
  if (this.startTime && this.endTime) {
    const durationMs = this.endTime - this.startTime;
    this.duration = Math.round(durationMs / 60000); // Convert to minutes
  }
  
  // Update idea counts
  if (this.ideas && Array.isArray(this.ideas)) {
    this.ideasCount = this.ideas.length;
    this.approvedIdeasCount = this.ideas.filter(idea => idea.status === 'approved').length;
  }
  
  next();
});

// Instance method to add an idea
brainstormEntrySchema.methods.addIdea = function(ideaData) {
  this.ideas.push(ideaData);
  return this.save();
};

// Instance method to add a participant
brainstormEntrySchema.methods.addParticipant = function(userId, username, role = 'contributor') {
  const exists = this.participants.some(p => p.userId.toString() === userId.toString());
  if (!exists) {
    this.participants.push({ userId, username, role });
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to get project statistics
brainstormEntrySchema.statics.getProjectStats = async function(projectId) {
  return this.aggregate([
    { $match: { project: projectId } },
    {
      $group: {
        _id: '$classification',
        count: { $sum: 1 },
        totalDuration: { $sum: '$duration' },
        totalIdeas: { $sum: '$ideasCount' }
      }
    }
  ]);
};

const BrainstormEntry = mongoose.model('BrainstormEntry', brainstormEntrySchema);
export default BrainstormEntry;
