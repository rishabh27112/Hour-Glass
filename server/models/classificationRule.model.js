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
}, { timestamps: true });

const ClassificationRule = mongoose.model('ClassificationRule', classificationRuleSchema);
export default ClassificationRule;