import mongoose from 'mongoose';

const classificationRuleSchema = new mongoose.Schema({
  /**
   * The normalized app name (e.g., "code", "spotify").
   * This is the unique key we will query against.
   */
  appName: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  
  /**
   * The classification: 'billable', 'non-billable', or 'ambiguous'
   */
  classification: { 
    type: String, 
    required: true, 
    enum: ['billable', 'non-billable', 'ambiguous']
  }
  ,
  // Where this rule came from. 'ai' = created/suggested by AI, 'manual' = human-edited/imported.
  source: {
    type: String,
    enum: ['ai', 'manual', 'import'],
    default: undefined
  },
  // Optional confidence score (0-1) if available from AI
  confidence: { type: Number },
  // Optional human notes explaining edits or overrides
  notes: { type: String }
}, { timestamps: true });

const ClassificationRule = mongoose.model('ClassificationRule', classificationRuleSchema);
export default ClassificationRule;