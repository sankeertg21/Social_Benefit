import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processUnstructuredInput } from './gemini';

// Mock the global fetch for OpenRouter
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('processUnstructuredInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{
          message: {
            content: JSON.stringify({
              category: "Medical",
              severityLevel: "High",
              urgencyAlert: "High urgency — acute symptoms",
              verifiedSummary: "Test summary",
              keyFacts: ["45yo male"],
              actionPlan: ["Step 1"],
              dispatchEntities: ["EMS"],
              rationale: "Test rationale"
            })
          }
        }]
      })
    });
  });

  it('should throw an error if no input is provided', async () => {
    await expect(processUnstructuredInput('', [])).rejects.toThrow('No input provided');
  });

  it('should return a structured triage response for valid text input', async () => {
    const result = await processUnstructuredInput('Help, my chest hurts', []);
    expect(result).toHaveProperty('category');
    expect(result.severityLevel).toBe('High');
    expect(result.actionPlan).toContain('Step 1');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should handle image input correctly', async () => {
    const images = [{ data: 'base64data', mimeType: 'image/png' }];
    const result = await processUnstructuredInput('', images);
    expect(result).toHaveProperty('category');
    expect(result.verifiedSummary).toBe('Test summary');
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Quota exceeded')
    });
    await expect(processUnstructuredInput('Help', [])).rejects.toThrow('QUOTA_EXCEEDED');
  });
});
