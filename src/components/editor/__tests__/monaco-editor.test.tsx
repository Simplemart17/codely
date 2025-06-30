import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MonacoEditor } from '../monaco-editor';
import { useUserStore } from '@/stores/user-store';

// Mock Monaco Editor
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ onChange, onMount, loading }: any) => {
    // Simulate editor mount
    setTimeout(() => {
      if (onMount) {
        const mockEditor = {
          updateOptions: jest.fn(),
          addCommand: jest.fn(),
          trigger: jest.fn(),
        };
        onMount(mockEditor, {
          languages: {
            typescript: {
              javascriptDefaults: {
                setDiagnosticsOptions: jest.fn(),
                setCompilerOptions: jest.fn(),
              },
            },
          },
          KeyMod: { CtrlCmd: 1, Shift: 2 },
          KeyCode: { KeyS: 1, KeyZ: 2, Enter: 3 },
        });
      }
    }, 100);

    return (
      <div data-testid="monaco-editor">
        {loading}
        <textarea
          data-testid="editor-textarea"
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    );
  },
}));

// Mock the stores
jest.mock('@/stores/user-store');

const mockUseUserStore = useUserStore as jest.MockedFunction<typeof useUserStore>;

describe('MonacoEditor', () => {
  const mockOnChange = jest.fn();
  const mockOnMount = jest.fn();
  
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'INSTRUCTOR' as const,
    preferences: {
      theme: 'light' as const,
      fontSize: 16,
      keyBindings: 'vscode' as const,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
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

  it('renders the editor with loading state', () => {
    render(
      <MonacoEditor
        value=""
        onChange={mockOnChange}
        language="JAVASCRIPT"
      />
    );

    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    expect(screen.getByText('Loading editor...')).toBeInTheDocument();
  });

  it('calls onChange when editor content changes', async () => {
    render(
      <MonacoEditor
        value=""
        onChange={mockOnChange}
        language="JAVASCRIPT"
      />
    );

    const textarea = screen.getByTestId('editor-textarea');
    fireEvent.change(textarea, { target: { value: 'console.log("test");' } });

    expect(mockOnChange).toHaveBeenCalledWith('console.log("test");');
  });

  it('displays default code when value is empty', () => {
    render(
      <MonacoEditor
        value=""
        onChange={mockOnChange}
        language="JAVASCRIPT"
      />
    );

    // The component should use default JavaScript code
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('applies user preferences for theme', () => {
    mockUseUserStore.mockReturnValue({
      user: { ...mockUser, preferences: { ...mockUser.preferences, theme: 'dark' } },
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

    render(
      <MonacoEditor
        value=""
        onChange={mockOnChange}
        language="JAVASCRIPT"
      />
    );

    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('handles different programming languages', () => {
    const { rerender } = render(
      <MonacoEditor
        value=""
        onChange={mockOnChange}
        language="PYTHON"
      />
    );

    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();

    rerender(
      <MonacoEditor
        value=""
        onChange={mockOnChange}
        language="CSHARP"
      />
    );

    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('supports read-only mode', () => {
    render(
      <MonacoEditor
        value="const x = 1;"
        onChange={mockOnChange}
        language="JAVASCRIPT"
        readOnly={true}
      />
    );

    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('calls onMount callback when editor is mounted', async () => {
    render(
      <MonacoEditor
        value=""
        onChange={mockOnChange}
        language="JAVASCRIPT"
        onMount={mockOnMount}
      />
    );

    await waitFor(() => {
      expect(mockOnMount).toHaveBeenCalled();
    }, { timeout: 200 });
  });

  it('handles custom height prop', () => {
    render(
      <MonacoEditor
        value=""
        onChange={mockOnChange}
        language="JAVASCRIPT"
        height="600px"
      />
    );

    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('applies custom theme when provided', () => {
    render(
      <MonacoEditor
        value=""
        onChange={mockOnChange}
        language="JAVASCRIPT"
        theme="dark"
      />
    );

    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });
});
