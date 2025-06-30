'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSessionStore } from '@/stores/session-store';
import { useUserStore } from '@/stores/user-store';
import { formatDate } from '@/lib/utils';
import type { Language, SessionStatus } from '@/types';

interface SessionListProps {
  showCreateButton?: boolean;
  onCreateSession?: () => void;
  filter?: 'all' | 'my-sessions' | 'public';
}

export function SessionList({ 
  showCreateButton = true, 
  onCreateSession,
  filter = 'all' 
}: SessionListProps) {
  const { userSessions, fetchUserSessions, isLoading, error } = useSessionStore();
  const { user } = useUserStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [languageFilter, setLanguageFilter] = useState<Language | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'all'>('all');

  useEffect(() => {
    if (user && filter !== 'public') {
      fetchUserSessions(user.id);
    }
  }, [user, filter, fetchUserSessions]);

  const filteredSessions = userSessions.filter(session => {
    // Search filter
    if (searchTerm && !session.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !session.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Language filter
    if (languageFilter !== 'all' && session.language !== languageFilter) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all' && session.status !== statusFilter) {
      return false;
    }

    // User filter
    if (filter === 'my-sessions' && session.instructorId !== user?.id) {
      return false;
    }

    return true;
  });

  const getLanguageLabel = (language: Language): string => {
    switch (language) {
      case 'JAVASCRIPT': return 'JavaScript';
      case 'PYTHON': return 'Python';
      case 'CSHARP': return 'C#';
      default: return language;
    }
  };

  const getStatusColor = (status: SessionStatus): string => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800';
      case 'ENDED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">Error loading sessions: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {filter === 'my-sessions' ? 'My Sessions' : 
           filter === 'public' ? 'Public Sessions' : 'All Sessions'}
        </h2>
        {showCreateButton && user?.role === 'INSTRUCTOR' && (
          <Button onClick={onCreateSession}>
            Create New Session
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        {/* Language Filter */}
        <select
          value={languageFilter}
          onChange={(e) => setLanguageFilter(e.target.value as Language | 'all')}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="all">All Languages</option>
          <option value="JAVASCRIPT">JavaScript</option>
          <option value="PYTHON">Python</option>
          <option value="CSHARP">C#</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SessionStatus | 'all')}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="all">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="ENDED">Ended</option>
        </select>
      </div>

      {/* Session Grid */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || languageFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters to see more sessions.'
              : 'Get started by creating your first coding session.'}
          </p>
          {showCreateButton && user?.role === 'INSTRUCTOR' && (
            <Button onClick={onCreateSession}>
              Create Your First Session
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSessions.map((session) => (
            <Card key={session.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{session.title}</CardTitle>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                      {session.status.toLowerCase()}
                    </span>
                  </div>
                </div>
                <CardDescription>
                  {session.description || 'No description provided'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Language:</span>
                    <span className="font-medium">{getLanguageLabel(session.language)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Participants:</span>
                    <span>{session.participants.length}/{session.maxParticipants}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Created:</span>
                    <span>{formatDate(session.createdAt)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Visibility:</span>
                    <span>{session.isPublic ? 'Public' : 'Private'}</span>
                  </div>
                  
                  <div className="pt-3 border-t">
                    <Link href={`/sessions/${session.id}`}>
                      <Button className="w-full" size="sm">
                        {session.instructorId === user?.id ? 'Manage Session' : 'Join Session'}
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
