'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserStore } from '@/stores/user-store';

interface DashboardStatsData {
  sessionsCreated: number;
  sessionsParticipated: number;
  activeSessions: number;
  totalParticipants: number;
  recentSessions: number;
  userRole: string;
}

export function DashboardStats() {
  const [stats, setStats] = useState<DashboardStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUserStore();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/dashboard/stats');
        
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard stats');
        }
        
        const { stats } = await response.json();
        setStats(stats);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        setError(error instanceof Error ? error.message : 'Failed to load stats');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <div className="h-4 bg-muted rounded animate-pulse"></div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-muted-foreground">
              {error || 'Unable to load dashboard statistics'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isInstructor = stats.userRole === 'INSTRUCTOR';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Sessions Created (Instructors only) */}
      {isInstructor && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sessions Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.sessionsCreated}</div>
            <p className="text-xs text-muted-foreground">
              Total sessions you've created
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sessions Participated */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Sessions Joined
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{stats.sessionsParticipated}</div>
          <p className="text-xs text-muted-foreground">
            Sessions you've participated in
          </p>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Active Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-success">{stats.activeSessions}</div>
          <p className="text-xs text-muted-foreground">
            Currently active sessions
          </p>
        </CardContent>
      </Card>

      {/* Total Participants (Instructors) or Recent Sessions (Learners) */}
      {isInstructor ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.totalParticipants}</div>
            <p className="text-xs text-muted-foreground">
              Across all your sessions
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.recentSessions}</div>
            <p className="text-xs text-muted-foreground">
              Sessions joined this week
            </p>
          </CardContent>
        </Card>
      )}

      {/* Additional stats for instructors */}
      {isInstructor && (
        <Card className="md:col-span-2 lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-lg">Quick Stats</CardTitle>
            <CardDescription>
              Overview of your teaching activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground">{stats.recentSessions}</div>
                <p className="text-sm text-muted-foreground">Sessions this week</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground">
                  {stats.totalParticipants > 0 ? Math.round(stats.totalParticipants / Math.max(stats.sessionsCreated, 1)) : 0}
                </div>
                <p className="text-sm text-muted-foreground">Avg. participants</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-success">{stats.activeSessions}</div>
                <p className="text-sm text-muted-foreground">Active now</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-primary">
                  {stats.sessionsCreated - stats.activeSessions}
                </div>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
