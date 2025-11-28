

import express from 'express';
import userAuth from '../middleware/userAuth.js';
import TimeEntry from '../models/TimeEntry.js';
import userModel from '../models/userModel.js';
import Project from '../models/ProjectModel.js'; // <-- IMPORT PROJECT MODEL
import { classifyActivity } from '../services/classificationService.js'; // <-- IMPORT OUR NEW SERVICE
import { generateDailySummary, generateManagerSummary } from '../services/aiService.js';
import AiSummary from '../models/AiSummaryModel.js';

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

    // 2. Classify the activity (using Rules DB + AI)
    const suggestedCategory = await classifyActivity(appointment);
    
    let finalIsBillable = false;
    
    // 3. Check the Project's billable status
    if (projectId) {
      const project = await Project.findById(projectId).select('isBillable');
      if (project && project.isBillable && suggestedCategory === 'billable') {
        finalIsBillable = true;
      }
    }

    // 4. Find or create the TimeEntry document for this user+project
    let timeEntry = await TimeEntry.findOne({ userId: username, project: projectId });
    
    if (!timeEntry) {
      // Create new document
      timeEntry = new TimeEntry({
        userId: username,
        project: projectId,
        appointments: []
      });
    }

    // 5. Find or create the appointment group for this taskId
    const taskId = description || 'default'; // Use description as taskId
    let appointmentGroup = timeEntry.appointments.find(a => a.taskId === taskId && a.appname === appointment.appname && a.apptitle === appointment.apptitle);
    
    if (!appointmentGroup) {
      // Create new appointment group
      appointmentGroup = {
        apptitle: appointment.apptitle,
        appname: appointment.appname,
        taskId: taskId,
        suggestedCategory: suggestedCategory,
        isBillable: finalIsBillable,
        timeIntervals: []
      };
      timeEntry.appointments.push(appointmentGroup);
    }

    // 6. Add the time interval
    appointmentGroup.timeIntervals.push({
      startTime: new Date(appointment.startTime),
      endTime: appointment.endTime ? new Date(appointment.endTime) : new Date(),
      duration: Number(appointment.duration)
    });

    const savedEntry = await timeEntry.save();
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

  // Access control: by default employees only see their own entries.
  // If a projectId is provided and the requester is the project owner/manager,
  // allow listing entries for that project (all users).
  const query = { userId: username };
  let isManager = false;
  if (projectId) {
    // try to resolve project owner to determine manager rights
    try {
      const project = await Project.findById(projectId).select('createdBy');
      if (project) {
        const creatorId = project.createdBy && (project.createdBy._id || project.createdBy);
        isManager = creatorId && creatorId.toString() === req.userId;
      }
    } catch (e) {
      // ignore and treat as non-manager (minimal change)
    }

    if (isManager) {
      // manager may view all entries for the project
      delete query.userId;
      query.project = projectId;
    } else {
      // non-manager: restrict to own entries for the project
      query.project = projectId;
    }
  }

  // base query - get all time entries for this user
  let entries = await TimeEntry.find(query)
    .populate('project', 'ProjectName Description status')
    .sort({ createdAt: -1 })
    .exec();

  // Filter by task if provided (matches taskId or apptitle in any appointment)
  if (task) {
    const safe = String(task).trim();
    const regex = new RegExp(safe.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    entries = entries.filter(e => 
      e.appointments && e.appointments.some(apt => 
        (apt.taskId && regex.test(apt.taskId)) || 
        (apt.apptitle && regex.test(apt.apptitle))
      )
    );
  }

  // Enforce access control sanity: if requester is not manager, ensure
  // all returned entries belong to the current user. If not, deny access.
  if (!isManager) {
    const bad = entries.some(e => String(e.userId) !== String(username));
    if (bad) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
  }

  res.json(entries);
 } catch (err) {
   console.error(err);
   res.status(500).send('Server Error');
 }
});

// GET /api/time-entries/project/:projectId - Get time entries for a project
// For employees: returns only their own logs
// For managers: returns all employee logs with breakdown
router.get('/project/:projectId', userAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { taskId } = req.query; // optional filter by task
    
    if (!projectId) {
      return res.status(400).json({ msg: 'Project ID is required' });
    }

    // Get current user info
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    const username = currentUser.username;

    // Get project to check if user is manager/owner
    const project = await Project.findById(projectId)
      .populate('members', 'username name')
      .populate('createdBy', 'username name');
    
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    // Check if user is project manager/owner
    const creatorId = project.createdBy && (project.createdBy._id || project.createdBy);
    const isManager = creatorId && creatorId.toString() === req.userId;

    let entries;
    if (isManager) {
      // Manager view: get all time entries for this project
      const query = { project: projectId };
      entries = await TimeEntry.find(query)
        .populate('project', 'ProjectName Description status isBillable')
        .sort({ createdAt: -1 })
        .exec();
      
      // Group by employee and categorize by billable status
      const employeeStats = {};
      let totalBillable = 0;
      let totalNonBillable = 0;
      let totalAmbiguous = 0;

      for (const entry of entries) {
        const empUsername = entry.userId;
        if (!employeeStats[empUsername]) {
          employeeStats[empUsername] = {
            username: empUsername,
            billable: 0,
            nonBillable: 0,
            ambiguous: 0,
            totalTime: 0,
            entries: []
          };
        }

        // Filter appointments by taskId if provided
        let appointments = entry.appointments || [];
        if (taskId !== undefined && taskId !== null) {
          appointments = appointments.filter(apt => apt.taskId === taskId);
        }

        for (const apt of appointments) {
          const totalDuration = (apt.timeIntervals || []).reduce((sum, interval) => sum + (interval.duration || 0), 0);
          
          // Categorize by billable status
          if (apt.isBillable) {
            employeeStats[empUsername].billable += totalDuration;
            totalBillable += totalDuration;
          } else if (apt.suggestedCategory === 'non-billable') {
            employeeStats[empUsername].nonBillable += totalDuration;
            totalNonBillable += totalDuration;
          } else {
            employeeStats[empUsername].ambiguous += totalDuration;
            totalAmbiguous += totalDuration;
          }
          
          employeeStats[empUsername].totalTime += totalDuration;
        }

        if (appointments.length > 0) {
          employeeStats[empUsername].entries.push({
            ...entry.toObject(),
            appointments // filtered appointments
          });
        }
      }

      return res.json({
        isManager: true,
        employeeStats: Object.values(employeeStats),
        summary: {
          totalBillable,
          totalNonBillable,
          totalAmbiguous,
          totalTime: totalBillable + totalNonBillable + totalAmbiguous
        },
        allEntries: entries
      });
    } else {
      // Employee view: get only their own time entries for this project
      const query = { userId: username, project: projectId };
      entries = await TimeEntry.find(query)
        .populate('project', 'ProjectName Description status isBillable')
        .sort({ createdAt: -1 })
        .exec();

      // Enforce access control: non-managers must not receive others' entries
      const bad = entries.some(e => String(e.userId) !== String(username));
      if (bad) {
        return res.status(403).json({ msg: 'Not authorized' });
      }

      // Filter by task if provided and calculate stats
      let billable = 0;
      let nonBillable = 0;
      let ambiguous = 0;

      const filteredEntries = entries.map(entry => {
        let appointments = entry.appointments || [];
        if (taskId !== undefined && taskId !== null) {
          appointments = appointments.filter(apt => apt.taskId === taskId);
        }

        for (const apt of appointments) {
          const totalDuration = (apt.timeIntervals || []).reduce((sum, interval) => sum + (interval.duration || 0), 0);
          
          if (apt.isBillable) {
            billable += totalDuration;
          } else if (apt.suggestedCategory === 'non-billable') {
            nonBillable += totalDuration;
          } else {
            ambiguous += totalDuration;
          }
        }

        return {
          ...entry.toObject(),
          appointments
        };
      }).filter(e => e.appointments.length > 0);

      return res.json({
        isManager: false,
        entries: filteredEntries,
        summary: {
          billable,
          nonBillable,
          ambiguous,
          totalTime: billable + nonBillable + ambiguous
        }
      });
    }
  } catch (err) {
    console.error('Error fetching project time entries:', err);
    res.status(500).json({ msg: 'Server Error' });
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

    // Ensure authentication middleware set req.userId (mirror project creation auth checks)
    if (!req.userId) {
      console.error('Missing req.userId in manager daily-summary - userAuth may have failed');
      return res.status(401).json({ msg: 'Authentication required' });
    }

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
        'appointments.timeIntervals.startTime': { $gte: dayStart, $lte: dayEnd }
      }).populate('project', 'ProjectName').sort({ 'appointments.timeIntervals.startTime': -1 }).exec();

      const items = [];
      for (const e of entries) {
        for (const apt of (e.appointments || [])) {
          for (const interval of (apt.timeIntervals || [])) {
            items.push({
              apptitle: apt.apptitle,
              appname: apt.appname,
              start: interval.startTime,
              end: interval.endTime,
              duration: interval.duration,
              project: e.project ? (e.project.ProjectName || String(e.project)) : null,
            });
          }
        }
      }

      const summary = await generateDailySummary({ items, username: memberUsername, date: dayStart.toISOString() });
      reports.push({ username: memberUsername, items, itemsCount: items.length, summary });
    }

    const managerName = currentUser.username || currentUser.name || 'manager';
    const managerSummary = await generateManagerSummary({ reports, managerName, date: dayStart.toISOString() });

    // Persist the manager summary (upsert for project+date)
    try {
      await AiSummary.findOneAndUpdate(
        { type: 'manager', project: projectId, date: dayStart },
        {
          $set: {
            manager: currentUser._id || req.userId,
            managerUsername: managerName,
            summary: managerSummary,
            reports: reports
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (persistErr) {
      console.error('Failed to persist manager summary', persistErr);
      // Do not fail the request if save fails; just continue returning the summary
    }

    return res.json({ ok: true, managerSummary, reportsCount: reports.length });
  } catch (err) {
    console.error('manager daily-summary error', err);
    return res.status(500).json({ ok: false, error: String(err && (err.message || err)) });
  }
});




// GET /api/time-entries/ai-summary/manager/:projectId?date=YYYY-MM-DD
router.get('/ai-summary/manager/:projectId', userAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { date } = req.query;
    if (!projectId) return res.status(400).json({ msg: 'projectId is required' });
    let dayStart = date ? new Date(date) : new Date();
    dayStart.setHours(0,0,0,0);
    const summary = await AiSummary.findOne({
      type: 'manager',
      project: projectId,
      date: dayStart
    });
    if (!summary) return res.status(404).json({ msg: 'No summary found for this project/date' });
    res.json({ ok: true, summary });
  } catch (err) {
    console.error('GET ai-summary error', err);
    res.status(500).json({ ok: false, error: String(err && (err.message || err)) });
  }
});

// GET /api/time-entries/manager/overview?projectId=optional
// Returns aggregated employee-wise time (billable/non-billable/ambiguous) across all owned projects
router.get('/manager/overview', userAuth, async (req, res) => {
  try {
    const { projectId } = req.query;

    // Resolve current user (manager candidate)
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    const managerUsername = currentUser.username;

    // Determine owned projects
    let ownedProjectsQuery = { createdBy: req.userId, status: { $ne: 'deleted' } };
    if (projectId) {
      ownedProjectsQuery = { _id: projectId, createdBy: req.userId, status: { $ne: 'deleted' } };
    }
    const ownedProjects = await Project.find(ownedProjectsQuery).select('ProjectName');
    if (!ownedProjects || ownedProjects.length === 0) {
      return res.status(403).json({ msg: 'No owned projects found or not authorized' });
    }
    const ownedIds = ownedProjects.map(p => p._id);

    // Fetch all time entries for owned projects
    const entries = await TimeEntry.find({ project: { $in: ownedIds } })
      .populate('project', 'ProjectName isBillable')
      .sort({ createdAt: -1 })
      .exec();

    const employeeStats = {}; // per user across projects
    let totalBillable = 0, totalNonBillable = 0, totalAmbiguous = 0;

    for (const entry of entries) {
      const userId = entry.userId;
      if (!employeeStats[userId]) {
        employeeStats[userId] = {
          username: userId,
          billable: 0,
          nonBillable: 0,
          ambiguous: 0,
          totalTime: 0,
          projects: {},
          entries: [] // optional: raw entry references filtered
        };
      }

      const projId = entry.project ? entry.project._id.toString() : String(entry.project);
      if (!employeeStats[userId].projects[projId]) {
        employeeStats[userId].projects[projId] = {
          projectId: projId,
          name: entry.project && entry.project.ProjectName ? entry.project.ProjectName : projId,
          billable: 0,
          nonBillable: 0,
          ambiguous: 0,
          totalTime: 0
        };
      }

      for (const apt of (entry.appointments || [])) {
        const duration = (apt.timeIntervals || []).reduce((sum, iv) => sum + (iv.duration || 0), 0);
        if (duration <= 0) continue;
        let bucket;
        if (apt.isBillable) bucket = 'billable';
        else if (apt.suggestedCategory === 'non-billable') bucket = 'nonBillable';
        else bucket = 'ambiguous';

        employeeStats[userId][bucket] += duration;
        employeeStats[userId].totalTime += duration;
        employeeStats[userId].projects[projId][bucket] += duration;
        employeeStats[userId].projects[projId].totalTime += duration;

        if (bucket === 'billable') totalBillable += duration;
        else if (bucket === 'nonBillable') totalNonBillable += duration;
        else totalAmbiguous += duration;
      }

      // Store a lightweight version of entry if it had appointments
      if (entry.appointments && entry.appointments.length > 0) {
        employeeStats[userId].entries.push({ _id: entry._id, project: projId });
      }
    }

    const overview = {
      manager: managerUsername,
      ownedProjectCount: ownedProjects.length,
      summary: {
        totalBillable,
        totalNonBillable,
        totalAmbiguous,
        totalTime: totalBillable + totalNonBillable + totalAmbiguous
      },
      employees: Object.values(employeeStats).map(e => ({
        username: e.username,
        billable: e.billable,
        nonBillable: e.nonBillable,
        ambiguous: e.ambiguous,
        totalTime: e.totalTime,
        projects: Object.values(e.projects)
      }))
    };

    return res.json({ ok: true, overview });
  } catch (err) {
    console.error('manager overview error', err);
    return res.status(500).json({ ok: false, error: String(err && (err.message || err)) });
  }
});

export default router;