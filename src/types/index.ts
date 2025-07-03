// Core type definitions for the Codely platform

// Enums matching Prisma schema
export type UserRole = 'INSTRUCTOR' | 'LEARNER';
export type Language = 'JAVASCRIPT' | 'PYTHON' | 'CSHARP';
export type SessionStatus = 'ACTIVE' | 'PAUSED' | 'ENDED';
export type ParticipantRole = 'INSTRUCTOR' | 'LEARNER' | 'OBSERVER';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
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
  objectives?: string[];
  tags?: string[];
  estimatedDuration?: number; // in minutes
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  prerequisites?: string;
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

export interface SessionInvitation {
  id: string;
  sessionId: string;
  inviterId: string;
  inviteeId?: string;
  email?: string;
  role: ParticipantRole;
  status: InvitationStatus;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  session?: Session;
  inviter?: User;
  invitee?: User;
}

export interface SessionRecording {
  id: string;
  sessionId: string;
  title: string;
  description?: string;
  duration: number; // in seconds
  fileUrl: string;
  thumbnailUrl?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  session?: Session;
}

export interface SessionSnapshot {
  id: string;
  sessionId: string;
  title: string;
  description?: string;
  code: string;
  metadata: Record<string, string | number | boolean>;
  createdBy: string;
  createdAt: Date;
  // Relations
  session?: Session;
  creator?: User;
}

// Form types for session creation
export interface CreateSessionData {
  title: string;
  description?: string;
  language: Language;
  maxParticipants: number;
  isPublic: boolean;
  objectives?: string[];
  tags?: string[];
  estimatedDuration?: number; // in minutes
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  prerequisites?: string;
}

// Form types for session invitations
export interface CreateInvitationData {
  sessionId: string;
  email?: string;
  userId?: string;
  role: ParticipantRole;
  expiresIn?: number; // hours from now, default 24
}

// Form types for session recordings
export interface CreateRecordingData {
  sessionId: string;
  title: string;
  description?: string;
  isPublic: boolean;
}

// Form types for session snapshots
export interface CreateSnapshotData {
  sessionId: string;
  title: string;
  description?: string;
  code: string;
  metadata?: Record<string, string | number | boolean>;
}

// Analytics types
export interface SessionAnalytics {
  sessionId: string;
  totalDuration: number; // in seconds
  participantCount: number;
  peakParticipants: number;
  codeChanges: number;
  executionCount: number;
  snapshotCount: number;
  averageEngagement: number; // percentage
  participantAnalytics: ParticipantAnalytics[];
  timelineEvents: TimelineEvent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ParticipantAnalytics {
  participantId: string;
  userId: string;
  userName: string;
  role: ParticipantRole;
  joinTime: Date;
  leaveTime?: Date;
  totalActiveTime: number; // in seconds
  codeContributions: number;
  executionCount: number;
  engagementScore: number; // 0-100
}

export interface TimelineEvent {
  id: string;
  sessionId: string;
  type: EventType;
  userId?: string;
  timestamp: Date;
  data: Record<string, string | number | boolean | Date>;
}

export type EventType =
  | 'session_started'
  | 'session_ended'
  | 'participant_joined'
  | 'participant_left'
  | 'code_changed'
  | 'code_executed'
  | 'snapshot_created'
  | 'recording_started'
  | 'recording_stopped';

export interface EngagementMetrics {
  activeParticipants: number;
  totalParticipants: number;
  averageSessionTime: number;
  codeChangesPerMinute: number;
  executionsPerMinute: number;
  engagementTrend: EngagementDataPoint[];
}

export interface EngagementDataPoint {
  timestamp: Date;
  activeUsers: number;
  codeChanges: number;
  executions: number;
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
