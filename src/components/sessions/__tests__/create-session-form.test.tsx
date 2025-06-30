import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateSessionForm } from '../create-session-form';
import { useSessionStore } from '@/stores/session-store';
import { useUserStore } from '@/stores/user-store';

// Mock the stores
jest.mock('@/stores/session-store');
jest.mock('@/stores/user-store');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const mockUseSessionStore = useSessionStore as jest.MockedFunction<typeof useSessionStore>;
const mockUseUserStore = useUserStore as jest.MockedFunction<typeof useUserStore>;

describe('CreateSessionForm', () => {
  const mockCreateSession = jest.fn();
  const mockUser = {
    id: 'user-1',
    email: 'instructor@test.com',
    name: 'Test Instructor',
    role: 'INSTRUCTOR' as const,
    preferences: {
      theme: 'light' as const,
      fontSize: 14,
      keyBindings: 'vscode' as const,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockUseSessionStore.mockReturnValue({
      createSession: mockCreateSession,
      isLoading: false,
      error: null,
      currentSession: null,
      participants: [],
      userSessions: [],
      setCurrentSession: jest.fn(),
      setParticipants: jest.fn(),
      addParticipant: jest.fn(),
      removeParticipant: jest.fn(),
      updateParticipant: jest.fn(),
      joinSession: jest.fn(),
      leaveSession: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      fetchUserSessions: jest.fn(),
      fetchSession: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
      clearError: jest.fn(),
    });

    mockUseUserStore.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      setUser: jest.fn(),
      updateUser: jest.fn(),
      updatePreferences: jest.fn(),
      logout: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
      clearError: jest.fn(),
    });

    jest.clearAllMocks();
  });

  it('renders the form with all required fields', () => {
    render(<CreateSessionForm />);

    expect(screen.getByLabelText(/session title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/programming language/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/maximum participants/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/make this session public/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create session/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<CreateSessionForm />);

    const submitButton = screen.getByRole('button', { name: /create session/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/session title is required/i)).toBeInTheDocument();
    });

    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('validates title length', async () => {
    render(<CreateSessionForm />);

    const titleInput = screen.getByLabelText(/session title/i);
    fireEvent.change(titleInput, { target: { value: 'ab' } });

    const submitButton = screen.getByRole('button', { name: /create session/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/title must be at least 3 characters/i)).toBeInTheDocument();
    });
  });

  it('validates participant limits', async () => {
    render(<CreateSessionForm />);

    const titleInput = screen.getByLabelText(/session title/i);
    const participantsInput = screen.getByLabelText(/maximum participants/i);

    fireEvent.change(titleInput, { target: { value: 'Valid Title' } });
    fireEvent.change(participantsInput, { target: { value: '0' } });

    const submitButton = screen.getByRole('button', { name: /create session/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/must allow at least 1 participant/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const mockSession = {
      id: 'session-1',
      title: 'Test Session',
      description: 'Test Description',
      instructorId: mockUser.id,
      language: 'JAVASCRIPT' as const,
      status: 'ACTIVE' as const,
      maxParticipants: 10,
      isPublic: true,
      code: '',
      participants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockCreateSession.mockResolvedValue(mockSession);

    const onSuccess = jest.fn();
    render(<CreateSessionForm onSuccess={onSuccess} />);

    // Fill out the form
    fireEvent.change(screen.getByLabelText(/session title/i), {
      target: { value: 'Test Session' },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Test Description' },
    });
    fireEvent.change(screen.getByLabelText(/programming language/i), {
      target: { value: 'JAVASCRIPT' },
    });
    fireEvent.change(screen.getByLabelText(/maximum participants/i), {
      target: { value: '10' },
    });

    const submitButton = screen.getByRole('button', { name: /create session/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith({
        title: 'Test Session',
        description: 'Test Description',
        language: 'JAVASCRIPT',
        maxParticipants: 10,
        isPublic: true,
        instructorId: mockUser.id,
      });
    });

    expect(onSuccess).toHaveBeenCalledWith('session-1');
  });

  it('shows loading state during submission', async () => {
    mockUseSessionStore.mockReturnValue({
      createSession: mockCreateSession,
      isLoading: true,
      error: null,
      currentSession: null,
      participants: [],
      userSessions: [],
      setCurrentSession: jest.fn(),
      setParticipants: jest.fn(),
      addParticipant: jest.fn(),
      removeParticipant: jest.fn(),
      updateParticipant: jest.fn(),
      joinSession: jest.fn(),
      leaveSession: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      fetchUserSessions: jest.fn(),
      fetchSession: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
      clearError: jest.fn(),
    });

    render(<CreateSessionForm />);

    const submitButton = screen.getByRole('button', { name: /creating/i });
    expect(submitButton).toBeDisabled();
  });

  it('displays error messages', () => {
    mockUseSessionStore.mockReturnValue({
      createSession: mockCreateSession,
      isLoading: false,
      error: 'Failed to create session',
      currentSession: null,
      participants: [],
      userSessions: [],
      setCurrentSession: jest.fn(),
      setParticipants: jest.fn(),
      addParticipant: jest.fn(),
      removeParticipant: jest.fn(),
      updateParticipant: jest.fn(),
      joinSession: jest.fn(),
      leaveSession: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      fetchUserSessions: jest.fn(),
      fetchSession: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
      clearError: jest.fn(),
    });

    render(<CreateSessionForm />);

    expect(screen.getByText(/failed to create session/i)).toBeInTheDocument();
  });
});
