import mongoose from 'mongoose';

const timeIntervalSchema = new mongoose.Schema({
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  duration: { type: Number, required: true } // seconds
}, { _id: false });

const groupedAppointmentSchema = new mongoose.Schema({
  apptitle: { type: String, required: true },
  appname: { type: String, required: true },
  // optional: associate this appointment group to a specific task within the project
  // we keep it as string to allow either a DB ObjectId or a client-generated id
  taskId: { type: String, required: false, index: true },
  suggestedCategory: { type: String, enum: ['billable', 'non-billable', 'ambiguous'], required: true },
  isBillable: { type: Boolean, default: false },

  // multiple time intervals for the same task
  timeIntervals: { type: [timeIntervalSchema], default: [] }
}, { _id: false });

const timeEntrySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },

  // all grouped appointments under user+project
  appointments: { type: [groupedAppointmentSchema], default: [] }

}, { timestamps: true });

const TimeEntry = mongoose.model('TimeEntry', timeEntrySchema);
export default TimeEntry;