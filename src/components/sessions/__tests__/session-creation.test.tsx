import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionCreation } from '../session-creation';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock API calls
const mockCreateSession = jest.fn();
jest.mock('@/lib/api', () => ({
  createSession: (...args: any[]) => mockCreateSession(...args),
}));

describe('SessionCreation', () => {
  const mockOnSessionCreated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSession.mockResolvedValue({
      id: 'session-123',
      title: 'Test Session',
      description: 'Test Description',
      language: 'JAVASCRIPT',
      maxParticipants: 10,
      isPublic: true,
    });
  });

  it('renders session creation form', () => {
    render(<SessionCreation onSessionCreated={mockOnSessionCreated} />);
    
    expect(screen.getByText(/create new session/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/session title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/programming language/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/max participants/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/public session/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create session/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<SessionCreation onSessionCreated={mockOnSessionCreated} />);
    
    const createButton = screen.getByRole('button', { name: /create session/i });
    await user.click(createButton);
    
    expect(screen.getByText(/title is required/i)).toBeInTheDocument();
  });

  it('creates session with valid data', async () => {
    const user = userEvent.setup();
    render(<SessionCreation onSessionCreated={mockOnSessionCreated} />);
    
    // Fill in the form
    await user.type(screen.getByLabelText(/session title/i), 'JavaScript Basics');
    await user.type(screen.getByLabelText(/description/i), 'Learn JavaScript fundamentals');
    await user.selectOptions(screen.getByLabelText(/programming language/i), 'JAVASCRIPT');
    await user.clear(screen.getByLabelText(/max participants/i));
    await user.type(screen.getByLabelText(/max participants/i), '15');
    await user.click(screen.getByLabelText(/public session/i));
    
    // Submit the form
    await user.click(screen.getByRole('button', { name: /create session/i }));
    
    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith({
        title: 'JavaScript Basics',
        description: 'Learn JavaScript fundamentals',
        language: 'JAVASCRIPT',
        maxParticipants: 15,
        isPublic: true,
      });
    });
    
    expect(mockOnSessionCreated).toHaveBeenCalledWith({
      id: 'session-123',
      title: 'Test Session',
      description: 'Test Description',
      language: 'JAVASCRIPT',
      maxParticipants: 10,
      isPublic: true,
    });
  });

  it('handles different programming languages', async () => {
    const user = userEvent.setup();
    render(<SessionCreation onSessionCreated={mockOnSessionCreated} />);
    
    const languageSelect = screen.getByLabelText(/programming language/i);
    
    // Test Python selection
    await user.selectOptions(languageSelect, 'PYTHON');
    expect(screen.getByDisplayValue('PYTHON')).toBeInTheDocument();
    
    // Test C# selection
    await user.selectOptions(languageSelect, 'CSHARP');
    expect(screen.getByDisplayValue('CSHARP')).toBeInTheDocument();
  });

  it('validates max participants range', async () => {
    const user = userEvent.setup();
    render(<SessionCreation onSessionCreated={mockOnSessionCreated} />);
    
    const maxParticipantsInput = screen.getByLabelText(/max participants/i);
    
    // Test minimum value
    await user.clear(maxParticipantsInput);
    await user.type(maxParticipantsInput, '0');
    await user.click(screen.getByRole('button', { name: /create session/i }));
    
    expect(screen.getByText(/must be at least 1/i)).toBeInTheDocument();
    
    // Test maximum value
    await user.clear(maxParticipantsInput);
    await user.type(maxParticipantsInput, '101');
    await user.click(screen.getByRole('button', { name: /create session/i }));
    
    expect(screen.getByText(/cannot exceed 100/i)).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    mockCreateSession.mockRejectedValue(new Error('Network error'));
    
    render(<SessionCreation onSessionCreated={mockOnSessionCreated} />);
    
    // Fill in valid data
    await user.type(screen.getByLabelText(/session title/i), 'Test Session');
    await user.click(screen.getByRole('button', { name: /create session/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/failed to create session/i)).toBeInTheDocument();
    });
    
    expect(mockOnSessionCreated).not.toHaveBeenCalled();
  });

  it('shows loading state during creation', async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: any) => void;
    const promise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    mockCreateSession.mockReturnValue(promise);
    
    render(<SessionCreation onSessionCreated={mockOnSessionCreated} />);
    
    await user.type(screen.getByLabelText(/session title/i), 'Test Session');
    await user.click(screen.getByRole('button', { name: /create session/i }));
    
    expect(screen.getByText(/creating session/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /creating session/i })).toBeDisabled();
    
    // Resolve the promise
    resolvePromise!({
      id: 'session-123',
      title: 'Test Session',
    });
    
    await waitFor(() => {
      expect(screen.queryByText(/creating session/i)).not.toBeInTheDocument();
    });
  });

  it('resets form after successful creation', async () => {
    const user = userEvent.setup();
    render(<SessionCreation onSessionCreated={mockOnSessionCreated} />);
    
    // Fill in the form
    await user.type(screen.getByLabelText(/session title/i), 'Test Session');
    await user.type(screen.getByLabelText(/description/i), 'Test Description');
    
    // Submit the form
    await user.click(screen.getByRole('button', { name: /create session/i }));
    
    await waitFor(() => {
      expect(mockOnSessionCreated).toHaveBeenCalled();
    });
    
    // Check that form is reset
    expect(screen.getByLabelText(/session title/i)).toHaveValue('');
    expect(screen.getByLabelText(/description/i)).toHaveValue('');
  });

  it('handles cancel action', async () => {
    const user = userEvent.setup();
    const mockOnCancel = jest.fn();
    
    render(<SessionCreation onSessionCreated={mockOnSessionCreated} onCancel={mockOnCancel} />);
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('validates title length', async () => {
    const user = userEvent.setup();
    render(<SessionCreation onSessionCreated={mockOnSessionCreated} />);
    
    // Test title too short
    await user.type(screen.getByLabelText(/session title/i), 'ab');
    await user.click(screen.getByRole('button', { name: /create session/i }));
    
    expect(screen.getByText(/title must be at least 3 characters/i)).toBeInTheDocument();
    
    // Test title too long
    const longTitle = 'a'.repeat(101);
    await user.clear(screen.getByLabelText(/session title/i));
    await user.type(screen.getByLabelText(/session title/i), longTitle);
    await user.click(screen.getByRole('button', { name: /create session/i }));
    
    expect(screen.getByText(/title cannot exceed 100 characters/i)).toBeInTheDocument();
  });

  it('validates description length', async () => {
    const user = userEvent.setup();
    render(<SessionCreation onSessionCreated={mockOnSessionCreated} />);
    
    const longDescription = 'a'.repeat(501);
    await user.type(screen.getByLabelText(/session title/i), 'Valid Title');
    await user.type(screen.getByLabelText(/description/i), longDescription);
    await user.click(screen.getByRole('button', { name: /create session/i }));
    
    expect(screen.getByText(/description cannot exceed 500 characters/i)).toBeInTheDocument();
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<SessionCreation onSessionCreated={mockOnSessionCreated} />);
    
    // Tab through form elements
    await user.tab();
    expect(screen.getByLabelText(/session title/i)).toHaveFocus();
    
    await user.tab();
    expect(screen.getByLabelText(/description/i)).toHaveFocus();
    
    await user.tab();
    expect(screen.getByLabelText(/programming language/i)).toHaveFocus();
  });

  it('preserves form data during validation errors', async () => {
    const user = userEvent.setup();
    render(<SessionCreation onSessionCreated={mockOnSessionCreated} />);
    
    // Fill in some valid and some invalid data
    await user.type(screen.getByLabelText(/session title/i), 'ab'); // Too short
    await user.type(screen.getByLabelText(/description/i), 'Valid description');
    await user.selectOptions(screen.getByLabelText(/programming language/i), 'PYTHON');
    
    await user.click(screen.getByRole('button', { name: /create session/i }));
    
    // Check that valid data is preserved
    expect(screen.getByLabelText(/description/i)).toHaveValue('Valid description');
    expect(screen.getByDisplayValue('PYTHON')).toBeInTheDocument();
    
    // But error is shown for invalid field
    expect(screen.getByText(/title must be at least 3 characters/i)).toBeInTheDocument();
  });
});
