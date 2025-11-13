import process from 'process';
import { GoogleGenerativeAI } from '@google/generative-ai';

function humanDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return '0s';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (secs && parts.length === 0) parts.push(`${secs}s`);
  return parts.join(' ') || '0s';
}

// Gemini caller replacing the previous OpenAI integration
let genAIInstance = null;
function getGenAI() {
  if (genAIInstance) return genAIInstance;
  const GEMINI_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return null;
  genAIInstance = new GoogleGenerativeAI(GEMINI_KEY);
  return genAIInstance;
}

const MODEL_CANDIDATES = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
  'gemini-1.0-pro-latest',
  'gemini-1.0-pro',
  'gemini-pro'
];

const LATEST_ALIASES = [
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest'
];

let discoveredModelsCache = null;
async function listGeminiModels() {
  if (discoveredModelsCache) return discoveredModelsCache;
  const GEMINI_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(GEMINI_KEY)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Gemini listModels failed', resp.status, txt);
      return null;
    }
    const json = await resp.json();
    const entries = (json.models || [])
      .map(m => ({
        name: (m.name || '').split('/').pop(),
        methods: m.supportedGenerationMethods || []
      }))
      .filter(e => e.name);
    discoveredModelsCache = entries;
    return entries;
  } catch (err) {
    console.error('Gemini listModels request failed', err);
    return null;
  }
}

async function callGemini(system, content) {
  const genAI = getGenAI();
  if (!genAI) return null;
  const prompt = `${system}\n\nUSER INPUT:\n${content}`;
  // Build candidate list with: env override > discovered (supports generateContent) > aliases > known fallbacks
  const envModel = (process.env.GEMINI_MODEL || '').trim();
  let candidates = [];
  if (envModel) candidates.push(envModel);
  const available = await listGeminiModels();
  if (available && available.length) {
    const supported = available
      .filter(e => (e.methods || []).includes('generateContent'))
      .map(e => e.name);
    // Prioritize discovered, then add aliases and static list
    candidates.push(...supported);
  }
  candidates.push(...LATEST_ALIASES, ...MODEL_CANDIDATES);
  // De-duplicate while preserving order
  candidates = Array.from(new Set(candidates));

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = (response.text && response.text()) || '';
      if (text && text.trim()) return text.trim();
    } catch (err) {
      // Log and try next model
      const code = err?.status || err?.statusCode;
      const msg = err?.message || String(err);
      console.error(`Gemini model ${modelName} failed${code ? ` [${code}]` : ''}:`, msg);
      // Try the next candidate on 404/400/unsupported
      continue;
    }
  }
  return null;
}

export async function generateDailySummary({ items = [], username = 'user', date }) {
  if (!items || items.length === 0) {
    return `No recorded activity for ${username} on ${date ? new Date(date).toLocaleDateString() : 'the selected date'}.`;
  }

  const lines = items.map((it, idx) => {
    const start = it.start ? new Date(it.start).toLocaleTimeString() : 'unknown';
    const dur = it.duration != null ? humanDuration(it.duration) : (it.end && it.start ? humanDuration((new Date(it.end)-new Date(it.start))/1000) : 'unknown');
    const project = it.project ? ` [${it.project}]` : '';
    return `${idx+1}. ${it.appname} - ${it.apptitle || '-'}${project} (${start}, ${dur})`;
  }).join('\n');

  const system = `You are a helpful assistant that writes short daily check-ins for a user based on a list of activities. Produce 4-8 concise bullet points, start with a one-line summary sentence, then bullets detailing main tasks, time spent, and any suggestions for tomorrow. Keep it professional and ~4-6 short bullets.`;
  const userPrompt = `Date: ${date ? new Date(date).toLocaleDateString() : 'unknown'}\nUsername: ${username}\nActivities:\n${lines}\n\nWrite a short daily check-in using the information above.`;

  const ai = await callGemini(system, userPrompt);
  if (ai) return ai;

  // Fallback deterministic summary
  const agg = {};
  for (const it of items) {
    const key = it.appname || 'unknown';
    agg[key] = (agg[key] || 0) + (it.duration || 0);
  }
  const aggArray = Object.entries(agg).map(([k,v]) => ({ app: k, seconds: v }))
    .sort((a,b)=>b.seconds - a.seconds);
  let totalSec = items.reduce((s,it)=>s + (it.duration || 0),0);
  const topLines = aggArray.slice(0,5).map(a => `- ${a.app}: ${humanDuration(a.seconds)}`);
  const out = [];
  out.push(`Daily check-in for ${username} (${date ? new Date(date).toLocaleDateString() : 'selected date'}):`);
  out.push(`Total tracked time: ${humanDuration(totalSec)}.`);
  out.push('Top activities:');
  out.push(...topLines);
  out.push('Notes: Consider focusing on the top activity or breaking large tasks into smaller chunks tomorrow.');
  return out.join('\n');
}

export async function generateManagerSummary({ reports = [], managerName = 'manager', date }) {
  // reports: [{ username, items, itemsCount, summary }]
  if (!reports || reports.length === 0) return `No team activity for ${managerName} on ${date ? new Date(date).toLocaleDateString() : 'the selected date'}.`;

  // Prepare richer, data-backed context per member. If summary is missing, include key items.
  const memberBlocks = reports.map(r => {
    const header = `-- ${r.username} (${r.itemsCount || 0} items)`;
    const hasSummary = r.summary && String(r.summary).trim().length > 0;
    if (hasSummary) {
      return `${header}:\n${String(r.summary).slice(0, 700)}`;
    }
    const items = Array.isArray(r.items) ? r.items : [];
    if (items.length === 0) return `${header}:\n(no items listed)`;
    const lines = items.slice(0, 12).map((it, idx) => {
      const app = it.appname || 'app';
      const title = it.apptitle || '-';
      const dur = it.duration != null ? humanDuration(it.duration) : '-';
      const proj = it.project ? ` [${it.project}]` : '';
      return `${idx + 1}. ${app} - ${title}${proj} (${dur})`;
    });
    return `${header}:\n${lines.join('\n')}`;
  }).join('\n\n');

  const system = `You produce concise, data-grounded manager daily check-ins. Use the provided per-member activity (summaries and/or item lists). Do not infer "no activity" if items are present. Start with a brief executive summary (3-5 lines), then 1-2 lines per person, then 1-3 actionable recommendations. Keep it professional and specific.`;

  const userPrompt = `Date: ${date ? new Date(date).toLocaleDateString() : 'unknown'}\nManager: ${managerName}\n\nTeam activity context (per member):\n${memberBlocks}\n\nWrite the manager-facing daily check-in.`;

  const ai = await callGemini(system, userPrompt);
  if (ai) return ai;

  // Fallback: aggregate simple totals
  const totals = reports.map(r => ({ username: r.username, totalSec: (r.items || []).reduce((s,it)=>s + (it.duration||0),0)})).sort((a,b)=>b.totalSec-a.totalSec);
  const out = [];
  out.push(`Team daily summary for ${managerName} (${date ? new Date(date).toLocaleDateString() : 'selected date'}):`);
  out.push(`Team members reported: ${reports.length}.`);
  out.push('Top contributors:');
  totals.slice(0,5).forEach(t => out.push(`- ${t.username}: ${humanDuration(t.totalSec)}`));
  out.push('Per-member quick notes:');
  reports.forEach(r => out.push(`- ${r.username}: ${r.itemsCount} items, total ${humanDuration((r.items||[]).reduce((s,it)=>s + (it.duration||0),0))}`));
  out.push('Recommendation: Review low contributors and unblock where needed.');
  return out.join('\n');
}

export default { generateDailySummary, generateManagerSummary };
