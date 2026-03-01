/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';

// Mock fetch
global.fetch = jest.fn();

const mockInstructorStats = {
  sessionsCreated: 5,
  sessionsParticipated: 8,
  activeSessions: 2,
  totalParticipants: 25,
  recentSessions: 3,
  userRole: 'INSTRUCTOR'
};

const mockLearnerStats = {
  sessionsCreated: 0,
  sessionsParticipated: 12,
  activeSessions: 1,
  totalParticipants: 0,
  recentSessions: 4,
  userRole: 'LEARNER'
};

describe('DashboardStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays loading state initially', () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<DashboardStats />);

    // Should show loading skeletons
    const loadingElements = screen.getAllByRole('generic');
    expect(loadingElements.some(el => el.classList.contains('animate-pulse'))).toBe(true);
  });

  it('displays instructor stats correctly', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stats: mockInstructorStats })
    });

    render(<DashboardStats />);

    await waitFor(() => {
      expect(screen.getByText('Sessions Created')).toBeInTheDocument();
      expect(screen.getByText('Sessions Joined')).toBeInTheDocument();
      expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      expect(screen.getByText('Total Participants')).toBeInTheDocument();
    });
  });

  it('displays learner stats correctly', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stats: mockLearnerStats })
    });

    render(<DashboardStats />);

    await waitFor(() => {
      expect(screen.getByText('Sessions Joined')).toBeInTheDocument();
      expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();

      // Should not show instructor-specific stats
      expect(screen.queryByText('Sessions Created')).not.toBeInTheDocument();
      expect(screen.queryByText('Total Participants')).not.toBeInTheDocument();
    });
  });

  it('displays error state when fetch rejects', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<DashboardStats />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('displays error state when response is not ok', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    render(<DashboardStats />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch dashboard stats')).toBeInTheDocument();
    });
  });

  it('shows instructor quick stats section', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stats: mockInstructorStats })
    });

    render(<DashboardStats />);

    await waitFor(() => {
      expect(screen.getByText('Quick Stats')).toBeInTheDocument();
      expect(screen.getByText('Overview of your teaching activity')).toBeInTheDocument();
      expect(screen.getByText('Sessions this week')).toBeInTheDocument();
      expect(screen.getByText('Avg. participants')).toBeInTheDocument();
      expect(screen.getByText('Active now')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  it('makes correct API call', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stats: mockInstructorStats })
    });

    render(<DashboardStats />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/dashboard/stats');
    });
  });

  it('displays correct text descriptions', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stats: mockInstructorStats })
    });

    render(<DashboardStats />);

    await waitFor(() => {
      expect(screen.getByText('Total sessions you\'ve created')).toBeInTheDocument();
      expect(screen.getByText('Sessions you\'ve participated in')).toBeInTheDocument();
      expect(screen.getByText('Currently active sessions')).toBeInTheDocument();
      expect(screen.getByText('Across all your sessions')).toBeInTheDocument();
    });
  });
});
