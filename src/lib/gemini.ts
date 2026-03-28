// OpenRouter API integration — replaces the native @google/genai SDK
// Uses fetch with OpenAI-compatible format that OpenRouter supports

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

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.0-flash-001";

const SYSTEM_PROMPT = `You are Aegis, a high-efficiency universal triage bridge designed for societal benefit.
Your mission: convert chaotic, unstructured human input into structured, verified, life-saving action plans.
You process anything—medical notes, disaster reports, accident descriptions, hazard warnings.

You MUST respond with ONLY a valid JSON object. No markdown, no explanation, just raw JSON:
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

For keyFacts: extract 4-6 specific, short data points from the input (patient age, vital signs, symptoms, onset time, relevant history, location details, etc.).
For actionPlan: number each step clearly, make steps actionable and immediate.`;

export async function processUnstructuredInput(
  text: string,
  images: { data: string; mimeType: string }[],
  location?: { lat: number; lng: number }
): Promise<TriageResponse> {
  const apiKey = "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";

  // Build the user message content
  const userContent: any[] = [];

  if (text.trim()) {
    let locationNote = "";
    if (location) {
      locationNote = ` [User's location: lat ${location.lat.toFixed(4)}, lng ${location.lng.toFixed(4)}]`;
    }
    userContent.push({
      type: "text",
      text: `Analyze this and provide a triage plan:${locationNote}\n\n${text}`,
    });
  }

  for (const img of images) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${img.mimeType};base64,${img.data}`,
      },
    });
  }

  if (userContent.length === 0) {
    throw new Error("No input provided. Please enter text or upload an image.");
  }

  const requestBody = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 1000,
  };

  try {
    const response = await fetch(OPENROUTER_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "Aegis Universal Triage Bridge",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter API error response:", errText);
      const lower = errText.toLowerCase();

      if (response.status === 429 || lower.includes("quota") || lower.includes("rate limit")) {
        throw new Error("QUOTA_EXCEEDED");
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid API Key. Please check your OpenRouter API key.");
      }
      if (response.status === 404) {
        throw new Error(`Model not found. Please check the OpenRouter model name.`);
      }
      throw new Error(`API request failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    console.log("OpenRouter raw response:", data);

    const rawContent = data?.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error("The AI model returned an empty response.");
    }

    // Strip any accidental markdown wrappers
    const jsonMatch = rawContent.match(/```json\n([\s\S]*?)\n```/) || rawContent.match(/```\n([\s\S]*?)\n```/);
    const cleanJson = jsonMatch ? jsonMatch[1] : rawContent;

    let parsed: TriageResponse;
    try {
      parsed = JSON.parse(cleanJson) as TriageResponse;
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

    // Re-throw already-formatted errors
    if (
      error.message === "QUOTA_EXCEEDED" ||
      error.message?.startsWith("Invalid API Key") ||
      error.message?.startsWith("API Key is missing") ||
      error.message?.startsWith("Model not found") ||
      error.message?.startsWith("No input") ||
      error.message?.startsWith("Failed to parse") ||
      error.message?.startsWith("Incomplete triage")
    ) {
      throw error;
    }

    throw new Error(error.message || "Failed to process triage request. Please try again.");
  }
}
