import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { SocketProvider, useSocket } from '../use-socket';
import socketClient from '@/lib/socket-client';

// Mock the socket client
jest.mock('@/lib/socket-client', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    joinSession: jest.fn(),
    leaveSession: jest.fn(),
    updateCursor: jest.fn(),
    updateActivityStatus: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    connected: false,
    id: 'test-socket-id',
  },
}));

const mockSocketClient = socketClient as jest.Mocked<typeof socketClient>;

// Test component that uses the socket hook
function TestComponent() {
  const {
    isConnected,
    isConnecting,
    connectionError,
    currentSessionId,
    participants,
    connect,
    disconnect,
    joinSession,
    leaveSession,
    updateCursor,
    updateActivityStatus,
  } = useSocket();

  return (
    <div>
      <div data-testid="connection-status">
        {isConnecting ? 'connecting' : isConnected ? 'connected' : 'disconnected'}
      </div>
      <div data-testid="session-id">{currentSessionId || 'no-session'}</div>
      <div data-testid="participants-count">{participants.length}</div>
      <div data-testid="connection-error">{connectionError || 'no-error'}</div>
      
      <button onClick={connect} data-testid="connect-btn">Connect</button>
      <button onClick={disconnect} data-testid="disconnect-btn">Disconnect</button>
      <button 
        onClick={() => joinSession('test-session', {
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com',
          role: 'learner',
          joinedAt: new Date(),
          isActive: true,
        })} 
        data-testid="join-session-btn"
      >
        Join Session
      </button>
      <button onClick={leaveSession} data-testid="leave-session-btn">Leave Session</button>
      <button 
        onClick={() => updateCursor(10, 5)} 
        data-testid="update-cursor-btn"
      >
        Update Cursor
      </button>
      <button 
        onClick={() => updateActivityStatus(true)} 
        data-testid="update-activity-btn"
      >
        Update Activity
      </button>
    </div>
  );
}

describe('useSocket Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementation
    mockSocketClient.connected = false;
    mockSocketClient.connect.mockResolvedValue(mockSocketClient as any);
  });

  it('should provide initial state', () => {
    render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected');
    expect(screen.getByTestId('session-id')).toHaveTextContent('no-session');
    expect(screen.getByTestId('participants-count')).toHaveTextContent('0');
    expect(screen.getByTestId('connection-error')).toHaveTextContent('no-error');
  });

  it('should handle connection', async () => {
    render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    const connectBtn = screen.getByTestId('connect-btn');
    
    act(() => {
      connectBtn.click();
    });

    // Should show connecting state
    expect(screen.getByTestId('connection-status')).toHaveTextContent('connecting');

    // Simulate successful connection
    await act(async () => {
      mockSocketClient.connected = true;
      await Promise.resolve();
    });

    expect(mockSocketClient.connect).toHaveBeenCalledTimes(1);
  });

  it('should handle connection error', async () => {
    const errorMessage = 'Connection failed';
    mockSocketClient.connect.mockRejectedValueOnce(new Error(errorMessage));

    render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    const connectBtn = screen.getByTestId('connect-btn');
    
    await act(async () => {
      connectBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('connection-error')).toHaveTextContent(errorMessage);
    });
  });

  it('should handle session joining', async () => {
    // Setup connected state
    mockSocketClient.connected = true;

    render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    const joinSessionBtn = screen.getByTestId('join-session-btn');
    
    await act(async () => {
      joinSessionBtn.click();
    });

    expect(mockSocketClient.joinSession).toHaveBeenCalledWith('test-session', {
      id: 'test-user',
      name: 'Test User',
      email: 'test@example.com',
      role: 'learner',
      joinedAt: expect.any(Date),
      isActive: true,
    });
  });

  it('should handle session leaving', async () => {
    // Setup connected and in session state
    mockSocketClient.connected = true;

    const { unmount } = render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    // First join a session
    const joinSessionBtn = screen.getByTestId('join-session-btn');
    await act(async () => {
      joinSessionBtn.click();
    });

    // Clear previous calls to isolate the manual leave action
    mockSocketClient.leaveSession.mockClear();

    // Then leave the session manually
    const leaveSessionBtn = screen.getByTestId('leave-session-btn');
    await act(async () => {
      leaveSessionBtn.click();
    });

    expect(mockSocketClient.leaveSession).toHaveBeenCalled();

    // Cleanup to prevent additional calls during unmount
    unmount();
  });

  it('should handle cursor updates', async () => {
    // Setup connected and in session state
    mockSocketClient.connected = true;

    render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    // Join session first
    const joinSessionBtn = screen.getByTestId('join-session-btn');
    await act(async () => {
      joinSessionBtn.click();
    });

    // Update cursor
    const updateCursorBtn = screen.getByTestId('update-cursor-btn');
    await act(async () => {
      updateCursorBtn.click();
    });

    expect(mockSocketClient.updateCursor).toHaveBeenCalledWith(10, 5);
  });

  it('should handle activity status updates', async () => {
    // Setup connected and in session state
    mockSocketClient.connected = true;

    render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    // Join session first
    const joinSessionBtn = screen.getByTestId('join-session-btn');
    await act(async () => {
      joinSessionBtn.click();
    });

    // Update activity status
    const updateActivityBtn = screen.getByTestId('update-activity-btn');
    await act(async () => {
      updateActivityBtn.click();
    });

    expect(mockSocketClient.updateActivityStatus).toHaveBeenCalledWith(true);
  });

  it('should handle disconnection', async () => {
    render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    const disconnectBtn = screen.getByTestId('disconnect-btn');
    
    act(() => {
      disconnectBtn.click();
    });

    expect(mockSocketClient.disconnect).toHaveBeenCalledTimes(1);
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useSocket must be used within a SocketProvider');

    consoleSpy.mockRestore();
  });
});
