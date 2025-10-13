import express from 'express';
import userAuth from '../middleware/userAuth.js';
import Project from '../models/ProjectModel.js';
import userModel from '../models/userModel.js';


const router = express.Router();


// POST /api/projects - Create a new project
router.post('/', userAuth, async (req, res) => {
  try {
    const { ProjectName, Description, members } = req.body;
    if (!ProjectName) {
      return res.status(400).json({ msg: 'ProjectName is required.' });
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
      // members should be an array of ObjectIds. If frontend passed usernames, we'll ignore here
      members: Array.isArray(members) ? members : [],
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
    await project.deleteOne();
    res.json({ msg: 'Project deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// POST /api/projects/:id/members - Add a member by username (only creator)
router.post('/:id/members', userAuth, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ msg: 'username is required' });

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    // Only creator can add members
    if (project.createdBy.toString() !== req.userId) return res.status(403).json({ msg: 'Not authorized' });

    // Find the user by username
    const memberUser = await userModel.findOne({ username }).select('_id username');
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


export default router;