import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/mongodb.js';
import userModel from '../models/userModel.js';

const sanitize = (s) => s.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0,20);

async function uniqueUsername(base) {
  let candidate = sanitize(base || 'user');
  let i = 0;
  for (let attempts = 0; attempts < 200; attempts++) {
    const withSuffix = i === 0 ? candidate : `${candidate}`.slice(0, Math.max(1, 20 - String(i).length - 1)) + `_${i}`;
    const exists = await userModel.findOne({ username: withSuffix });
    if (!exists) return withSuffix;
    i++;
  }
  return `${candidate}_${Date.now().toString().slice(-4)}`.slice(0,20);
}

async function run() {
  await connectDB();
  const users = await userModel.find({ $or: [{ username: { $exists: false } }, { username: '' }, { username: null }] });
  console.log(`Found ${users.length} users without username`);
  for (const u of users) {
    const base = (u.email?.split('@')[0]) || (u.name || 'user');
    u.username = await uniqueUsername(base);
    await u.save();
    console.log(`Set username for ${u.email}: ${u.username}`);
  }
  await mongoose.connection.close();
  console.log('Done');
}

run().catch(err => { console.error(err); process.exit(1); });
