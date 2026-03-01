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
import { CodingInterface } from '@/components/editor/coding-interface';
import { useSessionStore } from '@/stores/session-store';
import { useUserStore } from '@/stores/user-store';
import type { Language } from '@/types';
import { ArrowLeft, Maximize2, Minimize2, Users } from 'lucide-react';

export default function SessionCodePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const { currentSession, participants, fetchSession, isLoading, error } =
    useSessionStore();
  const { user } = useUserStore();

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (sessionId) fetchSession(sessionId);
  }, [sessionId, fetchSession]);

  const handleCodeChange = (code: string) => {
    console.log('Code changed:', code.length, 'characters');
  };

  const handleLanguageChange = (language: Language) => {
    if (user?.role === 'INSTRUCTOR') {
      console.log('Language changed to:', language);
    }
  };

  const handleBack = () => router.push(`/sessions/${sessionId}`);
  const activeParticipants = participants.filter((p) => p.isActive);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">
            Loading session...
          </p>
        </div>
      </div>
    );
  }

  if (error || !currentSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Session Not Found</CardTitle>
            <CardDescription>
              {error || 'This session does not exist or has been removed.'}
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
    );
  }

  if (currentSession.status !== 'ACTIVE') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Session Not Active</CardTitle>
            <CardDescription>
              This session is currently {currentSession.status.toLowerCase()}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleBack} variant="outline" className="w-full">
              Back to Session
            </Button>
            <Button
              onClick={() => router.push('/sessions')}
              className="w-full"
            >
              Browse Sessions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isInstructor = user?.id === currentSession.instructorId;
  const isParticipant = participants.some(
    (p) => p.userId === user?.id && p.isActive
  );

  if (!isInstructor && !isParticipant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need to join this session first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleBack} className="w-full">
              Go to Session
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={
        isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'flex h-screen flex-col bg-background'
      }
    >
      {/* Top Bar */}
      <div className="flex h-12 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-sm font-medium truncate max-w-[200px] lg:max-w-none">
            {currentSession.title}
          </h1>
          <Badge variant="outline" className="text-xs">
            {currentSession.language}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{activeParticipants.length}</span>
          </div>
          <Separator orientation="vertical" className="h-5" />
          {/* Participant avatars */}
          <div className="flex -space-x-2">
            {activeParticipants.slice(0, 4).map((p) => (
              <Avatar key={p.id} className="h-6 w-6 border-2 border-card">
                <AvatarFallback className="text-[10px]">
                  {p.userId.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {activeParticipants.length > 4 && (
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium">
                +{activeParticipants.length - 4}
              </div>
            )}
          </div>
          <Separator orientation="vertical" className="h-5" />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <CodingInterface
          sessionId={sessionId}
          initialCode={currentSession.code}
          initialLanguage={currentSession.language}
          readOnly={false}
          onCodeChange={handleCodeChange}
          onLanguageChange={handleLanguageChange}
        />
      </div>
    </div>
  );
}
