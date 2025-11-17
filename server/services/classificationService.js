import OpenAI from "openai";
import ClassificationRule from "../models/classificationRule.model.js";
import { normalizeAppName } from "../utils/nameNormalizer.js";

// Initialize Groq
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

/**
 * Calls the Groq API to get a classification for an ambiguous app.
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
    const completion = await client.chat.completions.create({
      model: "llama-3.1-70b-versatile",
      messages: [
        { role: "system", content: "You are a productivity expert that classifies computer activities." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0].message.content.trim().toLowerCase();
    // For debugging: log AI outputs for first-time apps (comment out in prod)
    // console.debug('[AI] raw classification output for', normalizedName, ':', raw);

    // Robust parsing: look for the word 'billable' or 'non-billable' in the AI output.
    let classification = 'ambiguous';
    if (/\bbillable\b/.test(raw) && !/non-?billable/.test(raw)) {
      classification = 'billable';
    } else if (/\bnon-?billable\b/.test(raw) && !/\bbillable\b/.test(raw)) {
      classification = 'non-billable';
    } else {
      // If parsing fails, don't force a 'non-billable' conclusion. Mark ambiguous so callers can decide.
      console.warn('[AI] Unexpected classification response, marking as ambiguous:', raw.slice(0,200));
      classification = 'ambiguous';
    }

    // Only persist clear rules (billable / non-billable). Save source:'ai' and optional confidence if model returns it.
    if (classification === 'billable' || classification === 'non-billable') {
      try {
        const newRule = new ClassificationRule({
          appName: normalizedName,
          classification: classification,
          source: 'ai'
        });
        await newRule.save();
        console.log(`[AI] New rule saved: ${normalizedName} -> ${classification}`);
      } catch (dbErr) {
        // If duplicate key or other error, attempt to update existing rule's classification and source
        if (dbErr && dbErr.code === 11000) {
          try {
            await ClassificationRule.findOneAndUpdate({ appName: normalizedName }, { classification: classification, source: 'ai' });
            console.log(`[AI] Existing rule updated: ${normalizedName} -> ${classification}`);
          } catch (updErr) {
            console.error('[AI] Failed to update existing classification rule:', updErr);
          }
        } else {
          console.error('[AI] Failed to save new classification rule:', dbErr);
        }
      }
    }

    return classification;

  } catch (err) {
    console.error("Error calling Groq API:", err);
    // Don't default to non-billable on error — mark ambiguous so higher-level logic can fall back or handle it.
    return 'ambiguous';
  }
}

/**
 * Main service function. Checks the DB first, then calls AI if needed.
 * @param {object} activity - The appointment object { appname, apptitle }
 * @returns {string} - 'billable' or 'non-billable'
 */
export const classifyActivity = async (activity) => {
  try {
    // If no activity provided, return ambiguous rather than force non-billable.
    if (!activity) return 'ambiguous';

    // If appname is missing but apptitle present, we still want to try AI classification.
    const appNameToNormalize = activity.appname || activity.apptitle || 'unknown';
    const normalizedName = normalizeAppName(appNameToNormalize);

    // 1. Check our database for an existing rule
    const rule = await ClassificationRule.findOne({ appName: normalizedName });

    if (rule) {
      // 2. Found a rule in the DB
      if (rule.classification === 'ambiguous') {
        // It's ambiguous (like Chrome), so call the AI to disambiguate at runtime.
        return await getAIClassification(activity, normalizedName);
      }
      // Found a clear rule (e.g., 'billable' or 'non-billable'), so return it.
      return rule.classification;
    }

    // 3. No rule found. Call the AI to classify. Caller should handle 'ambiguous' return value.
    return await getAIClassification(activity, normalizedName);
  } catch (error) {
    console.error('[ClassificationService] Error during classification:', error.message);
    // On any database or other unexpected error, default to non-billable
    return 'non-billable';
  }
};