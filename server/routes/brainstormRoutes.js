import express from 'express';
import userAuth from '../middleware/userAuth.js';
import userModel from '../models/userModel.js';
import BrainstormEntry from '../models/BrainstormEntry.js';
import Project from '../models/ProjectModel.js';
import { classifyBrainstormEntry } from '../services/brainstormService.js';

const router = express.Router();

/**
 * POST /api/brainstorm - Create brainstorm entry/entries and classify them
 * Body: { projectId, taskId?, description } OR { projectId, taskId?, descriptions: [] }
 */
router.post('/', userAuth, async (req, res) => {
  try {
    const { projectId, taskId, description, descriptions } = req.body;
    let { durationSeconds } = req.body;
    
    // Support both single description and multiple descriptions
    const descList = descriptions && Array.isArray(descriptions) 
      ? descriptions 
      : (description ? [description] : []);
    
    if (!projectId || descList.length === 0) {
      return res.status(400).json({ msg: 'projectId and description(s) are required' });
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
    
    // Normalize duration (optional field from client)
    const parsedDuration = Number(durationSeconds);
    const safeDuration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? Math.floor(parsedDuration) : null;

    // Process all descriptions
    const results = [];
    for (const desc of descList) {
      if (!desc || !desc.trim()) continue;
      
      // Classify the brainstorm entry
      const classResult = await classifyBrainstormEntry(desc, projectId, taskId);
      
      // Create entry
      const entry = new BrainstormEntry({
        userId: username,
        project: projectId,
        taskId: taskId || undefined,
        description: desc.trim(),
        classification: classResult.classification,
        confidence: classResult.confidence,
        reasoning: classResult.reasoning,
        durationSeconds: safeDuration,
        sessionCount: safeDuration ? 1 : undefined
      });
      
      const savedEntry = await entry.save();
      const populatedEntry = await savedEntry.populate('project', 'ProjectName');
      
      results.push({
        entry: populatedEntry,
        classification: classResult.classification,
        confidence: classResult.confidence,
        reasoning: classResult.reasoning
      });
    }
    
    // Return single or multiple based on input
    if (descriptions && Array.isArray(descriptions)) {
      res.status(201).json({
        ok: true,
        count: results.length,
        entries: results
      });
    } else {
      // Single entry - maintain backward compatibility
      const result = results[0];
      res.status(201).json({
        ok: true,
        entry: result.entry,
        classification: result.classification,
        confidence: result.confidence,
        reasoning: result.reasoning
      });
    }
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
    
    // Aggregate stats
    const stats = await BrainstormEntry.aggregate([
      { $match: { project: project._id } },
      {
        $group: {
          _id: '$classification',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const result = { billable: 0, 'non-billable': 0, ambiguous: 0, total: 0 };
    for (const stat of stats) {
      result[stat._id] = stat.count;
      result.total += stat.count;
    }
    
    res.json({ ok: true, stats: result });
  } catch (err) {
    console.error('[Brainstorm stats] error:', err);
    res.status(500).json({ error: String(err.message) });
  }
});

export default router;
