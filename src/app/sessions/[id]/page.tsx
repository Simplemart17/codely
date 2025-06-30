'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSessionStore } from '@/stores/session-store';
import { useUserStore } from '@/stores/user-store';
import { formatDate } from '@/lib/utils';

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  
  const { currentSession, participants, fetchSession, joinSession, leaveSession, isLoading, error } = useSessionStore();
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
      await joinSession(sessionId, user.id);
      // Navigate to the coding interface (to be implemented)
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
      await leaveSession(sessionId, user.id);
    } catch (err) {
      console.error('Failed to leave session:', err);
    }
  };

  const getLanguageLabel = (language: string): string => {
    switch (language) {
      case 'JAVASCRIPT': return 'JavaScript';
      case 'PYTHON': return 'Python';
      case 'CSHARP': return 'C#';
      default: return language;
    }
  };

  const isParticipant = user && participants.some(p => p.userId === user.id && p.isActive);
  const isInstructor = user && currentSession?.instructorId === user.id;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading session...</p>
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
              {error || 'The session you are looking for does not exist or has been removed.'}
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {currentSession.title}
                </h1>
                <p className="mt-2 text-gray-600">
                  {currentSession.description || 'No description provided'}
                </p>
              </div>
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => router.push('/sessions')}
                >
                  Back to Sessions
                </Button>
                {isInstructor ? (
                  <Button onClick={() => router.push(`/sessions/${sessionId}/code`)}>
                    Manage Session
                  </Button>
                ) : isParticipant ? (
                  <div className="flex space-x-2">
                    <Button onClick={() => router.push(`/sessions/${sessionId}/code`)}>
                      Continue Coding
                    </Button>
                    <Button variant="outline" onClick={handleLeaveSession}>
                      Leave Session
                    </Button>
                  </div>
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
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Session Details */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Session Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Language</label>
                      <p className="text-lg font-semibold">{getLanguageLabel(currentSession.language)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Status</label>
                      <p className={`text-lg font-semibold ${
                        currentSession.status === 'ACTIVE' ? 'text-green-600' :
                        currentSession.status === 'PAUSED' ? 'text-yellow-600' :
                        'text-gray-600'
                      }`}>
                        {currentSession.status.toLowerCase()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Participants</label>
                      <p className="text-lg font-semibold">
                        {participants.filter(p => p.isActive).length} / {currentSession.maxParticipants}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Visibility</label>
                      <p className="text-lg font-semibold">
                        {currentSession.isPublic ? 'Public' : 'Private'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Created</label>
                      <p className="text-lg font-semibold">{formatDate(currentSession.createdAt)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Last Updated</label>
                      <p className="text-lg font-semibold">{formatDate(currentSession.updatedAt)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Code Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Code Preview</CardTitle>
                  <CardDescription>
                    Current code in the session
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-md font-mono text-sm overflow-x-auto">
                    <pre>{currentSession.code || '// No code yet...'}</pre>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Participants */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Participants ({participants.filter(p => p.isActive).length})</CardTitle>
                  <CardDescription>
                    Active session participants
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {participants.filter(p => p.isActive).length === 0 ? (
                      <p className="text-gray-500 text-center py-4">
                        No active participants
                      </p>
                    ) : (
                      participants
                        .filter(p => p.isActive)
                        .map((participant) => (
                          <div key={participant.id} className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-semibold text-sm">
                                {participant.userId.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {participant.userId === currentSession.instructorId ? 'Instructor' : 'Learner'}
                              </p>
                              <p className="text-sm text-gray-600">
                                {participant.role.toLowerCase()}
                              </p>
                            </div>
                            {participant.userId === currentSession.instructorId && (
                              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                Host
                              </span>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
