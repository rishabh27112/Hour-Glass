

import mongoose from 'mongoose';

const appointmentSubSchema = new mongoose.Schema({
  apptitle: { type: String, required: true, trim: true },
  appname: { type: String, required: true, trim: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  duration: { type: Number, required: true, default: 0 }, // seconds
}, { _id: false });

const timeEntrySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    // store username (string) instead of ObjectId so joins are by username
  },
  description: {
    type: String,
    trim: true,
  },
  // single nested object containing the appointment/time data
  appointment: {
    type: appointmentSubSchema,
    required: true,
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project', // Link to our Project model
    required: false,
  },
}, {
  timestamps: true,
  discriminatorKey: 'kind',
});
// Note: duration is provided by the client (winapp/linuxapp). We no longer
// auto-calculate duration here because the server will only store the
// object received via the API.

const TimeEntry = mongoose.model('TimeEntry', timeEntrySchema);

export default TimeEntry;
