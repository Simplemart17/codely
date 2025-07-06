/**
 * @jest-environment node
 */

import { GET } from '@/app/api/dashboard/stats/route';

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/services/user-service', () => ({
  UserService: {
    getUserById: jest.fn(),
  },
}));

jest.mock('@/lib/supabase/database', () => ({
  SupabaseDatabase: {
    getServerClient: jest.fn(),
  },
}));

import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/lib/services/user-service';
import { SupabaseDatabase } from '@/lib/supabase/database';

const mockCreateClient = createClient as jest.Mock;
const mockGetUserById = UserService.getUserById as jest.Mock;
const mockGetServerClient = SupabaseDatabase.getServerClient as jest.Mock;

describe('/api/dashboard/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error('Auth error') }),
      },
    });
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns 404 when user is not found', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: '1' } } }),
      },
    });
    mockGetUserById.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(404);
  });

  const setupMocks = () => {
    const sessionsMock = {
      select: jest.fn(),
      eq: jest.fn(),
      gte: jest.fn(),
      or: jest.fn(),
    };
    const participantsMock = {
      select: jest.fn(),
      eq: jest.fn(),
      in: jest.fn(),
      gte: jest.fn(),
    };

    Object.values(sessionsMock).forEach(fn => fn.mockReturnThis());
    Object.values(participantsMock).forEach(fn => fn.mockReturnThis());

    const from = jest.fn(table => {
      if (table === 'sessions') return sessionsMock;
      if (table === 'session_participants') return participantsMock;
    });

    mockGetServerClient.mockReturnValue({ from });

    return { sessionsMock, participantsMock };
  };

  it('returns instructor stats correctly', async () => {
    const { sessionsMock, participantsMock } = setupMocks();
    const mockUser = { id: 'ins-1', role: 'INSTRUCTOR' };
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: mockUser.id } } }),
      },
    });
    mockGetUserById.mockResolvedValue(mockUser);

    sessionsMock.select.mockImplementation((columns, options) => {
      if (columns === 'id' && !options) {
        return Promise.resolve({ data: [{ id: 'ses-1' }] });
      }
      return sessionsMock;
    });

    sessionsMock.eq.mockImplementation((column, value) => {
      if (column === 'instructor_id' && value === mockUser.id) {
        // This is the first part of several chains
        return sessionsMock;
      }
      if (column === 'status' && value === 'ACTIVE') {
        // This is the end of the activeSessions chain
        return Promise.resolve({ count: 2 });
      }
      // Default for eq ending a chain (sessionsCreated)
      return Promise.resolve({ count: 5 });
    });

    sessionsMock.gte.mockResolvedValue({ count: 3 });
    participantsMock.eq.mockResolvedValue({ count: 8 });
    participantsMock.in.mockResolvedValue({ count: 25 });

    const response = await GET();
    const { stats } = await response.json();

    expect(response.status).toBe(200);
    expect(stats).toEqual({
      sessionsCreated: 5,
      sessionsParticipated: 8,
      activeSessions: 2,
      totalParticipants: 25,
      recentSessions: 3,
      userRole: 'INSTRUCTOR',
    });
  });

  it('returns learner stats correctly', async () => {
    const { sessionsMock, participantsMock } = setupMocks();
    const mockUser = { id: 'lrn-1', role: 'LEARNER' };
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: mockUser.id } } }),
      },
    });
    mockGetUserById.mockResolvedValue(mockUser);

    participantsMock.eq.mockResolvedValue({ count: 12 });
    sessionsMock.or.mockResolvedValue({ count: 1 });
    participantsMock.gte.mockResolvedValue({ count: 4 });

    const response = await GET();
    const { stats } = await response.json();

    expect(response.status).toBe(200);
    expect(stats).toEqual({
      sessionsCreated: 0,
      sessionsParticipated: 12,
      activeSessions: 1,
      totalParticipants: 0,
      recentSessions: 4,
      userRole: 'LEARNER',
    });
  });

  it('handles database errors gracefully', async () => {
    const { sessionsMock } = setupMocks();
    const mockUser = { id: 'test-user', role: 'INSTRUCTOR' };
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: mockUser.id } } }),
      },
    });
    mockGetUserById.mockResolvedValue(mockUser);

    sessionsMock.eq.mockRejectedValue(new Error('Database error'));

    const response = await GET();
    expect(response.status).toBe(500);
  });
});