import { describe, it, expect, vi } from 'vitest';
import { processUnstructuredInput } from './gemini';

// Mock the GoogleGenAI SDK
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            category: "Medical",
            severityLevel: "High",
            verifiedSummary: "Test summary",
            actionPlan: ["Step 1"],
            dispatchEntities: ["EMS"],
            rationale: "Test rationale"
          })
        })
      }
    },
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      ARRAY: 'ARRAY'
    }
  };
});

describe('processUnstructuredInput', () => {
  it('should throw an error if no input is provided', async () => {
    await expect(processUnstructuredInput('', [])).rejects.toThrow('No input provided');
  });

  it('should return a structured triage response for valid text input', async () => {
    const result = await processUnstructuredInput('Help, my chest hurts', []);
    expect(result).toHaveProperty('category');
    expect(result.severityLevel).toBe('High');
    expect(result.actionPlan).toContain('Step 1');
  });

  it('should handle image input correctly', async () => {
    const images = [{ data: 'base64data', mimeType: 'image/png' }];
    const result = await processUnstructuredInput('', images);
    expect(result).toHaveProperty('category');
    expect(result.verifiedSummary).toBe('Test summary');
  });

  it('should handle both text and image input', async () => {
    const images = [{ data: 'base64data', mimeType: 'image/png' }];
    const result = await processUnstructuredInput('Patient has a rash', images);
    expect(result).toHaveProperty('category');
  });
});
