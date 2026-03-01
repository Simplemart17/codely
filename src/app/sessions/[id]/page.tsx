'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionMetadata } from '@/components/sessions/session-metadata';
import { useSessionStore } from '@/stores/session-store';
import { useUserStore } from '@/stores/user-store';
import { ClientLayout } from '@/components/layout/client-layout';
import { formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  Code2,
  Clock,
  Users,
  Globe,
  Lock,
  Play,
  LogOut,
} from 'lucide-react';

function getLanguageLabel(language: string): string {
  switch (language) {
    case 'JAVASCRIPT':
      return 'JavaScript';
    case 'PYTHON':
      return 'Python';
    case 'CSHARP':
      return 'C#';
    default:
      return language;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'PAUSED':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'ENDED':
      return 'bg-muted text-muted-foreground';
    default:
      return '';
  }
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const {
    currentSession,
    participants,
    fetchSession,
    joinSession,
    leaveSession,
    isLoading,
    error,
  } = useSessionStore();
  const { user } = useUserStore();

  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (sessionId) {
      fetchSession(sessionId);
    }
  }, [sessionId, fetchSession]);

  const handleJoinSession = async () => {
    if (!user || !sessionId) return;
    setIsJoining(true);
    try {
      await joinSession(sessionId);
      router.push(`/sessions/${sessionId}/code`);
    } catch (err) {
      console.error('Failed to join session:', err);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveSession = async () => {
    if (!user || !sessionId) return;
    try {
      await leaveSession(sessionId);
    } catch (err) {
      console.error('Failed to leave session:', err);
    }
  };

  const isParticipant =
    user && participants.some((p) => p.userId === user.id && p.isActive);
  const isInstructor = user && currentSession?.instructorId === user.id;
  const activeParticipants = participants.filter((p) => p.isActive);

  if (isLoading) {
    return (
      <ClientLayout>
        <div className="flex-1 p-6 lg:p-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
            <div className="grid gap-6 lg:grid-cols-3">
              <Skeleton className="col-span-2 h-64" />
              <Skeleton className="h-64" />
            </div>
          </div>
        </div>
      </ClientLayout>
    );
  }

  if (error || !currentSession) {
    return (
      <ClientLayout>
        <div className="flex flex-1 items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Session Not Found</CardTitle>
              <CardDescription>
                {error ||
                  'The session you are looking for does not exist or has been removed.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => router.push('/sessions')}
                className="w-full"
              >
                Back to Sessions
              </Button>
            </CardContent>
          </Card>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="flex-1 p-6 lg:p-8">
        {/* Back + Actions */}
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/sessions')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Button>
          <div className="flex items-center gap-2">
            {isInstructor ? (
              <Button
                onClick={() => router.push(`/sessions/${sessionId}/code`)}
              >
                <Code2 className="mr-2 h-4 w-4" />
                Open Editor
              </Button>
            ) : isParticipant ? (
              <>
                <Button
                  onClick={() => router.push(`/sessions/${sessionId}/code`)}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Continue Coding
                </Button>
                <Button variant="outline" onClick={handleLeaveSession}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Leave
                </Button>
              </>
            ) : (
              <Button
                onClick={handleJoinSession}
                disabled={isJoining || currentSession.status !== 'ACTIVE'}
              >
                {isJoining ? 'Joining...' : 'Join Session'}
              </Button>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {currentSession.title}
            </h1>
            <Badge variant="outline" className={getStatusColor(currentSession.status)}>
              {currentSession.status.toLowerCase()}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {currentSession.description || 'No description provided'}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            <SessionMetadata session={currentSession} />

            {/* Details Grid */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Session Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Language</p>
                      <p className="font-medium">
                        {getLanguageLabel(currentSession.language)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Participants
                      </p>
                      <p className="font-medium">
                        {activeParticipants.length} /{' '}
                        {currentSession.maxParticipants}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentSession.isPublic ? (
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Visibility
                      </p>
                      <p className="font-medium">
                        {currentSession.isPublic ? 'Public' : 'Private'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="font-medium">
                        {formatDate(currentSession.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Code Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Code Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-zinc-950 p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                  <pre>{currentSession.code || '// No code yet...'}</pre>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Participants ({activeParticipants.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeParticipants.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    No active participants
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeParticipants.map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center gap-3"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {participant.userId.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium">
                            {participant.userId ===
                            currentSession.instructorId
                              ? 'Instructor'
                              : 'Learner'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {participant.role.toLowerCase()}
                          </p>
                        </div>
                        {participant.userId ===
                          currentSession.instructorId && (
                          <Badge variant="secondary" className="text-xs">
                            Host
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Separator className="my-4" />
                <p className="text-xs text-muted-foreground text-center">
                  {currentSession.maxParticipants - activeParticipants.length}{' '}
                  spots remaining
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}
