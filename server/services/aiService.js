import process from 'process';

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

async function callOpenAI(system, content) {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return null;
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content }
        ],
        temperature: 0.35,
        max_tokens: 700,
      })
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error('OpenAI error', resp.status, txt);
      return null;
    }
    const json = await resp.json();
    return json?.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('OpenAI request failed', err);
    return null;
  }
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

  const ai = await callOpenAI(system, userPrompt);
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

  const summaryLines = reports.map(r => `-- ${r.username} (${r.itemsCount} items):\n${(r.summary || '').slice(0,400)}`).join('\n\n');

  const system = `You are an assistant that produces a concise manager-facing daily check-in summarizing what each team member did today. Provide an executive 3-5 line summary at top, then a short per-person note (1-2 lines) and finally recommendations for the manager (1-3 bullets). Keep it concise and actionable.`;

  const userPrompt = `Date: ${date ? new Date(date).toLocaleDateString() : 'unknown'}\nManager: ${managerName}\nTeam reports:\n${summaryLines}\n\nProduce the manager-facing daily check-in.`;

  const ai = await callOpenAI(system, userPrompt);
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
