import express from 'express';
import userAuth from '../middleware/userAuth.js';
import Project from '../models/ProjectModel.js';
import userModel from '../models/userModel.js';


const router = express.Router();


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
    const isMemberOrCreator = project.createdBy && project.createdBy._id && project.createdBy._id.toString() === req.userId
      || (project.members && project.members.some(m => m.toString() === req.userId));
    if (!isMemberOrCreator) return res.status(403).json({ msg: 'Not authorized' });

    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// PATCH /api/projects/:id/archive - Archive a project (only creator)
router.patch('/:id/archive', userAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });
  if (project.createdBy.toString() !== req.userId) return res.status(403).json({ msg: 'Not authorized' });
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
    if (!project) return res.status(404).json({ msg: 'Project not found' });
  if (project.createdBy.toString() !== req.userId) return res.status(403).json({ msg: 'Not authorized' });
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
    if (!project) return res.status(404).json({ msg: 'Project not found' });
  if (project.createdBy.toString() !== req.userId) return res.status(403).json({ msg: 'Not authorized' });
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
    await project.save();

    const populated = await Project.findById(project._id).populate('createdBy', 'username name').populate('members', 'username name');
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


  // POST /api/projects/:id/tasks - Create a task inside a project (creator or members)
  router.post('/:id/tasks', userAuth, async (req, res) => {
    try {
      const { title, description, dueDate } = req.body;
      if (!title) return res.status(400).json({ msg: 'title is required' });

      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ msg: 'Project not found' });

      // Only project creator or members can create tasks
      const isMemberOrCreator = project.createdBy.toString() === req.userId || project.members.some(m => m.toString() === req.userId);
      if (!isMemberOrCreator) return res.status(403).json({ msg: 'Not authorized to create tasks in this project' });

      const task = { title, description: description || '' };
      if (dueDate) {
        const parsed = new Date(dueDate);
        if (isNaN(parsed.getTime())) return res.status(400).json({ msg: 'Invalid dueDate' });
        task.dueDate = parsed;
        task.isDelayed = parsed.getTime() < Date.now();
      }
      project.tasks.push(task);
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
    console.log(project.createdBy.toString() );
    console.log(req.userId);
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
      const { assigneeUsername } = req.body;
      if (!assigneeUsername) return res.status(400).json({ msg: 'assigneeUsername is required' });

      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ msg: 'Project not found' });

      // Only creator can assign tasks
      if (project.createdBy.toString() !== req.userId) return res.status(403).json({ msg: 'Not authorized' });

      // Find the user by username
      const memberUser = await userModel.findOne({ username: assigneeUsername }).select('_id username');
      if (!memberUser) return res.status(404).json({ msg: 'Assignee user not found' });

      // Normalize member id and check membership robustly. project.members may
      // contain ObjectIds, strings, or populated user objects ({ _id, username })
      const memberObjId = memberUser._id;
      // Normalize all project member ids to strings (handles populated docs, ObjectIds, strings)
      const memberIdStrings = (project.members || []).map(m => {
        if (m == null) return '';
        if (typeof m === 'object' && m._id) return m._id.toString();
        return m.toString();
      });

      if (!memberExists) return res.status(400).json({ msg: 'User is not a project member' });

      // Find the task
      const task = project.tasks.id(req.params.taskId);
      if (!task) return res.status(404).json({ msg: 'Task not found' });

      task.assignee = memberId;
      await project.save();

      const populated = await Project.findById(project._id).populate('createdBy', 'username name').populate('members', 'username name').populate('tasks.assignee', 'username name');
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
      const allowed = ['todo', 'in-progress', 'done'];
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