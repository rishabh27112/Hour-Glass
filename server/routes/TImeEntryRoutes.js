import express from 'express';
import userAuth from '../middleware/userAuth.js';
import TimeEntry from '../models/TimeEntry.js';
import userModel from '../models/userModel.js';


const router = express.Router();


// POST /api/time-entries - Store a complete appointment/time entry
// The client (winapp / linuxapp) sends a single `appointment` object:
// { apptitle, appname, startTime, endTime, duration }
router.post('/', userAuth, async (req, res) => {
  try {
    const { appointment, projectId, description } = req.body;
    if (!appointment || !appointment.apptitle || !appointment.appname || !appointment.startTime || appointment.duration == null) {
      return res.status(400).json({ msg: 'Invalid appointment payload. Required: apptitle, appname, startTime, duration' });
    }

    // resolve username
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    const username = currentUser.username;

    const newEntry = new TimeEntry({
      userId: username,
      description,
      project: projectId,
      appointment: {
        apptitle: appointment.apptitle,
        appname: appointment.appname,
        startTime: new Date(appointment.startTime),
        endTime: appointment.endTime ? new Date(appointment.endTime) : undefined,
        duration: Number(appointment.duration),
      }
    });

    const savedEntry = await newEntry.save();
    const populatedEntry = await savedEntry.populate('project', 'ProjectName Description status');
    res.status(201).json(populatedEntry);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// (start/stop endpoints removed) Clients should send a complete appointment
// object to POST /api/time-entries and the server will store it as-is.


// GET /api/time-entries - Get all time entries for a user
router.get('/', userAuth, async (req, res) => {
 try {
  const currentUser = await userModel.findById(req.userId).select('username');
  if (!currentUser) return res.status(401).json({ msg: 'User not found' });
  const username = currentUser.username;

  // optional query filters: projectId, task (task id or task title substring)
  const { projectId, task } = req.query;

  const query = { userId: username };
  if (projectId) query.project = projectId;

  // base query
  let entriesQuery = TimeEntry.find(query).populate('project', 'ProjectName Description status').sort({ 'appointment.startTime': -1 });

  let entries = await entriesQuery.exec();

  // additional in-memory filtering for task (matches appointment.apptitle case-insensitive)
  if (task) {
    const safe = String(task).trim();
    const regex = new RegExp(safe.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    entries = entries.filter(e => (e.appointment && e.appointment.apptitle && regex.test(e.appointment.apptitle)));
  }

  res.json(entries);
 } catch (err) {
   console.error(err);
   res.status(500).send('Server Error');
 }
});


// DELETE /api/time-entries/:id - Delete a time entry
router.delete('/:id', userAuth, async (req, res) => {
 try {
   const currentUser = await userModel.findById(req.userId).select('username');
   if (!currentUser) return res.status(401).json({ msg: 'User not found' });
   const username = currentUser.username;
   const entry = await TimeEntry.findOne({ _id: req.params.id, userId: username });
   if (!entry) {
     return res.status(404).json({ msg: 'Time entry not found' });
   }
   await entry.deleteOne();
   res.json({ msg: 'Time entry removed' });
 } catch (err) {
  console.error(err);
  res.status(500).send('Server Error');
 }
});


export default router;
