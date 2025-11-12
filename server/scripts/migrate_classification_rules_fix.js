// Migration helper: mark low-confidence or problematic 'non-billable' rules as 'ambiguous'
// Usage: node migrate_classification_rules_fix.js
// IMPORTANT: Run in a safe environment and review results before applying in production.

import mongoose from 'mongoose';
import ClassificationRule from '../models/classificationRule.model.js';

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/hourglass';

(async function main(){
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');

  // Heuristic: convert rules that were saved with no source (legacy) and classification === 'non-billable' to 'ambiguous'
  // Also convert rules where appName is very generic like 'chrome', 'edge', 'firefox'
  const generic = ['chrome','edge','firefox','msedge','opera','safari','internet explorer','iexplore'];

  const legacyFilter = { source: { $exists: false }, classification: 'non-billable' };
  const genericFilter = { appName: { $in: generic } };

  const res1 = await ClassificationRule.updateMany(legacyFilter, { $set: { classification: 'ambiguous', notes: 'Migrated: legacy non-billable -> ambiguous for manual review' } });
  console.log('Legacy conversions:', res1.nModified || res1.modifiedCount, 'documents modified');

  const res2 = await ClassificationRule.updateMany(genericFilter, { $set: { classification: 'ambiguous', notes: 'Migrated: generic browser app -> ambiguous for manual review' } });
  console.log('Generic app conversions:', res2.nModified || res2.modifiedCount, 'documents modified');

  await mongoose.disconnect();
  console.log('Migration complete');
})();
