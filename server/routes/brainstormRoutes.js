import express from 'express';
import mongoose from 'mongoose';
import userAuth from '../middleware/userAuth.js';
import userModel from '../models/userModel.js';
import BrainstormEntry from '../models/BrainstormEntry.js';
import Project from '../models/ProjectModel.js';
import { classifyBrainstormEntry } from '../services/brainstormService.js';

const router = express.Router();

/**
 * POST /api/brainstorm - Create a new brainstorm entry and classify it
 * Body: { 
 *   title, projectId, taskId?, description, sessionType?, 
 *   startTime?, endTime?, ideas?, tags?, category?, participants?
 * }
 */
router.post('/', userAuth, async (req, res) => {
  try {
    const { 
      title, projectId, taskId, description, sessionType, 
      startTime, endTime, ideas, tags, category, participants,
      attachments, notes, summary, actionItems
    } = req.body;
    
    if (!title || !projectId || !description) {
      return res.status(400).json({ msg: 'title, projectId and description are required' });
    }
    
    // Verify user has access to the project
    const project = await Project.findById(projectId).select('members createdBy');
    if (!project) return res.status(404).json({ msg: 'Project not found' });
    
    const creatorId = project.createdBy?.toString();
    const isMember = project.members?.some(m => m.toString() === req.userId);
    if (creatorId !== req.userId && !isMember) {
      return res.status(403).json({ msg: 'Not a member of this project' });
    }
    
    // Get username
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    const username = currentUser.username;
    
    // Classify the brainstorm entry
    const classResult = await classifyBrainstormEntry(description, projectId, taskId);
    
    // Create entry
    const entry = new BrainstormEntry({
      title: title.trim(),
      userId: username,
      project: projectId,
      taskId: taskId || undefined,
      description: description.trim(),
      sessionType: sessionType || 'individual',
      startTime: startTime ? new Date(startTime) : new Date(),
      endTime: endTime ? new Date(endTime) : undefined,
      ideas: ideas || [],
      tags: tags || [],
      category: category || 'other',
      participants: participants || [],
      attachments: attachments || [],
      notes: notes || '',
      summary: summary || '',
      actionItems: actionItems || [],
      classification: classResult.classification,
      confidence: classResult.confidence,
      reasoning: classResult.reasoning,
      status: endTime ? 'completed' : 'in-progress'
    });
    
    const savedEntry = await entry.save();
    const populatedEntry = await savedEntry.populate('project', 'ProjectName');
    
    res.status(201).json({
      ok: true,
      entry: populatedEntry,
      classification: classResult.classification,
      confidence: classResult.confidence,
      reasoning: classResult.reasoning
    });
  } catch (err) {
    console.error('[Brainstorm POST] error:', err);
    res.status(500).json({ error: String(err.message) });
  }
});

/**
 * GET /api/brainstorm - List brainstorm entries for user in a project
 * Body/Query: { projectId, taskId?, limit?, skip? }
 */
router.get('/', userAuth, async (req, res) => {
  try {
    const { projectId, taskId, limit = 50, skip = 0 } = req.body || req.query;
    
    if (!projectId) {
      return res.status(400).json({ msg: 'projectId is required' });
    }
    
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    const username = currentUser.username;
    
    const query = { userId: username, project: projectId };
    if (taskId) query.taskId = taskId;
    
    const entries = await BrainstormEntry.find(query)
      .populate('project', 'ProjectName Description')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .exec();
    
    const total = await BrainstormEntry.countDocuments(query);
    
    res.json({
      ok: true,
      entries,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (err) {
    console.error('[Brainstorm GET] error:', err);
    res.status(500).json({ error: String(err.message) });
  }
});

/**
 * GET /api/brainstorm/:id - Get a specific brainstorm entry
 */
router.get('/:id', userAuth, async (req, res) => {
  try {
    const entry = await BrainstormEntry.findById(req.params.id).populate('project', 'ProjectName Description');
    
    if (!entry) return res.status(404).json({ msg: 'Entry not found' });
    
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    
    // Check authorization
    if (entry.userId !== currentUser.username) {
      return res.status(403).json({ msg: 'Unauthorized' });
    }
    
    res.json({ ok: true, entry });
  } catch (err) {
    console.error('[Brainstorm GET/:id] error:', err);
    res.status(500).json({ error: String(err.message) });
  }
});

/**
 * PATCH /api/brainstorm/:id - Update classification manually or add notes
 * Body: { isBillable?, classification?, notes? }
 */
router.patch('/:id', userAuth, async (req, res) => {
  try {
    const { isBillable, classification, notes } = req.body;
    
    const entry = await BrainstormEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ msg: 'Entry not found' });
    
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    
    // Check authorization
    if (entry.userId !== currentUser.username) {
      return res.status(403).json({ msg: 'Unauthorized' });
    }
    
    // Update fields
    if (isBillable !== undefined) entry.isBillable = Boolean(isBillable);
    if (classification && ['billable', 'non-billable', 'ambiguous'].includes(classification)) {
      entry.classification = classification;
    }
    if (notes) entry.notes = notes;
    
    const updated = await entry.save();
    res.json({ ok: true, entry: updated });
  } catch (err) {
    console.error('[Brainstorm PATCH] error:', err);
    res.status(500).json({ error: String(err.message) });
  }
});

/**
 * DELETE /api/brainstorm/:id - Delete a brainstorm entry
 */
router.delete('/:id', userAuth, async (req, res) => {
  try {
    const entry = await BrainstormEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ msg: 'Entry not found' });
    
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    
    // Check authorization
    if (entry.userId !== currentUser.username) {
      return res.status(403).json({ msg: 'Unauthorized' });
    }
    
    await entry.deleteOne();
    res.json({ ok: true, msg: 'Entry deleted' });
  } catch (err) {
    console.error('[Brainstorm DELETE] error:', err);
    res.status(500).json({ error: String(err.message) });
  }
});

/**
 * GET /api/brainstorm/project/:projectId/stats - Project brainstorm stats (billable vs non-billable count)
 */
router.get('/project/:projectId/stats', userAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Verify access to project
    const project = await Project.findById(projectId).select('members createdBy');
    if (!project) return res.status(404).json({ msg: 'Project not found' });
    
    const creatorId = project.createdBy?.toString();
    const isMember = project.members?.some(m => m.toString() === req.userId);
    if (creatorId !== req.userId && !isMember) {
      return res.status(403).json({ msg: 'Not a member of this project' });
    }
    
    // Use the static method from the schema
    const stats = await BrainstormEntry.getProjectStats(mongoose.Types.ObjectId(projectId));
    
    const result = { 
      billable: 0, 
      'non-billable': 0, 
      ambiguous: 0, 
      total: 0,
      totalDuration: 0,
      totalIdeas: 0
    };
    
    for (const stat of stats) {
      result[stat._id] = stat.count;
      result.total += stat.count;
      result.totalDuration += stat.totalDuration || 0;
      result.totalIdeas += stat.totalIdeas || 0;
    }
    
    res.json({ ok: true, stats: result });
  } catch (err) {
    console.error('[Brainstorm stats] error:', err);
    res.status(500).json({ error: String(err.message) });
  }
});

/**
 * POST /api/brainstorm/:id/ideas - Add an idea to a brainstorm session
 * Body: { title, content, priority?, tags? }
 */
router.post('/:id/ideas', userAuth, async (req, res) => {
  try {
    const { title, content, priority, tags } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ msg: 'title and content are required' });
    }
    
    const entry = await BrainstormEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ msg: 'Entry not found' });
    
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    
    // Check authorization (owner or participant)
    const isParticipant = entry.participants?.some(p => p.userId.toString() === req.userId);
    if (entry.userId !== currentUser.username && !isParticipant) {
      return res.status(403).json({ msg: 'Unauthorized' });
    }
    
    const ideaData = {
      title: title.trim(),
      content: content.trim(),
      priority: priority || 'medium',
      tags: tags || []
    };
    
    await entry.addIdea(ideaData);
    res.json({ ok: true, entry });
  } catch (err) {
    console.error('[Brainstorm add idea] error:', err);
    res.status(500).json({ error: String(err.message) });
  }
});

/**
 * PATCH /api/brainstorm/:id/ideas/:ideaId - Update an idea's status or priority
 * Body: { status?, priority?, tags? }
 */
router.patch('/:id/ideas/:ideaId', userAuth, async (req, res) => {
  try {
    const { status, priority, tags } = req.body;
    
    const entry = await BrainstormEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ msg: 'Entry not found' });
    
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    
    // Check authorization
    const isParticipant = entry.participants?.some(p => p.userId.toString() === req.userId);
    if (entry.userId !== currentUser.username && !isParticipant) {
      return res.status(403).json({ msg: 'Unauthorized' });
    }
    
    const idea = entry.ideas.id(req.params.ideaId);
    if (!idea) return res.status(404).json({ msg: 'Idea not found' });
    
    if (status) idea.status = status;
    if (priority) idea.priority = priority;
    if (tags) idea.tags = tags;
    idea.updatedAt = new Date();
    
    await entry.save();
    res.json({ ok: true, idea });
  } catch (err) {
    console.error('[Brainstorm update idea] error:', err);
    res.status(500).json({ error: String(err.message) });
  }
});

/**
 * DELETE /api/brainstorm/:id/ideas/:ideaId - Delete an idea
 */
router.delete('/:id/ideas/:ideaId', userAuth, async (req, res) => {
  try {
    const entry = await BrainstormEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ msg: 'Entry not found' });
    
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    
    // Check authorization
    if (entry.userId !== currentUser.username) {
      return res.status(403).json({ msg: 'Unauthorized' });
    }
    
    entry.ideas.pull(req.params.ideaId);
    await entry.save();
    res.json({ ok: true, msg: 'Idea deleted' });
  } catch (err) {
    console.error('[Brainstorm delete idea] error:', err);
    res.status(500).json({ error: String(err.message) });
  }
});

/**
 * POST /api/brainstorm/:id/participants - Add a participant to a brainstorm session
 * Body: { userId, username, role? }
 */
router.post('/:id/participants', userAuth, async (req, res) => {
  try {
    const { userId, username, role } = req.body;
    
    if (!userId || !username) {
      return res.status(400).json({ msg: 'userId and username are required' });
    }
    
    const entry = await BrainstormEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ msg: 'Entry not found' });
    
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    
    // Only owner can add participants
    if (entry.userId !== currentUser.username) {
      return res.status(403).json({ msg: 'Only owner can add participants' });
    }
    
    await entry.addParticipant(userId, username, role || 'contributor');
    res.json({ ok: true, entry });
  } catch (err) {
    console.error('[Brainstorm add participant] error:', err);
    res.status(500).json({ error: String(err.message) });
  }
});

/**
 * POST /api/brainstorm/:id/attachments - Add an attachment/link to a brainstorm session
 * Body: { type, url, name?, description? }
 */
router.post('/:id/attachments', userAuth, async (req, res) => {
  try {
    const { type, url, name, description } = req.body;
    
    if (!type || !url) {
      return res.status(400).json({ msg: 'type and url are required' });
    }
    
    const entry = await BrainstormEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ msg: 'Entry not found' });
    
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    
    // Check authorization
    const isParticipant = entry.participants?.some(p => p.userId.toString() === req.userId);
    if (entry.userId !== currentUser.username && !isParticipant) {
      return res.status(403).json({ msg: 'Unauthorized' });
    }
    
    entry.attachments.push({
      type,
      url: url.trim(),
      name: name || '',
      description: description || ''
    });
    
    await entry.save();
    res.json({ ok: true, entry });
  } catch (err) {
    console.error('[Brainstorm add attachment] error:', err);
    res.status(500).json({ error: String(err.message) });
  }
});

/**
 * PUT /api/brainstorm/:id/complete - Mark a brainstorm session as completed
 * Body: { summary?, actionItems? }
 */
router.put('/:id/complete', userAuth, async (req, res) => {
  try {
    const { summary, actionItems } = req.body;
    
    const entry = await BrainstormEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ msg: 'Entry not found' });
    
    const currentUser = await userModel.findById(req.userId).select('username');
    if (!currentUser) return res.status(401).json({ msg: 'User not found' });
    
    // Check authorization
    if (entry.userId !== currentUser.username) {
      return res.status(403).json({ msg: 'Unauthorized' });
    }
    
    entry.status = 'completed';
    entry.endTime = new Date();
    if (summary) entry.summary = summary;
    if (actionItems) entry.actionItems = actionItems;
    
    await entry.save();
    res.json({ ok: true, entry });
  } catch (err) {
    console.error('[Brainstorm complete] error:', err);
    res.status(500).json({ error: String(err.message) });
  }
});

export default router;
