'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionMetadata } from './session-metadata';
import { useSessionStore } from '@/stores/session-store';
import { useUserStore } from '@/stores/user-store';
import { formatDate } from '@/lib/utils';
import { FileText } from 'lucide-react';
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
    if (user) {
      fetchUserSessions(user.id, filter);
    }
  }, [user, filter, fetchUserSessions]);

  const filteredSessions = userSessions.filter(session => {
    if (searchTerm && !session.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !session.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (languageFilter !== 'all' && session.language !== languageFilter) {
      return false;
    }
    if (statusFilter !== 'all' && session.status !== statusFilter) {
      return false;
    }
    if (filter === 'my-sessions' && session.instructorId !== user?.id) {
      return false;
    }
    return true;
  });

  const getStatusVariant = (status: SessionStatus) => {
    switch (status) {
      case 'ACTIVE': return 'default' as const;
      case 'PAUSED': return 'secondary' as const;
      case 'ENDED': return 'outline' as const;
      default: return 'outline' as const;
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-9 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive-foreground">
          Error loading sessions: {error}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">
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
      <div className="flex flex-wrap gap-4 rounded-lg border bg-card p-4">
        <div className="flex-1 min-w-[200px]">
          <Input
            type="text"
            placeholder="Search sessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select
          value={languageFilter}
          onValueChange={(v) => setLanguageFilter(v as Language | 'all')}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Languages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Languages</SelectItem>
            <SelectItem value="JAVASCRIPT">JavaScript</SelectItem>
            <SelectItem value="PYTHON">Python</SelectItem>
            <SelectItem value="CSHARP">C#</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as SessionStatus | 'all')}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="ENDED">Ended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Session Grid */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
            <FileText className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {filter === 'my-sessions' ? 'No sessions yet' :
             filter === 'public' ? 'No public sessions available' : 'No sessions found'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || languageFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters to see more sessions.'
              : filter === 'my-sessions' && user?.role === 'INSTRUCTOR' ?
                'Create your first coding session to get started.' :
               filter === 'my-sessions' ?
                'Join a session to see it appear here.' :
                'Get started by creating your first coding session.'}
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
            <Card key={session.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{session.title}</CardTitle>
                  <Badge variant={getStatusVariant(session.status)}>
                    {session.status.toLowerCase()}
                  </Badge>
                </div>
                <CardDescription>
                  {session.description || 'No description provided'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <SessionMetadata session={session} compact={true} />

                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Created:</span>
                    <span>{formatDate(session.createdAt)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
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
