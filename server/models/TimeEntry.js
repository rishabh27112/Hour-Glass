import mongoose from 'mongoose';

const timeEntrySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // Storing username as per your code
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  description: { type: String },
  
  appointment: {
    apptitle: { type: String, required: true },
    appname: { type: String, required: true },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date },
    duration: { type: Number, required: true } // in seconds
  },

  // --- ADDED THESE FIELDS ---
  // The AI/Rule engine's suggestion (billable/non-billable)
  suggestedCategory: { type: String, enum: ['billable', 'non-billable'] },
  
  // The final, calculated billable status
  isBillable: { type: Boolean, default: false }
  // --------------------------

}, { timestamps: true });

const TimeEntry = mongoose.model('TimeEntry', timeEntrySchema);
export default TimeEntry;