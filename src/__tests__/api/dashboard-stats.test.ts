/**
 * @jest-environment node
 */

import { GET } from '@/app/api/dashboard/stats/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn()
}));

jest.mock('@/lib/services/user-service', () => ({
  UserService: {
    getUserById: jest.fn()
  }
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    session: {
      count: jest.fn()
    },
    sessionParticipant: {
      count: jest.fn()
    }
  }
}));

import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/lib/services/user-service';
import { prisma } from '@/lib/prisma';

const mockCreateClient = createClient as jest.Mock;
const mockGetUserById = UserService.getUserById as jest.Mock;
const mockSessionCount = prisma.session.count as jest.Mock;
const mockParticipantCount = prisma.sessionParticipant.count as jest.Mock;

describe('/api/dashboard/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Not authenticated')
        })
      }
    });

    const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
    const response = await GET();

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 when user is not found in database', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user' } },
          error: null
        })
      }
    });

    mockGetUserById.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
    const response = await GET();

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('User not found');
  });

  it('returns instructor stats correctly', async () => {
    const mockUser = {
      id: 'instructor-1',
      role: 'INSTRUCTOR',
      name: 'Test Instructor',
      email: 'instructor@test.com'
    };

    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'instructor-1' } },
          error: null
        })
      }
    });

    mockGetUserById.mockResolvedValue(mockUser);

    // Mock database counts
    mockSessionCount
      .mockResolvedValueOnce(5) // sessionsCreated
      .mockResolvedValueOnce(2) // activeSessions (instructor)
      .mockResolvedValueOnce(3); // recentSessions (instructor)

    mockParticipantCount
      .mockResolvedValueOnce(8) // sessionsParticipated
      .mockResolvedValueOnce(25); // totalParticipants

    const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.stats).toEqual({
      sessionsCreated: 5,
      sessionsParticipated: 8,
      activeSessions: 2,
      totalParticipants: 25,
      recentSessions: 3,
      userRole: 'INSTRUCTOR'
    });
  });

  it('returns learner stats correctly', async () => {
    const mockUser = {
      id: 'learner-1',
      role: 'LEARNER',
      name: 'Test Learner',
      email: 'learner@test.com'
    };

    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'learner-1' } },
          error: null
        })
      }
    });

    mockGetUserById.mockResolvedValue(mockUser);

    // Mock database counts for learner
    mockSessionCount.mockResolvedValueOnce(1); // activeSessions (learner)
    mockParticipantCount
      .mockResolvedValueOnce(12) // sessionsParticipated
      .mockResolvedValueOnce(4); // recentSessions (learner)

    const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.stats).toEqual({
      sessionsCreated: 0, // Learners don't create sessions
      sessionsParticipated: 12,
      activeSessions: 1,
      totalParticipants: 0, // Learners don't have participants
      recentSessions: 4,
      userRole: 'LEARNER'
    });
  });

  it('handles database errors gracefully', async () => {
    const mockUser = {
      id: 'test-user',
      role: 'INSTRUCTOR',
      name: 'Test User',
      email: 'test@test.com'
    };

    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user' } },
          error: null
        })
      }
    });

    mockGetUserById.mockResolvedValue(mockUser);
    mockSessionCount.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
    const response = await GET();

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });

  it('makes correct database queries for instructor', async () => {
    const mockUser = {
      id: 'instructor-1',
      role: 'INSTRUCTOR',
      name: 'Test Instructor',
      email: 'instructor@test.com'
    };

    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'instructor-1' } },
          error: null
        })
      }
    });

    mockGetUserById.mockResolvedValue(mockUser);

    // Mock all database calls
    mockSessionCount.mockResolvedValue(0);
    mockParticipantCount.mockResolvedValue(0);

    const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
    await GET();

    // Verify correct queries were made
    expect(mockSessionCount).toHaveBeenCalledWith({
      where: { instructorId: 'instructor-1' }
    });

    expect(mockSessionCount).toHaveBeenCalledWith({
      where: { 
        instructorId: 'instructor-1',
        status: 'ACTIVE'
      }
    });

    expect(mockParticipantCount).toHaveBeenCalledWith({
      where: { userId: 'instructor-1' }
    });
  });

  it('makes correct database queries for learner', async () => {
    const mockUser = {
      id: 'learner-1',
      role: 'LEARNER',
      name: 'Test Learner',
      email: 'learner@test.com'
    };

    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'learner-1' } },
          error: null
        })
      }
    });

    mockGetUserById.mockResolvedValue(mockUser);

    // Mock all database calls
    mockSessionCount.mockResolvedValue(0);
    mockParticipantCount.mockResolvedValue(0);

    const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
    await GET();

    // Verify learner-specific queries
    expect(mockSessionCount).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        OR: [
          { isPublic: true },
          {
            participants: {
              some: { userId: 'learner-1' }
            }
          }
        ]
      }
    });
  });
});
