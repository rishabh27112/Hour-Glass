import express from 'express';
import userAuth from '../middleware/userAuth.js';
import TimeEntry from '../models/TimeEntry.js';
import userModel from '../models/userModel.js';
import Project from '../models/ProjectModel.js'; // <-- IMPORT PROJECT MODEL
import { classifyActivity } from '../services/classificationService.js'; // <-- IMPORT OUR NEW SERVICE
import { generateDailySummary, generateManagerSummary } from '../services/aiService.js';

const router = express.Router();

// POST /api/time-entries - Store a complete appointment/time entry
router.post('/', userAuth, async (req, res) => {
  try {
    const { appointment, projectId, description } = req.body;
    if (!appointment || !appointment.apptitle || !appointment.appname || !appointment.startTime || appointment.duration == null) {
      return res.status(400).json({ msg: 'Invalid appointment payload. Required: apptitle, appname, startTime, duration' });
    }

    // 1. Resolve username
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    const username = currentUser.username;

    // --- START NEW CLASSIFICATION LOGIC ---
    
    // 2. Classify the activity (using Rules DB + AI)
    // This gives us 'billable' or 'non-billable'
    const suggestedCategory = await classifyActivity(appointment);
    
    let finalIsBillable = false;
    
    // 3. Check the Project's billable status
    if (projectId) {
      const project = await Project.findById(projectId).select('isBillable');
      if (project && project.isBillable && suggestedCategory === 'billable') {
        // Only billable if BOTH the project is billable AND the activity is billable
        finalIsBillable = true;
      }
    }
    // If no project is assigned, it defaults to false (non-billable)

    // --- END NEW CLASSIFICATION LOGIC ---

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
      },
      suggestedCategory: suggestedCategory, // <-- SAVE SUGGESTION
      isBillable: finalIsBillable          // <-- SAVE FINAL STATUS
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


// POST /api/time-entries/daily-summary/manager - manager-only summary for a project team
// body: { projectId: string, date?: ISODateString }
router.post('/daily-summary/manager', userAuth, async (req, res) => {
  try {
    const { projectId, date } = req.body || {};
    if (!projectId) return res.status(400).json({ msg: 'projectId is required' });

    // resolve current user and check manager rights
    const currentUser = await userModel.findById(req.userId).select('username name');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });

    const project = await Project.findById(projectId).populate('members', 'username name').populate('createdBy', 'username name');
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    const creatorId = project.createdBy && (project.createdBy._id || project.createdBy);
    if (!creatorId || creatorId.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Only the project owner/manager can request team summaries' });
    }

    const target = date ? new Date(date) : new Date();
    const dayStart = new Date(target); dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(target); dayEnd.setHours(23,59,59,999);

    const members = (project.members || []).slice();
    if (members.length === 0) return res.status(200).json({ ok: true, summary: `No members on project ${project.ProjectName || project._id}` });

    const reports = [];
    for (const m of members) {
      const memberUsername = m.username || (typeof m === 'string' ? m : null);
      if (!memberUsername) continue;

      const entries = await TimeEntry.find({
        userId: memberUsername,
        'appointment.startTime': { $gte: dayStart, $lte: dayEnd }
      }).populate('project', 'ProjectName').sort({ 'appointment.startTime': -1 }).exec();

      const items = entries.map(e => ({
        apptitle: e.appointment && e.appointment.apptitle,
        appname: e.appointment && e.appointment.appname,
        start: e.appointment && e.appointment.startTime,
        end: e.appointment && e.appointment.endTime,
        duration: e.appointment && e.appointment.duration,
        project: e.project ? (e.project.ProjectName || String(e.project)) : null,
      }));

      const summary = await generateDailySummary({ items, username: memberUsername, date: dayStart.toISOString() });
      reports.push({ username: memberUsername, items, itemsCount: items.length, summary });
    }

    const managerName = currentUser.username || currentUser.name || 'manager';
    const managerSummary = await generateManagerSummary({ reports, managerName, date: dayStart.toISOString() });

    return res.json({ ok: true, managerSummary, reportsCount: reports.length });
  } catch (err) {
    console.error('manager daily-summary error', err);
    return res.status(500).json({ ok: false, error: String(err && (err.message || err)) });
  }
});


export default router;
