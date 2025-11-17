import express from 'express';
import ClassificationRule from '../models/classificationRule.model.js';
import userAuth from '../middleware/userAuth.js';
import userModel from '../models/userModel.js';
import TimeEntry from '../models/TimeEntry.js';

const router = express.Router();

// Helper: check if current user is admin/manager. For now, require project creator elsewhere; here we allow only verified accounts.
async function isAdminUser(req) {
  if (!req.userId) return false;
  const u = await userModel.findById(req.userId).select('isAccountVerified');
  // Simple heuristic: only verified accounts can edit rules. You can replace with role-based logic later.
  return !!(u && u.isAccountVerified);
}

// GET /api/classification-rules - list rules (optionally filter by source)
router.get('/', userAuth, async (req, res) => {
  try {
    const { source, q } = req.query;
    const filter = {};
    if (source) filter.source = source;
    if (q) filter.appName = { $regex: q, $options: 'i' };
    const rules = await ClassificationRule.find(filter).sort({ updatedAt: -1 }).limit(100).exec();
    res.json(rules);
  } catch (err) {
    console.error('list rules error', err);
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /api/classification-rules/:appName - update or create rule (manual override)
router.patch('/:appName', userAuth, async (req, res) => {
  try {
    if (!await isAdminUser(req)) return res.status(403).json({ msg: 'Only verified accounts can edit rules' });
    const { appName } = req.params;
    const { classification, notes } = req.body;
    if (!classification || !['billable','non-billable','ambiguous'].includes(classification)) return res.status(400).json({ msg: 'classification required' });
    const rule = await ClassificationRule.findOneAndUpdate({ appName }, { classification, source: 'manual', notes }, { upsert: true, new: true, setDefaultsOnInsert: true });

    // Also apply this manual override to existing TimeEntry appointments that match this appName
    try {
      const entries = await TimeEntry.find({ 'appointments.appname': appName }).populate('project', 'isBillable').exec();
      let changed = 0;
      for (const e of entries) {
        let modified = false;
        const appts = e.appointments || [];
        for (const apt of appts) {
          if (!apt) continue;
          if ((apt.appname || '') === appName) {
            apt.suggestedCategory = classification;
            // If classification is 'billable', respect the project's isBillable flag if available
            if (classification === 'billable') {
              apt.isBillable = !!(e.project && e.project.isBillable);
            } else {
              apt.isBillable = false;
            }
            modified = true;
          }
        }
        if (modified) {
          await e.save();
          changed++;
        }
      }
      console.log(`Applied classification rule for app ${appName} to ${changed} time entries`);
    } catch (applyErr) {
      console.error('Failed to apply classification rule to existing entries', applyErr);
      // Don't fail the request — rule was persisted; log the error for investigation
    }

    res.json(rule);
  } catch (err) {
    console.error('update rule error', err);
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/classification-rules/:appName - remove a rule
router.delete('/:appName', userAuth, async (req, res) => {
  try {
    if (!await isAdminUser(req)) return res.status(403).json({ msg: 'Only verified accounts can delete rules' });
    const { appName } = req.params;
    await ClassificationRule.deleteOne({ appName });
    res.json({ ok: true });
  } catch (err) {
    console.error('delete rule error', err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
