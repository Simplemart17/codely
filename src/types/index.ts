// Core type definitions for the Codely platform

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'instructor' | 'learner';
  avatar?: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  fontSize: number;
  keyBindings: 'vscode' | 'vim' | 'emacs';
}

export interface Session {
  id: string;
  title: string;
  description?: string;
  instructorId: string;
  language: 'javascript' | 'python' | 'csharp';
  status: 'active' | 'paused' | 'ended';
  maxParticipants: number;
  isPublic: boolean;
  code: string;
  participants: SessionParticipant[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionParticipant {
  userId: string;
  sessionId: string;
  role: 'instructor' | 'learner' | 'observer';
  joinedAt: Date;
  isActive: boolean;
  cursor?: {
    line: number;
    column: number;
  };
}

export interface Operation {
  id: string;
  sessionId: string;
  userId: string;
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  timestamp: Date;
  vectorClock: Record<string, number>;
}
