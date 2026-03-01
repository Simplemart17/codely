/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { SessionMetadata } from '@/components/sessions/session-metadata';
import type { Session } from '@/types';

const mockSession: Session = {
  id: 'test-session-1',
  title: 'Test Session',
  description: 'A test session for unit testing',
  instructorId: 'instructor-1',
  language: 'JAVASCRIPT',
  status: 'ACTIVE',
  maxParticipants: 10,
  isPublic: true,
  code: 'console.log("Hello, World!");',
  objectives: [
    'Learn JavaScript basics',
    'Understand variables and functions',
    'Practice with arrays and objects'
  ],
  tags: ['javascript', 'fundamentals', 'beginner'],
  estimatedDuration: 60,
  difficulty: 'BEGINNER',
  prerequisites: 'Basic understanding of programming concepts',
  participants: [
    {
      id: 'participant-1',
      userId: 'user-1',
      sessionId: 'test-session-1',
      role: 'LEARNER',
      joinedAt: new Date(),
      isActive: true,
      cursorPosition: null
    },
    {
      id: 'participant-2',
      userId: 'user-2',
      sessionId: 'test-session-1',
      role: 'LEARNER',
      joinedAt: new Date(),
      isActive: true,
      cursorPosition: null
    }
  ],
  createdAt: new Date('2024-06-15T12:00:00Z'),
  updatedAt: new Date('2024-06-16T12:00:00Z')
};

describe('SessionMetadata', () => {
  it('renders session metadata in full mode', () => {
    render(<SessionMetadata session={mockSession} />);

    expect(screen.getByText('Session Details')).toBeInTheDocument();
    expect(screen.getByText('JAVASCRIPT')).toBeInTheDocument();
    expect(screen.getByText('BEGINNER')).toBeInTheDocument();
  });

  it('renders session metadata in compact mode', () => {
    render(<SessionMetadata session={mockSession} compact={true} />);

    expect(screen.getByText('JAVASCRIPT')).toBeInTheDocument();
    expect(screen.getByText('BEGINNER')).toBeInTheDocument();

    // Should not show full details in compact mode
    expect(screen.queryByText('Session Details')).not.toBeInTheDocument();
  });

  it('displays learning objectives', () => {
    render(<SessionMetadata session={mockSession} />);

    expect(screen.getByText('Learning Objectives')).toBeInTheDocument();
    mockSession.objectives?.forEach(objective => {
      expect(screen.getByText(objective)).toBeInTheDocument();
    });
  });

  it('displays prerequisites when available', () => {
    render(<SessionMetadata session={mockSession} />);

    expect(screen.getByText('Prerequisites')).toBeInTheDocument();
    expect(screen.getByText(mockSession.prerequisites!)).toBeInTheDocument();
  });

  it('displays tags', () => {
    render(<SessionMetadata session={mockSession} />);

    expect(screen.getByText('Tags')).toBeInTheDocument();
    mockSession.tags?.forEach(tag => {
      expect(screen.getByText(tag)).toBeInTheDocument();
    });
  });

  it('shows session status and visibility', () => {
    render(<SessionMetadata session={mockSession} />);

    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
  });

  it('displays creation date', () => {
    render(<SessionMetadata session={mockSession} />);

    // The component uses toLocaleDateString() — check that a date string is rendered
    const dateStr = new Date('2024-06-15T12:00:00Z').toLocaleDateString();
    expect(screen.getByText(`Created: ${dateStr}`)).toBeInTheDocument();
  });

  it('handles session without optional metadata', () => {
    const minimalSession: Session = {
      ...mockSession,
      objectives: undefined,
      tags: undefined,
      estimatedDuration: undefined,
      difficulty: undefined,
      prerequisites: undefined
    };

    render(<SessionMetadata session={minimalSession} />);

    expect(screen.getByText('JAVASCRIPT')).toBeInTheDocument();
    expect(screen.queryByText('Learning Objectives')).not.toBeInTheDocument();
    expect(screen.queryByText('Prerequisites')).not.toBeInTheDocument();
    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
  });

  it('shows correct language icons', () => {
    const pythonSession = { ...mockSession, language: 'PYTHON' as const };
    const { rerender } = render(<SessionMetadata session={pythonSession} />);
    expect(screen.getByText('🐍')).toBeInTheDocument();

    const csharpSession = { ...mockSession, language: 'CSHARP' as const };
    rerender(<SessionMetadata session={csharpSession} />);
    expect(screen.getByText('🔷')).toBeInTheDocument();

    const jsSession = { ...mockSession, language: 'JAVASCRIPT' as const };
    rerender(<SessionMetadata session={jsSession} />);
    expect(screen.getByText('🟨')).toBeInTheDocument();
  });

  it('shows correct difficulty styling', () => {
    const { rerender } = render(<SessionMetadata session={mockSession} />);

    // Test beginner difficulty has success styling
    const beginnerBadge = screen.getByText('BEGINNER');
    expect(beginnerBadge.className).toContain('text-success');

    // Test intermediate difficulty has warning styling
    const intermediateSession = { ...mockSession, difficulty: 'INTERMEDIATE' as const };
    rerender(<SessionMetadata session={intermediateSession} />);
    const intermediateBadge = screen.getByText('INTERMEDIATE');
    expect(intermediateBadge.className).toContain('text-warning');

    // Test advanced difficulty has destructive styling
    const advancedSession = { ...mockSession, difficulty: 'ADVANCED' as const };
    rerender(<SessionMetadata session={advancedSession} />);
    const advancedBadge = screen.getByText('ADVANCED');
    expect(advancedBadge.className).toContain('text-destructive');
  });

  it('displays title when showTitle is true', () => {
    render(<SessionMetadata session={mockSession} showTitle={true} />);

    expect(screen.getByText(mockSession.title)).toBeInTheDocument();
    if (mockSession.description) {
      expect(screen.getByText(mockSession.description)).toBeInTheDocument();
    }
  });

  it('limits tags display in compact mode', () => {
    const sessionWithManyTags = {
      ...mockSession,
      tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5']
    };

    render(<SessionMetadata session={sessionWithManyTags} compact={true} />);

    // Should show first 3 tags plus a "+2" indicator
    expect(screen.getByText('tag1')).toBeInTheDocument();
    expect(screen.getByText('tag2')).toBeInTheDocument();
    expect(screen.getByText('tag3')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
});
