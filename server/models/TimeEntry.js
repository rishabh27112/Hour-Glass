

import mongoose from 'mongoose';

const timeEntrySchema = new mongoose.Schema({
 userId: {
   type: String,
   required: true,
   // store username (string) instead of ObjectId so joins are by username
 },
 description: {
   type: String,
   required: true,
   trim: true,
 },
 startTime: {
   type: Date,
   required: true,
   default: Date.now,
 },
 endTime: {
   type: Date,
 },
 duration: {
   type: Number, // Storing duration in seconds
   default: 0,
 },
 project: {
   type: mongoose.Schema.Types.ObjectId,
   ref: 'Project', // Link to our new Project model
   required: false,
 },
}, {
 timestamps: true,
});

// Calculate duration automatically before saving
timeEntrySchema.pre('save', function(next) {
 if (this.endTime && this.startTime) {
   this.duration = Math.floor((this.endTime.getTime() - this.startTime.getTime()) / 1000);
 }
 next();
});

const TimeEntry = mongoose.model('TimeEntry', timeEntrySchema);

export default TimeEntry;
