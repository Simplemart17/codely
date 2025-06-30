'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CodingInterface } from '@/components/editor/coding-interface';
import { useSessionStore } from '@/stores/session-store';
import { useUserStore } from '@/stores/user-store';
import type { Language } from '@/types';

export default function SessionCodePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  
  const { currentSession, participants, fetchSession, isLoading, error } = useSessionStore();
  const { user } = useUserStore();
  
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (sessionId) {
      fetchSession(sessionId);
    }
  }, [sessionId, fetchSession]);

  const handleCodeChange = (code: string) => {
    // In a real implementation, this would sync with other participants
    console.log('Code changed:', code.length, 'characters');
  };

  const handleLanguageChange = (language: Language) => {
    // Only instructors can change the language
    if (user?.role === 'INSTRUCTOR') {
      console.log('Language changed to:', language);
    }
  };

  const handleLeaveSession = () => {
    router.push(`/sessions/${sessionId}`);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading coding session...</p>
        </div>
      </div>
    );
  }

  if (error || !currentSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Session Not Found</CardTitle>
            <CardDescription>
              {error || 'The coding session you are looking for does not exist or has been removed.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/sessions')} className="w-full">
              Back to Sessions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentSession.status !== 'ACTIVE') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Session Not Active</CardTitle>
            <CardDescription>
              This session is currently {currentSession.status.toLowerCase()}. 
              Only active sessions support coding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button onClick={handleLeaveSession} variant="outline" className="w-full">
                Back to Session Details
              </Button>
              <Button onClick={() => router.push('/sessions')} className="w-full">
                Browse Other Sessions
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isInstructor = user?.id === currentSession.instructorId;
  const isParticipant = participants.some(p => p.userId === user?.id && p.isActive);

  if (!isInstructor && !isParticipant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need to join this session before you can access the coding interface.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleLeaveSession} className="w-full">
              Join Session
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const containerClass = isFullscreen 
    ? "fixed inset-0 z-50 bg-white" 
    : "min-h-screen bg-gray-50";

  return (
    <div className={containerClass}>
      {!isFullscreen && (
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-semibold text-gray-900">
                {currentSession.title}
              </h1>
              <span className="text-sm text-gray-500">
                {participants.filter(p => p.isActive).length} participant{participants.filter(p => p.isActive).length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button
                size="sm"
                variant="outline"
                onClick={toggleFullscreen}
              >
                🔍 Fullscreen
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleLeaveSession}
              >
                ← Back to Session
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={isFullscreen ? "h-full" : "h-[calc(100vh-73px)]"}>
        {isFullscreen && (
          <div className="absolute top-4 right-4 z-10">
            <Button
              size="sm"
              variant="outline"
              onClick={toggleFullscreen}
              className="bg-white shadow-lg"
            >
              ✕ Exit Fullscreen
            </Button>
          </div>
        )}
        
        <CodingInterface
          sessionId={sessionId}
          initialCode={currentSession.code}
          initialLanguage={currentSession.language}
          readOnly={!isInstructor && currentSession.instructorId !== user?.id}
          onCodeChange={handleCodeChange}
          onLanguageChange={handleLanguageChange}
        />
      </div>

      {/* Participants sidebar (only in non-fullscreen mode) */}
      {!isFullscreen && participants.length > 0 && (
        <div className="fixed right-4 top-1/2 transform -translate-y-1/2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-h-96 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Active Participants ({participants.filter(p => p.isActive).length})
          </h3>
          <div className="space-y-2">
            {participants
              .filter(p => p.isActive)
              .map((participant) => (
                <div key={participant.id} className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-xs">
                      {participant.userId.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {participant.userId === currentSession.instructorId ? 'Instructor' : 'Learner'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {participant.role.toLowerCase()}
                    </p>
                  </div>
                  {participant.userId === currentSession.instructorId && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      Host
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
