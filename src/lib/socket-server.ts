import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Socket } from 'socket.io';

// Define Socket.io event types
interface ClientToServerEvents {
  'join-session': (data: { sessionId: string; userInfo: ParticipantInfo }) => void;
  'leave-session': () => void;
  'cursor-update': (data: { line: number; column: number }) => void;
  'activity-status': (data: { isActive: boolean }) => void;
}

interface ServerToClientEvents {
  'session-joined': (data: { sessionId: string; participants: ParticipantInfo[] }) => void;
  'user-joined': (data: { user: ParticipantInfo; participants: ParticipantInfo[] }) => void;
  'user-left': (data: { userId: string; user: ParticipantInfo; participants: ParticipantInfo[] }) => void;
  'cursor-moved': (data: { userId: string; cursor: { line: number; column: number } }) => void;
  'user-activity-changed': (data: { userId: string; isActive: boolean }) => void;
  'error': (data: { message: string }) => void;
}

interface InterServerEvents {
  // Add inter-server events if needed
}

// Type alias for the typed Socket.io server
type TypedSocketIOServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// Extend the global object to store the Socket.io server instance
declare global {
  var socketIOServer: TypedSocketIOServer | undefined;
}

interface SessionRoom {
  id: string;
  participants: Map<string, ParticipantInfo>;
  createdAt: Date;
  lastActivity: Date;
}

interface ParticipantInfo {
  id: string;
  name: string;
  email: string;
  role: 'instructor' | 'learner';
  joinedAt: Date;
  isActive: boolean;
  cursor?: {
    line: number;
    column: number;
  };
}

interface SocketData {
  userId: string;
  sessionId: string;
  userInfo: ParticipantInfo;
}

// Store active sessions and their participants
const activeSessions = new Map<string, SessionRoom>();

export function initializeSocketServer(httpServer: NetServer): TypedSocketIOServer {
  if (global.socketIOServer) {
    return global.socketIOServer;
  }

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? process.env.NEXT_PUBLIC_APP_URL
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
    console.log('Client connected:', socket.id);

    // Handle user joining a session
    socket.on('join-session', async (data: {
      sessionId: string;
      userInfo: ParticipantInfo;
    }) => {
      try {
        const { sessionId, userInfo } = data;
        
        // Store user data in socket
        socket.data = {
          userId: userInfo.id,
          sessionId,
          userInfo,
        };

        // Join the session room
        await socket.join(sessionId);

        // Initialize session if it doesn't exist
        if (!activeSessions.has(sessionId)) {
          activeSessions.set(sessionId, {
            id: sessionId,
            participants: new Map(),
            createdAt: new Date(),
            lastActivity: new Date(),
          });
        }

        const session = activeSessions.get(sessionId)!;
        
        // Add participant to session
        session.participants.set(userInfo.id, {
          ...userInfo,
          joinedAt: new Date(),
          isActive: true,
        });
        
        session.lastActivity = new Date();

        // Notify other participants about the new user
        socket.to(sessionId).emit('user-joined', {
          user: userInfo,
          participants: Array.from(session.participants.values()),
        });

        // Send current participants to the new user
        socket.emit('session-joined', {
          sessionId,
          participants: Array.from(session.participants.values()),
        });

        console.log(`User ${userInfo.name} joined session ${sessionId}`);
      } catch (error) {
        console.error('Error joining session:', error);
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    // Handle user leaving a session
    socket.on('leave-session', async () => {
      await handleUserLeave(socket);
    });

    // Handle cursor position updates
    socket.on('cursor-update', (data: {
      line: number;
      column: number;
    }) => {
      if (socket.data?.sessionId && socket.data?.userId) {
        const session = activeSessions.get(socket.data.sessionId);
        if (session) {
          const participant = session.participants.get(socket.data.userId);
          if (participant) {
            participant.cursor = data;
            session.lastActivity = new Date();
            
            // Broadcast cursor position to other participants
            socket.to(socket.data.sessionId).emit('cursor-moved', {
              userId: socket.data.userId,
              cursor: data,
            });
          }
        }
      }
    });

    // Handle user activity status
    socket.on('activity-status', (data: { isActive: boolean }) => {
      if (socket.data?.sessionId && socket.data?.userId) {
        const session = activeSessions.get(socket.data.sessionId);
        if (session) {
          const participant = session.participants.get(socket.data.userId);
          if (participant) {
            participant.isActive = data.isActive;
            session.lastActivity = new Date();
            
            // Broadcast activity status to other participants
            socket.to(socket.data.sessionId).emit('user-activity-changed', {
              userId: socket.data.userId,
              isActive: data.isActive,
            });
          }
        }
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log('Client disconnected:', socket.id);
      await handleUserLeave(socket);
    });

    // Handle connection errors
    socket.on('error', (error: Error) => {
      console.error('Socket error:', error);
    });
  });

  // Store the server instance globally
  global.socketIOServer = io;

  // Cleanup inactive sessions periodically
  setInterval(() => {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of activeSessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > inactiveThreshold) {
        activeSessions.delete(sessionId);
        console.log(`Session ${sessionId} cleaned up - inactive`);
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  return io;
}

// Helper function to handle user leaving
async function handleUserLeave(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
  if (socket.data?.sessionId && socket.data?.userId) {
    const { sessionId, userId, userInfo } = socket.data;
    const session = activeSessions.get(sessionId);
    
    if (session) {
      // Remove participant from session
      session.participants.delete(userId);
      session.lastActivity = new Date();
      
      // Notify other participants
      socket.to(sessionId).emit('user-left', {
        userId,
        user: userInfo,
        participants: Array.from(session.participants.values()),
      });
      
      // Clean up empty sessions
      if (session.participants.size === 0) {
        activeSessions.delete(sessionId);
        console.log(`Session ${sessionId} cleaned up - no participants`);
      }
      
      console.log(`User ${userInfo.name} left session ${sessionId}`);
    }
    
    // Leave the room
    await socket.leave(sessionId);
  }
}

export function getSocketServer(): TypedSocketIOServer | undefined {
  return global.socketIOServer;
}

export { activeSessions };
export type { SessionRoom, ParticipantInfo, SocketData };
