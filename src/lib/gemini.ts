import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

export interface TriageResponse {
  category: string;
  severityLevel: "Low" | "Medium" | "High" | "Critical" | "Unknown";
  urgencyAlert: string;
  verifiedSummary: string;
  keyFacts: string[];
  actionPlan: string[];
  dispatchEntities: string[];
  rationale: string;
  groundingSources?: { title: string; uri: string }[];
  nearbyResources?: { name: string; address: string; uri: string }[];
}

const API_KEY = "AIzaSyCfZUvu29-Q1MhK9vVcMQkd5j5f7OxeYhc";
const genAI = new GoogleGenerativeAI(API_KEY);

// Use gemini-1.5-flash for maximum cost efficiency and speed
const MODEL_NAME = "gemini-1.5-flash";

const SYSTEM_PROMPT = `You are Aegis, a high-efficiency universal triage bridge designed for societal benefit.
Your mission: convert chaotic, unstructured human input into structured, verified, life-saving action plans.
You process anything—medical notes, disaster reports, accident descriptions, hazard warnings.

You MUST respond with a valid JSON object following this schema:
{
  "category": "domain of incident (Medical, Emergency, Infrastructure, Environmental, etc.)",
  "severityLevel": "one of: Low | Medium | High | Critical | Unknown",
  "urgencyAlert": "one bold short phrase describing the urgency, e.g. 'High urgency — possible cardiac event'",
  "verifiedSummary": "1-2 sentence plain-language summary of the situation",
  "keyFacts": ["short extracted fact chip", "e.g. '45yo male'", "'BP 160/100'", "'Chest pain → left arm'"],
  "actionPlan": ["Step 1 action", "Step 2 action", "...up to 5 steps"],
  "dispatchEntities": ["Agency to notify, e.g. EMS", "Fire Dept"],
  "rationale": "One sentence explaining the severity classification"
}

Critical Instructions:
1. For keyFacts: extract 4-6 specific, short data points from the input.
2. For actionPlan: number each step clearly, make steps actionable and immediate.
3. ENSURE the output is pure JSON.`;

export async function processUnstructuredInput(
  text: string,
  images: { data: string; mimeType: string }[],
  location?: { lat: number; lng: number }
): Promise<TriageResponse> {
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const promptParts: any[] = [SYSTEM_PROMPT];

  if (text.trim()) {
    let locationNote = "";
    if (location) {
      locationNote = ` [User's location: lat ${location.lat.toFixed(4)}, lng ${location.lng.toFixed(4)}]`;
    }
    promptParts.push(`Analyze this and provide a triage plan:${locationNote}\n\n${text}`);
  }

  for (const img of images) {
    promptParts.push({
      inlineData: {
        data: img.data,
        mimeType: img.mimeType,
      },
    });
  }

  if (promptParts.length === 1) {
    throw new Error("No input provided. Please enter text or upload an image.");
  }

  try {
    const result = await model.generateContent(promptParts);
    const response = await result.response;
    const rawContent = response.text();

    if (!rawContent) {
      throw new Error("The AI model returned an empty response.");
    }

    let parsed: TriageResponse;
    try {
      parsed = JSON.parse(rawContent) as TriageResponse;
    } catch (e) {
      console.error("JSON Parse Error:", e, "Raw:", rawContent);
      throw new Error("Failed to parse the triage report. Please try again with clearer input.");
    }

    // Validate required fields
    if (!parsed.category || !parsed.severityLevel || !parsed.verifiedSummary) {
      throw new Error("Incomplete triage response received. Please try again.");
    }

    return parsed;
  } catch (error: any) {
    console.error("Aegis API Error:", error);

    const errorMessage = error.message?.toLowerCase() || "";
    if (errorMessage.includes("quota") || errorMessage.includes("429") || errorMessage.includes("limit")) {
      throw new Error("QUOTA_EXCEEDED");
    }
    if (errorMessage.includes("api key") || errorMessage.includes("401") || errorMessage.includes("403")) {
      throw new Error("Invalid API Key. Please check your Google AI Studio API key.");
    }

    throw new Error(error.message || "Failed to process triage request. Please try again.");
  }
}
