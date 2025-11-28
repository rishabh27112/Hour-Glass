import express from 'express';
import userAuth from '../middleware/userAuth.js';
import Project from '../models/ProjectModel.js';
import userModel from '../models/userModel.js';


const router = express.Router();

const parseDateOrThrow = (value, label) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const err = new Error(`Invalid ${label}`);
    err.statusCode = 400;
    throw err;
  }
  return parsed;
};

const evaluateTaskStatusByDueDate = (task, nowMs) => {
  if (!task || task.status === 'done') return false;

  const setStatus = (status, isDelayed = false) => {
    if (task.status === status && task.isDelayed === isDelayed) return false;
    task.status = status;
    task.isDelayed = isDelayed;
    return true;
  };

  if (!task.dueDate) {
    return task.status === 'incomplete' ? setStatus('in-progress', false) : false;
      const statusesChanged = syncTaskDueStatuses(project);
      if (statusesChanged) {
        await project.save();
        await project.populate('createdBy', 'username name')
          .populate('members', 'username name')
          .populate('tasks.assignee', 'username name');
      }
      res.json(serializeProjectResponse(project));

  const dueMs = task.dueDate instanceof Date ? task.dueDate.getTime() : new Date(task.dueDate).getTime();
  if (Number.isNaN(dueMs)) return false;

  if (dueMs < nowMs) {
    if (task.status === 'incomplete') return false;
    return setStatus('incomplete', true);
  }

  if (task.status === 'incomplete') {
    return setStatus('in-progress', false);
  }

  return false;
};

const syncTaskDueStatuses = (project) => {
  if (!project || !Array.isArray(project.tasks)) return false;
  const now = Date.now();
  let changed = false;

  for (const task of project.tasks) {
    if (evaluateTaskStatusByDueDate(task, now)) {
      changed = true;
    }
  }

  if (changed && typeof project.markModified === 'function') {
    project.markModified('tasks');
  }
  return changed;
};

const ensureTaskDueStatuses = async (project) => {
  if (!project) return false;
  const changed = syncTaskDueStatuses(project);
  if (changed) {
    await project.save();
  }
  return changed;
};

const serializeProjectResponse = (project) => {
  if (!project) return project;
  const plain = project.toObject({ virtuals: true });
  plain.memberRates = project.memberRates ? Object.fromEntries(project.memberRates) : {};
  return plain;
};


// POST /api/projects - Create a new project
router.post('/', userAuth, async (req, res) => {
  try {
    const { ProjectName, Description } = req.body;
    if (!ProjectName) {
      return res.status(400).json({ msg: 'ProjectName is required.' });
    }

    // Ensure authentication middleware set req.userId
    if (!req.userId) {
      console.error('Missing req.userId in Project creation - userAuth may have failed');
      return res.status(401).json({ msg: 'Authentication required' });
    }

    // resolve the current user's username
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });

    // Ensure user doesn't already have a project with same name
    const existingProject = await Project.findOne({ ProjectName, createdBy: req.userId });
    if (existingProject) {
      return res.status(400).json({ msg: 'A project with this name already exists.' });
    }

    const newProject = new Project({
      ProjectName,
      Description: Description || '',
      createdBy: req.userId,
    });

    const project = await newProject.save();
    res.status(201).json(project);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// GET /api/projects - Get all projects for the authenticated user (created or member of)
router.get('/', userAuth, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { createdBy: req.userId },
        { members: req.userId }
      ]
    })
    .populate('createdBy', 'username name')
    .populate('members', 'username name')
    .sort({ createdAt: -1 });

    for (const project of projects) {
      if (syncTaskDueStatuses(project)) {
        await project.save();
      }
    }

    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// GET /api/projects/:id - Get single project with populated fields (creator or member)
router.get('/:id', userAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('createdBy', 'username name')
      .populate('members', 'username name')
      .populate('tasks.assignee', 'username name');
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    // Only creator or members can view
    const creatorId = project.createdBy && (project.createdBy._id || project.createdBy);
    const isCreator = creatorId && creatorId.toString() === req.userId;
    const isMember = project.members && project.members.some(m => {
      const memberId = m._id || m;
      return memberId.toString() === req.userId;
    });
    
    if (!isCreator && !isMember) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const projectData = project.toObject({ virtuals: true });
    projectData.memberRates = project.memberRates ? Object.fromEntries(project.memberRates) : {};
    res.json(projectData);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// PATCH /api/projects/:id/member-rates - Update hourly rates for members (creator or manager role)
router.patch('/:id/member-rates', userAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    const currentUser = await userModel.findById(req.userId).select('role isManager');
    const isCreator = project.createdBy.toString() === req.userId;
    const hasManagerRole = currentUser && (currentUser.role === 'manager' || currentUser.isManager === true);
    if (!isCreator && !hasManagerRole) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const { memberId, rate } = req.body || {};
    if (!memberId) return res.status(400).json({ msg: 'memberId is required' });
    const numericRate = Number(rate);
    if (Number.isNaN(numericRate) || numericRate < 0) {
      return res.status(400).json({ msg: 'Rate must be a non-negative number' });
    }

    const memberExists = (project.members || []).some(m => (m._id || m).toString() === String(memberId));
    if (!memberExists) {
      return res.status(400).json({ msg: 'User is not a member of this project' });
    }

    project.memberRates = project.memberRates || new Map();
    project.memberRates.set(String(memberId), numericRate);
    await project.save();

    const response = project.toObject();
    response.memberRates = Object.fromEntries(project.memberRates);
    res.json({ memberRates: response.memberRates });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// PATCH /api/projects/:id/details - Update summary details (only creator)
router.patch('/:id/details', userAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });
    if (project.createdBy.toString() !== req.userId) return res.status(403).json({ msg: 'Not authorized' });

    const { budget, startDate, endDate } = req.body || {};
    const updates = {};

    if (budget !== undefined) {
      const parsedBudget = Number(budget);
      if (Number.isNaN(parsedBudget) || parsedBudget < 0) {
        return res.status(400).json({ msg: 'Budget must be a non-negative number' });
      }
      updates.budget = parsedBudget;
    }

    if (startDate !== undefined) {
      updates.startDate = startDate
        ? parseDateOrThrow(startDate, 'startDate')
        : (project.createdAt || new Date());
    }

    if (endDate !== undefined) {
      updates.endDate = endDate ? parseDateOrThrow(endDate, 'endDate') : null;
    }

    if (Object.keys(updates).length > 0) {
      Object.assign(project, updates);
      await project.save();
    }

    const populated = await Project.findById(project._id)
      .populate('createdBy', 'username name')
      .populate('members', 'username name')
      .populate('tasks.assignee', 'username name');
    res.json(populated);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ msg: err.message });
    }
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// PATCH /api/projects/:id/archive - Archive a project (only creator)
router.patch('/:id/archive', userAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }
    if (project.createdBy.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    project.status = 'archived';
    await project.save();
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// PATCH /api/projects/:id/restore - Restore an archived project (only creator)
router.patch('/:id/restore', userAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }
    if (project.createdBy.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    project.status = 'active';
    await project.save();
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// DELETE /api/projects/:id - Delete a project (only creator)
router.delete('/:id', userAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }
    if (project.createdBy.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    // Soft-delete: mark status = 'deleted' so frontend can show Bin and allow restore
    project.status = 'deleted';
    await project.save();
    res.json({ msg: 'Project moved to bin', project });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// PATCH /api/projects/:id/restore-deleted - Restore from bin (only creator)
router.patch('/:id/restore-deleted', userAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });
    if (project.createdBy.toString() !== req.userId) return res.status(403).json({ msg: 'Not authorized' });
    // Restore deleted project to active
    project.status = 'active';
    await project.save();
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// DELETE /api/projects/:id/permanent - Permanently delete a project (only creator)
router.delete('/:id/permanent', userAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });
    if (project.createdBy.toString() !== req.userId) return res.status(403).json({ msg: 'Not authorized' });
    await project.deleteOne();
    res.json({ msg: 'Project permanently deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// POST /api/projects/:id/members - Add a member by username, email, or id (only creator)
router.post('/:id/members', userAuth, async (req, res) => {
  try {
    const { username, email, userId } = req.body;
    if (!username && !email && !userId) return res.status(400).json({ msg: 'username, email, or userId is required' });

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    // Only creator can add members
    if (project.createdBy.toString() !== req.userId) return res.status(403).json({ msg: 'Not authorized' });

    // Find the user by id, email, or username
    let memberUser = null;
    if (userId) memberUser = await userModel.findById(userId).select('_id username');
    else if (email) memberUser = await userModel.findOne({ email }).select('_id username');
    else if (username) memberUser = await userModel.findOne({ username }).select('_id username');

    if (!memberUser) return res.status(404).json({ msg: 'Member user not found' });

    const memberId = memberUser._id;

    // Check if member's ID is already in the array
    if (project.members.some(m => m.toString() === memberId.toString())) {
      return res.status(400).json({ msg: 'User already a member' });
    }

    project.members.push(memberId);
    project.memberRates = project.memberRates || new Map();
    project.memberRates.set(memberId.toString(), project.memberRates.get(memberId.toString()) || 0);
    await project.save();

    // Return populated project
    const populated = await Project.findById(project._id).populate('createdBy', 'username name').populate('members', 'username name');
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// DELETE /api/projects/:id/members/:username - Remove a member by username (only creator)
router.delete('/:id/members/:username', userAuth, async (req, res) => {
  try {
    const usernameToRemove = req.params.username;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    // Only creator can remove members
    if (project.createdBy.toString() !== req.userId) return res.status(403).json({ msg: 'Not authorized' });

    const memberUser = await userModel.findOne({ username: usernameToRemove }).select('_id username');
    if (!memberUser) return res.status(404).json({ msg: 'Member user not found' });

    const memberId = memberUser._id.toString();

    if (!project.members.some(m => m.toString() === memberId)) return res.status(400).json({ msg: 'User not a member' });

    project.members = project.members.filter(u => u.toString() !== memberId);
    if (project.memberRates) {
      project.memberRates.delete(memberId);
    }
    await project.save();

    const populated = await Project.findById(project._id).populate('createdBy', 'username name').populate('members', 'username name');
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


  // POST /api/projects/:id/tasks - Create a task inside a project (only creator)
  router.post('/:id/tasks', userAuth, async (req, res) => {
    try {
      const { title, description, dueDate, assignee } = req.body;
      if (!title) return res.status(400).json({ msg: 'title is required' });

      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ msg: 'Project not found' });

      // Only project creator can create tasks
      const creatorId = project.createdBy ? project.createdBy.toString() : null;
      const currentUserId = req.userId ? req.userId.toString() : null;
      
      if (!creatorId || !currentUserId || creatorId !== currentUserId) {
        return res.status(403).json({ msg: 'Not authorized. Only the project creator can add tasks.' });
      }

      const task = { title, description: description || '' };
      
      // Handle assignee if provided
      if (assignee && assignee.trim() !== '') {
        // assignee can be username, email, or userId
        let assigneeUser = null;
        
        // Try to find by ObjectId first
        if (typeof assignee === 'string' && assignee.match(/^[0-9a-fA-F]{24}$/)) {
          try {
            assigneeUser = await userModel.findById(assignee).select('_id username');
          } catch (err) {
            // Invalid ObjectId format, continue to username/email lookup
          }
        }
        
        // If not found, try by username or email
        if (!assigneeUser) {
          assigneeUser = await userModel.findOne({
            $or: [{ username: assignee }, { email: assignee }]
          }).select('_id username');
        }
        
        if (!assigneeUser) {
          return res.status(404).json({ msg: `Assignee user '${assignee}' not found` });
        }
        
        // Ensure assignee is a member of the project
        const assigneeId = assigneeUser._id.toString();
        if (!project.members.some(m => m.toString() === assigneeId)) {
          return res.status(400).json({ msg: 'Assignee must be a member of this project' });
        }
        
        task.assignee = assigneeUser._id;
      }
      
      if (dueDate) {
        const parsed = new Date(dueDate);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ msg: 'Invalid dueDate' });
        }
        task.dueDate = parsed;
        task.isDelayed = parsed.getTime() < Date.now();
      }
      project.tasks.push(task);
      syncTaskDueStatuses(project);
      await project.save();

      const populated = await Project.findById(project._id).populate('createdBy', 'username name').populate('members', 'username name').populate('tasks.assignee', 'username name');
      res.status(201).json(populated);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });


// GET /api/projects/:id/tasks/overdue - List overdue tasks where alert not yet sent (only creator)
router.get('/:id/tasks/overdue', userAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);//.populate('tasks.assignee', 'username name').populate('members', 'username name').populate('createdBy', 'username name');
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    // Only creator can fetch overdue list (sensible: manager triggers alerts)
    if (project.createdBy.toString() !== req.userId) return res.status(403).json({ msg: 'Not authorized' });
    
    const now = new Date();
    const overdue = project.tasks.filter(t => t.dueDate && t.dueDate.getTime() < now.getTime() && !t.delayAlertSent);

    res.json({ projectId: project._id, overdue });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// PATCH /api/projects/:id/tasks/:taskId/alerted - Mark a task's delayAlertSent = true (only creator)
router.patch('/:id/tasks/:taskId/alerted', userAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    // Only creator can mark alert as sent
    if (project.createdBy.toString() !== req.userId) return res.status(403).json({ msg: 'Not authorized' });

    const task = project.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ msg: 'Task not found' });

    task.delayAlertSent = true;
    // Keep isDelayed consistent
    if (task.dueDate) task.isDelayed = task.dueDate.getTime() < Date.now();

    await project.save();

    const populated = await Project.findById(project._id).populate('createdBy', 'username name').populate('members', 'username name').populate('tasks.assignee', 'username name');
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


  // PATCH /api/projects/:id/tasks/:taskId/assign - Assign a task to a member (only creator)
  router.patch('/:id/tasks/:taskId/assign', userAuth, async (req, res) => {
    try {
      // Accept assignee identification by username, email or id for flexibility
      const { assigneeUsername, assigneeEmail, assigneeId } = req.body;
      if (!assigneeUsername && !assigneeEmail && !assigneeId) return res.status(400).json({ msg: 'assigneeUsername, assigneeEmail or assigneeId is required' });

      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ msg: 'Project not found' });

      // Only creator can assign tasks
      if (project.createdBy.toString() !== req.userId) return res.status(403).json({ msg: 'Not authorized' });

      // Find the user by the provided identifier
      let memberUser = null;
      if (assigneeId) memberUser = await userModel.findById(assigneeId).select('_id username email name');
      else if (assigneeEmail) memberUser = await userModel.findOne({ email: assigneeEmail }).select('_id username email name');
      else if (assigneeUsername) memberUser = await userModel.findOne({ username: assigneeUsername }).select('_id username email name');

      if (!memberUser) return res.status(404).json({ msg: 'Assignee user not found' });

      const memberId = memberUser._id.toString();

      // Ensure assignee is a member of project
      if (!project.members.some(m => m.toString() === memberId)) return res.status(400).json({ msg: 'User is not a project member' });

      // Find the task
      const task = project.tasks.id(req.params.taskId);
      if (!task) return res.status(404).json({ msg: 'Task not found' });

      task.assignee = memberId;
      await project.save();

      const populated = await Project.findById(project._id)
        .populate('createdBy', 'username name')
        .populate('members', 'username name email')
        .populate('tasks.assignee', 'username name email');
      res.json(populated);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

// PATCH /api/projects/:id/tasks/:taskId/due-date - Update a task's due date (creator or manager role)
router.patch('/:id/tasks/:taskId/due-date', userAuth, async (req, res) => {
  try {
    const { dueDate } = req.body || {};
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    const currentUser = await userModel.findById(req.userId).select('role isManager');
    const isCreator = project.createdBy.toString() === req.userId;
    const hasManagerRole = currentUser && (currentUser.role === 'manager' || currentUser.isManager === true);
    if (!isCreator && !hasManagerRole) return res.status(403).json({ msg: 'Not authorized' });

    const task = project.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ msg: 'Task not found' });

    const isClearingDate = dueDate === undefined || dueDate === null || String(dueDate).trim() === '';
    if (isClearingDate) {
      task.dueDate = undefined;
      task.isDelayed = false;
    } else {
      const parsed = new Date(dueDate);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ msg: 'Invalid dueDate' });
      }
      task.dueDate = parsed;
      task.isDelayed = parsed.getTime() < Date.now();
    }

    syncTaskDueStatuses(project);
    await project.save();

    const populated = await Project.findById(project._id)
      .populate('createdBy', 'username name')
      .populate('members', 'username name')
      .populate('tasks.assignee', 'username name');
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


  // PATCH /api/projects/:id/tasks/:taskId/status - Update task status (members or creator)
  router.patch('/:id/tasks/:taskId/status', userAuth, async (req, res) => {
    try {
      const { status } = req.body;
      const allowed = ['todo', 'in-progress', 'incomplete', 'done'];
      if (!status || !allowed.includes(status)) return res.status(400).json({ msg: `status is required and must be one of: ${allowed.join(', ')}` });

      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ msg: 'Project not found' });

      // Only project members or creator can update status
      const isMemberOrCreator = project.createdBy.toString() === req.userId || project.members.some(m => m.toString() === req.userId);
      if (!isMemberOrCreator) return res.status(403).json({ msg: 'Not authorized to update tasks in this project' });

      const task = project.tasks.id(req.params.taskId);
      if (!task) return res.status(404).json({ msg: 'Task not found' });

      task.status = status;
      await project.save();

      const populated = await Project.findById(project._id).populate('createdBy', 'username name').populate('members', 'username name').populate('tasks.assignee', 'username name');
      res.json(populated);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });


export default router;