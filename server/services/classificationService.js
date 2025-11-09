import { GoogleGenerativeAI } from "@google/generative-ai";
import ClassificationRule from "../models/classificationRule.model.js";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

/**
 * Normalizes an application name for consistent lookups.
 * 1. Converts to lowercase.
 * 2. Removes the .exe extension.
 * 3. Removes common paths, focusing on the app name.
 */
function normalizeAppName(appName) {
  if (!appName) return 'unknown';
  
  // Get just the executable/app name from a path
  const app = appName.split('\\').pop().split('/').pop();
  
  return app.toLowerCase().replace('.exe', '').trim();
}

/**
 * Calls the Gemini API to get a classification for an ambiguous app.
 */
async function getAIClassification(activity, normalizedName) {
  const prompt = `
    You are a productivity expert. Classify the following computer activity as "billable" or "non-billable" based on the application name and window title.
    - "billable" means professional work (coding, design, client email, documentation, etc.).
    - "non-billable" means personal use (social media, games, music, personal browsing).
    
    Application: "${activity.appname}"
    Window Title: "${activity.apptitle}"
    
    Respond with a single word: "billable" or "non-billable".
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let classification = response.text().trim().toLowerCase();

    // Validate the response
    if (classification !== 'billable' && classification !== 'non-billable') {
      classification = 'non-billable'; // Default to non-billable on bad AI response
    }

    // --- THIS IS THE "UPDATE DICTIONARY" STEP ---
    // The AI found a new rule, so we save it to the DB to prevent future API calls.
    const newRule = new ClassificationRule({
      appName: normalizedName,
      classification: classification
    });
    await newRule.save();
    console.log(`[AI] New rule saved: ${normalizedName} -> ${classification}`);
    // ---------------------------------------------
    
    return classification;

  } catch (err) {
    console.error("Error calling Gemini API:", err);
    return 'non-billable'; // Default to non-billable on API error
  }
}

/**
 * Main service function. Checks the DB first, then calls AI if needed.
 * @param {object} activity - The appointment object { appname, apptitle }
 * @returns {string} - 'billable' or 'non-billable'
 */
export const classifyActivity = async (activity) => {
  if (!activity || !activity.appname) return 'non-billable';

  const normalizedName = normalizeAppName(activity.appname);

  // 1. Check our database for an existing rule
  const rule = await ClassificationRule.findOne({ appName: normalizedName });

  if (rule) {
    // 2. Found a rule in the DB
    if (rule.classification === 'ambiguous') {
      // It's ambiguous (like Chrome), so we MUST call the AI
      return await getAIClassification(activity, normalizedName);
    }
    // Found a clear rule (e.g., 'billable' or 'non-billable'), so we're done.
    return rule.classification;
  }
  
  // 3. No rule found. This is a new app. Call the AI.
  return await getAIClassification(activity, normalizedName);
};