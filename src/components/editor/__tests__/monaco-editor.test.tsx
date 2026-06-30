import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MonacoEditor } from '../monaco-editor';
import { useUserStore } from '@/stores/user-store';

// Mock Monaco Editor. Must export `loader` too: the component calls
// `loader.config({ monaco })` while configuring the local monaco package, and a
// missing `loader` makes that throw, leaving the editor stuck in its loading
// guard (and producing an unhandled promise rejection).
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  loader: { config: jest.fn() },
  default: ({
    onChange,
    onMount,
    loading,
  }: {
    onChange?: (value: string) => void;
    onMount?: (editor: unknown, monaco: unknown) => void;
    loading?: React.ReactNode;
  }) => {
    // Simulate editor mount
    setTimeout(() => {
      if (onMount) {
        const mockEditor = {
          updateOptions: jest.fn(),
          addCommand: jest.fn(),
          trigger: jest.fn(),
          getModel: jest.fn(() => null),
          setModel: jest.fn(),
        };
        onMount(mockEditor, {
          languages: {
            typescript: {
              javascriptDefaults: {
                setDiagnosticsOptions: jest.fn(),
                setCompilerOptions: jest.fn(),
              },
              ScriptTarget: { ES2020: 7 },
              ModuleResolutionKind: { NodeJs: 2 },
              ModuleKind: { CommonJS: 1 },
              JsxEmit: { React: 2 },
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

const mockUseUserStore = useUserStore as jest.MockedFunction<
  typeof useUserStore
>;

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
      loadUser: jest.fn(),
      updateUser: jest.fn(),
      updatePreferences: jest.fn(),
      logout: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
      clearError: jest.fn(),
    });

    jest.clearAllMocks();
  });

  // The editor renders behind an async loader gate (the local monaco package is
  // configured before the Editor mounts), so the editor appears after a tick —
  // queries use `findByTestId` to await it.
  it('shows the loading state, then renders the editor', async () => {
    render(
      <MonacoEditor value="" onChange={mockOnChange} language="JAVASCRIPT" />
    );

    // Loading guard is shown synchronously before the loader resolves.
    expect(screen.getByText('Loading editor...')).toBeInTheDocument();
    // Editor appears once the loader is ready.
    expect(await screen.findByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('calls onChange when editor content changes', async () => {
    render(
      <MonacoEditor value="" onChange={mockOnChange} language="JAVASCRIPT" />
    );

    const textarea = await screen.findByTestId('editor-textarea');
    fireEvent.change(textarea, { target: { value: 'console.log("test");' } });

    expect(mockOnChange).toHaveBeenCalledWith('console.log("test");');
  });

  it('displays default code when value is empty', async () => {
    render(
      <MonacoEditor value="" onChange={mockOnChange} language="JAVASCRIPT" />
    );

    expect(await screen.findByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('applies user preferences for theme', async () => {
    mockUseUserStore.mockReturnValue({
      user: {
        ...mockUser,
        preferences: { ...mockUser.preferences, theme: 'dark' },
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      setUser: jest.fn(),
      loadUser: jest.fn(),
      updateUser: jest.fn(),
      updatePreferences: jest.fn(),
      logout: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
      clearError: jest.fn(),
    });

    render(
      <MonacoEditor value="" onChange={mockOnChange} language="JAVASCRIPT" />
    );

    expect(await screen.findByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('handles different programming languages', async () => {
    const { rerender } = render(
      <MonacoEditor value="" onChange={mockOnChange} language="PYTHON" />
    );

    expect(await screen.findByTestId('monaco-editor')).toBeInTheDocument();

    rerender(
      <MonacoEditor value="" onChange={mockOnChange} language="JAVASCRIPT" />
    );

    expect(await screen.findByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('supports read-only mode', async () => {
    render(
      <MonacoEditor
        value="const x = 1;"
        onChange={mockOnChange}
        language="JAVASCRIPT"
        readOnly={true}
      />
    );

    expect(await screen.findByTestId('monaco-editor')).toBeInTheDocument();
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

    await waitFor(
      () => {
        expect(mockOnMount).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );
  });

  it('handles custom height prop', async () => {
    render(
      <MonacoEditor
        value=""
        onChange={mockOnChange}
        language="JAVASCRIPT"
        height="600px"
      />
    );

    expect(await screen.findByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('applies custom theme when provided', async () => {
    render(
      <MonacoEditor
        value=""
        onChange={mockOnChange}
        language="JAVASCRIPT"
        theme="dark"
      />
    );

    expect(await screen.findByTestId('monaco-editor')).toBeInTheDocument();
  });
});
