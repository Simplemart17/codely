// Core type definitions for the Codely platform

// Enums matching Prisma schema
export type UserRole = 'INSTRUCTOR' | 'LEARNER';
export type Language = 'JAVASCRIPT' | 'PYTHON' | 'CSHARP';
export type SessionStatus = 'ACTIVE' | 'PAUSED' | 'ENDED';
export type ParticipantRole = 'INSTRUCTOR' | 'LEARNER' | 'OBSERVER';
export type OperationType = 'INSERT' | 'DELETE' | 'RETAIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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
  language: Language;
  status: SessionStatus;
  maxParticipants: number;
  isPublic: boolean;
  code: string;
  participants: SessionParticipant[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionParticipant {
  id: string;
  userId: string;
  sessionId: string;
  role: ParticipantRole;
  joinedAt: Date;
  isActive: boolean;
  cursorPosition?: {
    line: number;
    column: number;
  } | null;
}

export interface Operation {
  id: string;
  sessionId: string;
  userId: string;
  type: OperationType;
  position: number;
  content?: string;
  length?: number;
  timestamp: Date;
  vectorClock: Record<string, number>;
}

// Form types for session creation
export interface CreateSessionData {
  title: string;
  description?: string;
  language: Language;
  maxParticipants: number;
  isPublic: boolean;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
