import express from 'express';
import userAuth from '../middleware/userAuth.js';
import TimeEntry from '../models/TimeEntry.js';
import userModel from '../models/userModel.js';
import Project from '../models/ProjectModel.js';
import { classifyActivity } from '../services/classificationService.js';
import { generateDailySummary, generateManagerSummary } from '../services/aiService.js';

const router = express.Router();

// shared handler to add or update grouped appointment
async function handleAddEntry(req, res) {
  try {
    const { appointment, projectId, description, taskId } = req.body;
    if (!appointment || !appointment.apptitle || !appointment.appname || !appointment.startTime || appointment.duration == null) {
      return res.status(400).json({ msg: 'Invalid appointment payload. Required: apptitle, appname, startTime, duration' });
    }

    // 1. Resolve username
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    const username = currentUser.username;

  // derive task identifier if passed (Electron sends description as task string)
  const incomingTaskId = (taskId || description || '').toString() || undefined;

  // 2. Classify activity (AI + rule-based)
    const suggestedCategory = await classifyActivity(appointment);

    let finalIsBillable = false;
    if (projectId) {
      const project = await Project.findById(projectId).select('isBillable');
      if (project && project.isBillable && suggestedCategory === 'billable') {
        finalIsBillable = true;
      }
    }

    // 3. Find or create user-project document
  let entry = await TimeEntry.findOne({ userId: username, project: projectId });

    if (!entry) {
      // First appointment for this project
      entry = new TimeEntry({
        userId: username,
        project: projectId,
        appointments: [{
          apptitle: appointment.apptitle,
          appname: appointment.appname,
          taskId: incomingTaskId,
          suggestedCategory,
          isBillable: finalIsBillable,
          timeIntervals: [{
            startTime: new Date(appointment.startTime),
            endTime: appointment.endTime ? new Date(appointment.endTime) : undefined,
            duration: Number(appointment.duration)
          }]
        }]
      });
    } else {
      // 4. Check if same appointment type exists
      const existingApp = entry.appointments.find(a =>
        a.apptitle === appointment.apptitle &&
        a.appname === appointment.appname &&
        a.isBillable === finalIsBillable &&
        ((incomingTaskId && a.taskId === incomingTaskId) || (!incomingTaskId && !a.taskId))
      );

      if (existingApp) {
        // Add new interval
        existingApp.timeIntervals.push({
          startTime: new Date(appointment.startTime),
          endTime: appointment.endTime ? new Date(appointment.endTime) : undefined,
          duration: Number(appointment.duration)
        });
      } else {
        // Add new appointment group
        entry.appointments.push({
          apptitle: appointment.apptitle,
          appname: appointment.appname,
          taskId: incomingTaskId,
          suggestedCategory,
          isBillable: finalIsBillable,
          timeIntervals: [{
            startTime: new Date(appointment.startTime),
            endTime: appointment.endTime ? new Date(appointment.endTime) : undefined,
            duration: Number(appointment.duration)
          }]
        });
      }
    }

    const savedEntry = await entry.save();
    const populatedEntry = await savedEntry.populate('project', 'ProjectName Description status');
    res.status(201).json(populatedEntry);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
}

// POST /api/time-entries — Add or update grouped appointment
router.post('/', userAuth, handleAddEntry);
// Alias: POST /api/time-entries/add-entry
router.post('/add-entry', userAuth, handleAddEntry);

// GET /api/time-entries — Retrieve all user time entries
router.get('/', userAuth, async (req, res) => {
  try {
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    const username = currentUser.username;

    const { projectId, task, taskId } = req.query;
    const query = { userId: username };
    if (projectId) query.project = projectId;

    const entries = await TimeEntry.find(query)
      .populate('project', 'ProjectName Description status')
      .sort({ updatedAt: -1 })
      .exec();

    // Optional: filter by task (apptitle substring)
    let filtered = entries;
    if (task) {
      const regex = new RegExp(task, 'i');
      filtered = entries.map(e => ({
        ...e._doc,
        appointments: e.appointments.filter(a => regex.test(a.apptitle))
      })).filter(e => e.appointments.length > 0);
    }

    // Optional: filter by exact taskId
    if (taskId) {
      filtered = filtered.map(e => ({
        ...e._doc,
        appointments: e.appointments.filter(a => String(a.taskId) === String(taskId))
      })).filter(e => e.appointments.length > 0);
    }

    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// GET /api/time-entries/flat — Flattened list per time interval for UI consumption
// Returns: [{ _id, appointment: { appname, apptitle, startTime, endTime, duration }, project: {..}, taskId }]
router.get('/flat', userAuth, async (req, res) => {
  try {
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    const username = currentUser.username;

    const { projectId, taskId, task } = req.query;
    const query = { userId: username };
    if (projectId) query.project = projectId;

    const docs = await TimeEntry.find(query)
      .populate('project', 'ProjectName Description status')
      .sort({ updatedAt: -1 })
      .exec();

    const out = [];
    for (const doc of docs) {
      for (const a of (doc.appointments || [])) {
        // filter by taskId if provided
        if (taskId && String(a.taskId) !== String(taskId)) continue;
        // optional fuzzy filter by apptitle if provided as 'task'
        if (task) {
          const regex = new RegExp(task, 'i');
          if (!regex.test(a.apptitle || '')) continue;
        }
        for (let i = 0; i < (a.timeIntervals || []).length; i++) {
          const ti = a.timeIntervals[i];
          out.push({
            _id: `${doc._id}:${a.appname}:${i}:${ti.startTime?.toISOString?.() || i}`,
            appointment: {
              appname: a.appname,
              apptitle: a.apptitle,
              startTime: ti.startTime,
              endTime: ti.endTime,
              duration: ti.duration,
            },
            project: doc.project,
            taskId: a.taskId || null,
          });
        }
      }
    }
    // Sort newest first by startTime
    out.sort((x, y) => new Date(y.appointment.startTime).getTime() - new Date(x.appointment.startTime).getTime());
    res.json(out);
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

// POST /api/time-entries/hours-per-day
// body: { projectId: string, memberUsername: string }
// returns: [{ date: 'YYYY-MM-DD', hours: number }]
router.post('/hours-per-day', userAuth, async (req, res) => {
  try {
    const { projectId, memberUsername } = req.body || {};
    if (!projectId || !memberUsername) return res.status(400).json({ msg: 'projectId and memberUsername are required' });

    // resolve current user and check manager rights or allow self
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    const username = currentUser.username;

    const project = await Project.findById(projectId).populate('createdBy', 'username');
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    const creatorId = project.createdBy && (project.createdBy._id || project.createdBy);
    const creatorUsername = project.createdBy && (project.createdBy.username || null);
    // allow if requester is project creator (manager) or requesting their own data
    if (!(creatorId && creatorId.toString() === req.userId) && username !== memberUsername) {
      return res.status(403).json({ msg: 'Only the project owner/manager or the member themselves can request this data' });
    }

    // fetch time entries for the member on this project
    const docs = await TimeEntry.find({ userId: memberUsername, project: projectId }).exec();
    const intervals = [];
    for (const doc of docs) {
      for (const a of (doc.appointments || [])) {
        for (const ti of (a.timeIntervals || [])) {
          if (!ti || !ti.startTime) continue;
          const start = new Date(ti.startTime);
          const durSec = Number(ti.duration) || (ti.endTime ? (new Date(ti.endTime).getTime() - start.getTime()) / 1000 : 0);
          const end = ti.endTime ? new Date(ti.endTime) : new Date(start.getTime() + durSec * 1000);
          intervals.push({ start, end, duration: durSec });
        }
      }
    }

    if (intervals.length === 0) return res.json({ ok: true, data: [] });

    // determine date range (use local dates)
    let minDate = intervals.reduce((min, it) => it.start < min ? it.start : min, intervals[0].start);
    let maxDate = intervals.reduce((max, it) => it.end > max ? it.end : max, intervals[0].end);
    // normalize to date boundaries (local)
    const toYMD = d => {
      const dt = new Date(d);
      dt.setHours(0,0,0,0);
      return dt;
    };
    let cur = toYMD(minDate);
    const last = toYMD(maxDate);

    // bucket durations by date (simple attribution to start-date)
    const buckets = {};
    for (const it of intervals) {
      const dayKey = toYMD(it.start).toISOString().slice(0,10);
      buckets[dayKey] = (buckets[dayKey] || 0) + (Number(it.duration) || 0);
    }

    // create continuous array from min to max inclusive
    const out = [];
    for (let dt = new Date(cur); dt <= last; dt.setDate(dt.getDate() + 1)) {
      const key = dt.toISOString().slice(0,10);
      const seconds = buckets[key] || 0;
      out.push({ date: key, hours: Math.round((seconds / 3600) * 100) / 100 });
    }

    return res.json({ ok: true, data: out });
  } catch (err) {
    console.error('[time-entries] hours-per-day error:', err && err.stack ? err.stack : err);
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({ error: String(err && (err.message || err)), stack: err && err.stack });
    }
    return res.status(500).send('Server Error');
  }
});

// DELETE /api/time-entries/:projectId/:apptitle — delete full appointment group
router.delete('/:projectId/:apptitle', userAuth, async (req, res) => {
  try {
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    const username = currentUser.username;

    const { projectId, apptitle } = req.params;

    const entry = await TimeEntry.findOne({ userId: username, project: projectId });
    if (!entry) return res.status(404).json({ msg: 'Entry not found' });

    const newAppointments = entry.appointments.filter(a => a.apptitle !== apptitle);
    entry.appointments = newAppointments;

    await entry.save();
    res.json({ msg: 'Appointment group removed' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

export default router;
