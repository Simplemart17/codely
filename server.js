/**
 * Node.js Server for Collaborative Coding Platform
 *
 * This file uses ES modules for modern Node.js compatibility.
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// When using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer(async (req, res) => {
    try {
      // Be sure to pass `true` as the second argument to `url.parse`.
      // This tells it to parse the query portion of the URL.
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.io server
  const { Server } = await import('socket.io');
  const io = new Server(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: dev 
        ? ['http://localhost:3000', 'http://127.0.0.1:3000']
        : process.env.NEXT_PUBLIC_APP_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Store active sessions and their participants
  const activeSessions = new Map();

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Handle user joining a session
    socket.on('join-session', async (data) => {
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

        const session = activeSessions.get(sessionId);
        
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
    socket.on('cursor-update', (data) => {
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
    socket.on('activity-status', (data) => {
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
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Helper function to handle user leaving
  async function handleUserLeave(socket) {
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

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
