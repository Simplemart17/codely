import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionPage } from '@/app/sessions/[id]/page';

// Mock Next.js
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useParams: () => ({ id: 'session-123' }),
}));

// Mock API calls
const mockGetSession = jest.fn();
const mockJoinSession = jest.fn();
const mockUpdateCode = jest.fn();
const mockExecuteCode = jest.fn();

jest.mock('@/lib/api', () => ({
  getSession: (...args: any[]) => mockGetSession(...args),
  joinSession: (...args: any[]) => mockJoinSession(...args),
  updateCode: (...args: any[]) => mockUpdateCode(...args),
  executeCode: (...args: any[]) => mockExecuteCode(...args),
}));

// Mock Monaco Editor
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value, onChange, onMount }: any) => {
    React.useEffect(() => {
      if (onMount) {
        const mockEditor = {
          getValue: () => value,
          setValue: (newValue: string) => onChange?.(newValue),
          focus: jest.fn(),
          dispose: jest.fn(),
        };
        onMount(mockEditor);
      }
    }, [onMount, value, onChange]);

    return (
      <div data-testid="monaco-editor">
        <textarea
          data-testid="code-editor"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    );
  },
}));

// Mock user store
jest.mock('@/stores/user-store', () => ({
  useUserStore: () => ({
    user: {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'INSTRUCTOR',
    },
    isAuthenticated: true,
  }),
}));

describe('Session Flow Integration Tests', () => {
  const mockSession = {
    id: 'session-123',
    title: 'JavaScript Basics',
    description: 'Learn JavaScript fundamentals',
    language: 'JAVASCRIPT',
    code: 'console.log("Hello World");',
    instructorId: 'user-123',
    maxParticipants: 10,
    isPublic: true,
    status: 'ACTIVE',
    participants: [
      {
        id: 'participant-1',
        userId: 'user-123',
        role: 'INSTRUCTOR',
        joinedAt: new Date(),
        isActive: true,
        user: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
        },
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockJoinSession.mockResolvedValue({ success: true });
    mockUpdateCode.mockResolvedValue({ success: true });
    mockExecuteCode.mockResolvedValue({
      output: 'Hello World',
      error: null,
      executionTime: 45,
    });
  });

  it('completes full session workflow', async () => {
    const user = userEvent.setup();
    
    render(<SessionPage />);

    // Wait for session to load
    await waitFor(() => {
      expect(screen.getByText('JavaScript Basics')).toBeInTheDocument();
    });

    // Check that session details are displayed
    expect(screen.getByText('Learn JavaScript fundamentals')).toBeInTheDocument();
    expect(screen.getByText('JAVASCRIPT')).toBeInTheDocument();

    // Check that code editor is loaded with initial code
    const codeEditor = screen.getByTestId('code-editor');
    expect(codeEditor).toHaveValue('console.log("Hello World");');

    // Modify code
    await user.clear(codeEditor);
    await user.type(codeEditor, 'const x = 42;\nconsole.log(x);');

    // Verify code update API call
    await waitFor(() => {
      expect(mockUpdateCode).toHaveBeenCalledWith('session-123', 'const x = 42;\nconsole.log(x);');
    });

    // Execute code
    const executeButton = screen.getByRole('button', { name: /run code/i });
    await user.click(executeButton);

    // Verify execution API call
    expect(mockExecuteCode).toHaveBeenCalledWith('session-123', 'const x = 42;\nconsole.log(x);');

    // Check execution results
    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeInTheDocument();
      expect(screen.getByText(/execution time: 45ms/i)).toBeInTheDocument();
    });
  });

  it('handles session joining flow', async () => {
    const user = userEvent.setup();
    
    // Mock session where user is not yet a participant
    const sessionWithoutUser = {
      ...mockSession,
      participants: [],
    };
    mockGetSession.mockResolvedValue(sessionWithoutUser);

    render(<SessionPage />);

    // Wait for session to load
    await waitFor(() => {
      expect(screen.getByText('JavaScript Basics')).toBeInTheDocument();
    });

    // Should show join button
    const joinButton = screen.getByRole('button', { name: /join session/i });
    expect(joinButton).toBeInTheDocument();

    // Click join button
    await user.click(joinButton);

    // Verify join API call
    expect(mockJoinSession).toHaveBeenCalledWith('session-123');

    // Should show loading state
    expect(screen.getByText(/joining session/i)).toBeInTheDocument();

    // After joining, should show session content
    await waitFor(() => {
      expect(screen.queryByText(/join session/i)).not.toBeInTheDocument();
      expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    });
  });

  it('handles code execution errors', async () => {
    const user = userEvent.setup();
    
    // Mock execution error
    mockExecuteCode.mockResolvedValue({
      output: null,
      error: 'SyntaxError: Unexpected token',
      executionTime: 12,
    });

    render(<SessionPage />);

    await waitFor(() => {
      expect(screen.getByText('JavaScript Basics')).toBeInTheDocument();
    });

    // Execute code with error
    const executeButton = screen.getByRole('button', { name: /run code/i });
    await user.click(executeButton);

    // Check error display
    await waitFor(() => {
      expect(screen.getByText('SyntaxError: Unexpected token')).toBeInTheDocument();
      expect(screen.getByText(/execution time: 12ms/i)).toBeInTheDocument();
    });
  });

  it('handles real-time collaboration', async () => {
    const user = userEvent.setup();
    
    render(<SessionPage />);

    await waitFor(() => {
      expect(screen.getByText('JavaScript Basics')).toBeInTheDocument();
    });

    // Simulate receiving real-time code update from another user
    const codeEditor = screen.getByTestId('code-editor');
    
    // Simulate external code change
    fireEvent.change(codeEditor, {
      target: { value: 'const message = "Hello from another user";' }
    });

    // Verify the code is updated in the editor
    expect(codeEditor).toHaveValue('const message = "Hello from another user";');
  });

  it('handles participant management', async () => {
    const user = userEvent.setup();
    
    // Mock session with multiple participants
    const sessionWithParticipants = {
      ...mockSession,
      participants: [
        ...mockSession.participants,
        {
          id: 'participant-2',
          userId: 'user-456',
          role: 'LEARNER',
          joinedAt: new Date(),
          isActive: true,
          user: {
            id: 'user-456',
            name: 'Student User',
            email: 'student@example.com',
          },
        },
      ],
    };
    mockGetSession.mockResolvedValue(sessionWithParticipants);

    render(<SessionPage />);

    await waitFor(() => {
      expect(screen.getByText('JavaScript Basics')).toBeInTheDocument();
    });

    // Check participants list
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('Student User')).toBeInTheDocument();
    expect(screen.getByText('INSTRUCTOR')).toBeInTheDocument();
    expect(screen.getByText('LEARNER')).toBeInTheDocument();
  });

  it('handles session status changes', async () => {
    const user = userEvent.setup();
    
    render(<SessionPage />);

    await waitFor(() => {
      expect(screen.getByText('JavaScript Basics')).toBeInTheDocument();
    });

    // Check active session status
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();

    // Simulate session ending
    const endSessionButton = screen.getByRole('button', { name: /end session/i });
    await user.click(endSessionButton);

    // Should show confirmation dialog
    expect(screen.getByText(/are you sure you want to end this session/i)).toBeInTheDocument();

    // Confirm ending
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    // Should update session status
    await waitFor(() => {
      expect(screen.getByText('ENDED')).toBeInTheDocument();
    });
  });

  it('handles network errors gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock network error
    mockGetSession.mockRejectedValue(new Error('Network error'));

    render(<SessionPage />);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/failed to load session/i)).toBeInTheDocument();
    });

    // Should show retry button
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    // Reset mock to success
    mockGetSession.mockResolvedValue(mockSession);

    // Click retry
    await user.click(retryButton);

    // Should load session successfully
    await waitFor(() => {
      expect(screen.getByText('JavaScript Basics')).toBeInTheDocument();
    });
  });

  it('handles session permissions correctly', async () => {
    const user = userEvent.setup();
    
    // Mock session where user is a learner (not instructor)
    const sessionAsLearner = {
      ...mockSession,
      instructorId: 'other-user',
      participants: [
        {
          id: 'participant-1',
          userId: 'user-123',
          role: 'LEARNER',
          joinedAt: new Date(),
          isActive: true,
          user: {
            id: 'user-123',
            name: 'Test User',
            email: 'test@example.com',
          },
        },
      ],
    };
    mockGetSession.mockResolvedValue(sessionAsLearner);

    render(<SessionPage />);

    await waitFor(() => {
      expect(screen.getByText('JavaScript Basics')).toBeInTheDocument();
    });

    // Should not show instructor-only features
    expect(screen.queryByRole('button', { name: /end session/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /manage participants/i })).not.toBeInTheDocument();

    // Should still be able to edit code and execute
    expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run code/i })).toBeInTheDocument();
  });
});
