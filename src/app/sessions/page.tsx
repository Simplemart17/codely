'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/user-store';
import { SessionList } from '@/components/sessions/session-list';
import { CreateSessionForm } from '@/components/sessions/create-session-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SessionsPage() {
  const { user, setUser } = useUserStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'my-sessions' | 'public'>('all');

  useEffect(() => {
    // Get user data from Supabase
    const supabase = createClient();
    
    const getUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (authUser) {
        // Convert Supabase user to our User type
        const userData = {
          id: authUser.id,
          email: authUser.email || '',
          name: authUser.user_metadata?.name || authUser.email || '',
          role: (authUser.user_metadata?.role || 'LEARNER') as 'INSTRUCTOR' | 'LEARNER',
          avatar: authUser.user_metadata?.avatar_url,
          preferences: {
            theme: 'light' as const,
            fontSize: 14,
            keyBindings: 'vscode' as const,
          },
          createdAt: new Date(authUser.created_at),
          updatedAt: new Date(),
        };
        
        setUser(userData);
      }
    };

    getUser();
  }, [setUser]);

  const handleCreateSession = () => {
    setShowCreateForm(true);
  };

  const handleCreateSuccess = (sessionId: string) => {
    setShowCreateForm(false);
    // Could navigate to the new session or refresh the list
    console.log('Session created:', sessionId);
  };

  const handleCreateCancel = () => {
    setShowCreateForm(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please log in to access your coding sessions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="/login">Sign In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <CreateSessionForm
            onSuccess={handleCreateSuccess}
            onCancel={handleCreateCancel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Coding Sessions
            </h1>
            <p className="mt-2 text-gray-600">
              Manage your collaborative coding sessions
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="mb-6">
            <nav className="flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('all')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All Sessions
              </button>
              <button
                onClick={() => setActiveTab('my-sessions')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'my-sessions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                My Sessions
              </button>
              <button
                onClick={() => setActiveTab('public')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'public'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Public Sessions
              </button>
            </nav>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Active Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">3</div>
                <p className="text-xs text-gray-600">Currently running</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Participants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">24</div>
                <p className="text-xs text-gray-600">Across all sessions</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">This Week</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">7</div>
                <p className="text-xs text-gray-600">Sessions created</p>
              </CardContent>
            </Card>
          </div>

          {/* Session List */}
          <SessionList
            filter={activeTab}
            onCreateSession={handleCreateSession}
            showCreateButton={user.role === 'INSTRUCTOR'}
          />
        </div>
      </div>
    </div>
  );
}
