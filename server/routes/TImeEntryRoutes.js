import express from 'express';
import userAuth from '../middleware/userAuth.js';
import TimeEntry from '../models/TimeEntry.js';
import userModel from '../models/userModel.js';


const router = express.Router();


// POST /api/time-entries/start - Start a new time entry
router.post('/start', userAuth, async (req, res) => {
 try {
   const { description, projectId } = req.body;
   // resolve username
   const currentUser = await userModel.findById(req.userId).select('username');
   if (!currentUser) return res.status(401).json({ msg: 'User not found' });
   const username = currentUser.username;

   const activeEntry = await TimeEntry.findOne({ userId: username, endTime: null });
   if (activeEntry) {
     return res.status(400).json({ msg: 'You already have a timer running.' });
   }
   const newEntry = new TimeEntry({
     userId: username,
     description,
     project: projectId,
     startTime: new Date(),
   });
   const savedEntry = await newEntry.save();
  const populatedEntry = await savedEntry.populate('project', 'ProjectName Description status');
   res.status(201).json(populatedEntry);
 } catch (err) {
   res.status(500).send('Server Error');
 }
});


// PATCH /api/time-entries/stop/:id - Stop a running time entry
router.patch('/stop/:id', userAuth, async (req, res) => {
   try {
  const currentUser = await userModel.findById(req.userId).select('username');
  if (!currentUser) return res.status(401).json({ msg: 'User not found' });
  const username = currentUser.username;
  const entry = await TimeEntry.findOne({ _id: req.params.id, userId: username });
       if (!entry || entry.endTime) {
           return res.status(400).json({ msg: 'Timer not found or already stopped.' });
       }
       entry.endTime = new Date();
       const savedEntry = await entry.save();
       res.json(savedEntry);
   } catch (err) {
       res.status(500).send('Server Error');
   }
});


// GET /api/time-entries - Get all time entries for a user
router.get('/', userAuth, async (req, res) => {
 try {
  const currentUser = await userModel.findById(req.userId).select('username');
  if (!currentUser) return res.status(401).json({ msg: 'User not found' });
  const username = currentUser.username;

  const entries = await TimeEntry.find({ userId: username })
    .populate('project', 'ProjectName Description status') // Adds project brief info
    .sort({ startTime: -1 });
   res.json(entries);
 } catch (err) {
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
   res.status(500).send('Server Error');
 }
});


export default router;
