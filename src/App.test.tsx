import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import * as gemini from './lib/gemini';
import * as firebase from './lib/firebase';

// Mock the services
vi.mock('./lib/gemini', () => ({
  processUnstructuredInput: vi.fn(),
}));

vi.mock('./lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  googleProvider: {},
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback(null);
    return () => {};
  }),
  collection: vi.fn(() => ({ id: 'mock-collection' })),
  addDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

// Mock browser-image-compression
vi.mock('browser-image-compression', () => ({
  default: vi.fn().mockResolvedValue(new File([], 'test.jpg')),
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the header and main title', () => {
    render(<App />);
    // Use getAllByText and check the first one or use a more specific query
    expect(screen.getAllByText(/Aegis/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Universal Triage/i)).toBeInTheDocument();
  });

  it('renders the input section', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Unstructured Input/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g., 'Patient 45yo male/i)).toBeInTheDocument();
  });

  it('shows the sign in button when not authenticated', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('disables the analyze button when input is empty', () => {
    render(<App />);
    const analyzeBtn = screen.getByRole('button', { name: /Analyze & Triage/i });
    expect(analyzeBtn).toBeDisabled();
  });

  it('enables the analyze button when text is entered', () => {
    render(<App />);
    const textarea = screen.getByPlaceholderText(/e.g., 'Patient 45yo male/i);
    fireEvent.change(textarea, { target: { value: 'Test emergency' } });
    const analyzeBtn = screen.getByRole('button', { name: /Analyze & Triage/i });
    expect(analyzeBtn).not.toBeDisabled();
  });

  it('calls processUnstructuredInput when analyze button is clicked', async () => {
    const mockResponse = {
      category: 'Medical',
      severityLevel: 'High',
      verifiedSummary: 'Test summary',
      actionPlan: ['Step 1'],
      dispatchEntities: ['EMS'],
      rationale: 'Test rationale',
    };
    (gemini.processUnstructuredInput as any).mockResolvedValue(mockResponse);

    render(<App />);
    const textarea = screen.getByPlaceholderText(/e.g., 'Patient 45yo male/i);
    fireEvent.change(textarea, { target: { value: 'Test emergency' } });
    
    const analyzeBtn = screen.getByRole('button', { name: /Analyze & Triage/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(gemini.processUnstructuredInput).toHaveBeenCalled();
      // Look for the category in the result section specifically
      const categoryElements = screen.getAllByText(/Medical/i);
      expect(categoryElements.length).toBeGreaterThan(1); // One in desc, one in result
      expect(screen.getByText(/High SEVERITY/i)).toBeInTheDocument();
    });
  });

  it('automatically saves to history when user is authenticated', async () => {
    const mockUser = { uid: 'user123', displayName: 'Test User', photoURL: 'test.jpg' };
    (firebase.onAuthStateChanged as any).mockImplementation((auth: any, callback: any) => {
      callback(mockUser);
      return () => {};
    });

    const mockResponse = {
      category: 'Medical',
      severityLevel: 'High',
      verifiedSummary: 'Test summary',
      actionPlan: ['Step 1'],
      dispatchEntities: ['EMS'],
      rationale: 'Test rationale',
    };
    (gemini.processUnstructuredInput as any).mockResolvedValue(mockResponse);

    render(<App />);
    
    const textarea = screen.getByPlaceholderText(/e.g., 'Patient 45yo male/i);
    fireEvent.change(textarea, { target: { value: 'Test emergency' } });
    
    const analyzeBtn = screen.getByRole('button', { name: /Analyze & Triage/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(firebase.addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user123',
          category: 'Medical',
        })
      );
    });
  });
});
