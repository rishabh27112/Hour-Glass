import process from 'process';
import Project from '../models/ProjectModel.js';

/**
 * Classify brainstorm entry using Groq AI.
 * Examines description + assignedTask + project description to determine billability.
 * 
 * Criteria:
 * - Billable: Directly contributes to assigned task, aligns with project goals, supports deliverables, client-facing
 * - Non-billable: General ideation without task link, personal learning, exploration unrelated to project
 */
async function callGroqForBrainstorm(description, taskDescription, projectName, projectDescription) {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) {
    console.warn('[Brainstorm] No GROQ_API_KEY; returning ambiguous');
    return { classification: 'ambiguous', confidence: 0, reasoning: 'API key not configured' };
  }

  const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const prompt = `
You are a productivity classifier. Determine if a brainstorm session is billable or non-billable.

CRITERIA:
Billable:
  - Directly contributes to an assigned task or project deliverable
  - Aligns with explicit project goals and client requirements
  - Produces actionable insights for the assigned work
  - Collaboratively develops solutions for project needs
  - Supports existing scope and timeline

Non-Billable:
  - General ideation or exploration without specific task assignment
  - Personal skill development or learning unrelated to immediate project goals
  - Informal brainstorming not linked to a deliverable
  - Speculative research beyond project scope
  - Social or team-building activities

CONTEXT:
Project: "${projectName || 'N/A'}"
Project Description: "${projectDescription || 'N/A'}"
Assigned Task: "${taskDescription || 'No specific task'}"

BRAINSTORM DESCRIPTION:
${description}

Respond in this exact format:
CLASSIFICATION: [billable|non-billable]
CONFIDENCE: [0.0-1.0]
REASONING: [1-2 sentence explanation]
`;

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 300
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[Brainstorm] Groq API error:', resp.status, errText);
      throw new Error(`Groq API ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error('No response from Groq API');
    }

    // Parse response
    const classMatch = text.match(/CLASSIFICATION:\s*(billable|non-billable)/i);
    const confMatch = text.match(/CONFIDENCE:\s*([\d.]+)/);
    const reasonMatch = text.match(/REASONING:\s*(.+?)(?:\n|$)/);

    const classification = classMatch ? classMatch[1].toLowerCase() : 'ambiguous';
    const confidence = confMatch ? Math.min(1, Math.max(0, parseFloat(confMatch[1]))) : 0.5;
    const reasoning = reasonMatch ? reasonMatch[1].trim() : text.slice(0, 200);

    return {
      classification,
      confidence,
      reasoning,
      rawResponse: text
    };
  } catch (err) {
    console.error('[Brainstorm] Groq API error:', err.message);
    return {
      classification: 'ambiguous',
      confidence: 0,
      reasoning: `API error: ${err.message}`
    };
  }
}

export async function classifyBrainstormEntry(description, projectId, taskId = null) {
  if (!description || !description.trim()) {
    return { classification: 'ambiguous', confidence: 0, reasoning: 'Empty description' };
  }

  // Fetch project details
  let projectName = 'Unknown';
  let projectDescription = '';
  try {
    const proj = await Project.findById(projectId).select('ProjectName Description').exec();
    if (proj) {
      projectName = proj.ProjectName;
      projectDescription = proj.Description || '';
    }
  } catch (err) {
    console.error('[Brainstorm] Failed to fetch project:', err.message);
  }

  // Fetch task details if provided
  let taskDescription = '';
  if (taskId) {
    try {
      const proj = await Project.findById(projectId).select('tasks').exec();
      const task = proj?.tasks?.find(t => t._id.toString() === taskId.toString());
      if (task) {
        taskDescription = task.description || task.title || '';
      }
    } catch (err) {
      console.error('[Brainstorm] Failed to fetch task:', err.message);
    }
  }

  // Call Groq
  return await callGroqForBrainstorm(description, taskDescription, projectName, projectDescription);
}

export default { classifyBrainstormEntry, callGroqForBrainstorm };
