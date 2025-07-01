'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Users,
  Clock,
  Code,
  Play,
  Camera,
  Download,
  RefreshCw,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions, WithPermission } from '@/hooks/use-permissions';
import { Permission } from '@/lib/permissions';
import type {
  SessionAnalytics,
  ParticipantAnalytics,
  EngagementMetrics
} from '@/types';

interface SessionAnalyticsProps {
  sessionId: string;
  className?: string;
}

export function SessionAnalytics({ sessionId, className }: SessionAnalyticsProps) {
  const { canAnalyze } = usePermissions();
  const [analytics, setAnalytics] = useState<SessionAnalytics | null>(null);
  const [engagementMetrics, setEngagementMetrics] = useState<EngagementMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | 'all'>('all');

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API calls
      const mockAnalytics: SessionAnalytics = {
        sessionId,
        totalDuration: 3600, // 1 hour
        participantCount: 5,
        peakParticipants: 7,
        codeChanges: 45,
        executionCount: 12,
        snapshotCount: 3,
        averageEngagement: 78,
        participantAnalytics: [
          {
            participantId: 'p1',
            userId: 'u1',
            userName: 'John Doe',
            role: 'INSTRUCTOR',
            joinTime: new Date(Date.now() - 3600000),
            totalActiveTime: 3600,
            codeContributions: 25,
            executionCount: 8,
            engagementScore: 95,
          },
          {
            participantId: 'p2',
            userId: 'u2',
            userName: 'Jane Smith',
            role: 'LEARNER',
            joinTime: new Date(Date.now() - 3000000),
            totalActiveTime: 2800,
            codeContributions: 15,
            executionCount: 3,
            engagementScore: 82,
          },
          {
            participantId: 'p3',
            userId: 'u3',
            userName: 'Bob Wilson',
            role: 'LEARNER',
            joinTime: new Date(Date.now() - 2400000),
            totalActiveTime: 2100,
            codeContributions: 5,
            executionCount: 1,
            engagementScore: 65,
          },
        ],
        timelineEvents: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockEngagement: EngagementMetrics = {
        activeParticipants: 4,
        totalParticipants: 5,
        averageSessionTime: 2800,
        codeChangesPerMinute: 0.75,
        executionsPerMinute: 0.2,
        engagementTrend: [],
      };

      setAnalytics(mockAnalytics);
      setEngagementMetrics(mockEngagement);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (canAnalyze) {
      fetchAnalytics();
    }
  }, [canAnalyze, fetchAnalytics]);

  const exportAnalytics = () => {
    if (!analytics) return;
    
    const data = {
      session: analytics,
      engagement: engagementMetrics,
      exportedAt: new Date().toISOString(),
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `session_${sessionId}_analytics.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (!canAnalyze) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <BarChart3 className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 text-center">
            You don't have permission to view session analytics.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!analytics || !engagementMetrics) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <BarChart3 className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 text-center">
            No analytics data available for this session.
          </p>
          <Button onClick={fetchAnalytics} className="mt-4" size="sm">
            Refresh Data
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Session Analytics</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border rounded-lg p-1">
            {(['1h', '24h', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'px-3 py-1 text-xs rounded transition-colors',
                  timeRange === range
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                {range === 'all' ? 'All Time' : range.toUpperCase()}
              </button>
            ))}
          </div>
          
          <WithPermission permission={Permission.EXPORT_DATA}>
            <Button
              size="sm"
              variant="outline"
              onClick={exportAnalytics}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </WithPermission>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={Clock}
          label="Total Duration"
          value={formatDuration(analytics.totalDuration)}
          color="blue"
        />
        <MetricCard
          icon={Users}
          label="Participants"
          value={`${analytics.participantCount} (peak: ${analytics.peakParticipants})`}
          color="green"
        />
        <MetricCard
          icon={Code}
          label="Code Changes"
          value={analytics.codeChanges.toString()}
          color="purple"
        />
        <MetricCard
          icon={Target}
          label="Avg. Engagement"
          value={`${analytics.averageEngagement}%`}
          color="orange"
        />
      </div>

      {/* Engagement Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Engagement Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {engagementMetrics.activeParticipants}
              </div>
              <div className="text-sm text-gray-500">Active Now</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatDuration(engagementMetrics.averageSessionTime)}
              </div>
              <div className="text-sm text-gray-500">Avg. Session Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {engagementMetrics.codeChangesPerMinute.toFixed(1)}
              </div>
              <div className="text-sm text-gray-500">Changes/min</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {engagementMetrics.executionsPerMinute.toFixed(1)}
              </div>
              <div className="text-sm text-gray-500">Executions/min</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participant Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Participant Performance</CardTitle>
          <CardDescription>
            Individual participant engagement and contribution metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.participantAnalytics.map((participant) => (
              <ParticipantAnalyticsCard
                key={participant.participantId}
                participant={participant}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Code Changes</span>
              </div>
              <span className="font-medium">{analytics.codeChanges}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 text-green-500" />
                <span className="text-sm">Code Executions</span>
              </div>
              <span className="font-medium">{analytics.executionCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Snapshots Created</span>
              </div>
              <span className="font-medium">{analytics.snapshotCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Engagement Score</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-gray-200 rounded-full">
                  <div 
                    className="h-2 bg-green-500 rounded-full"
                    style={{ width: `${analytics.averageEngagement}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{analytics.averageEngagement}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Participation Rate</span>
              <span className="text-sm font-medium">
                {Math.round((engagementMetrics.activeParticipants / engagementMetrics.totalParticipants) * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Activity Level</span>
              <Badge variant="outline" className="text-xs">
                {analytics.averageEngagement > 80 ? 'High' : 
                 analytics.averageEngagement > 60 ? 'Medium' : 'Low'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function MetricCard({ icon: Icon, label, value, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
    orange: 'text-orange-600 bg-orange-50',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', colorClasses[color])}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm text-gray-500">{label}</div>
            <div className="font-semibold">{value}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ParticipantAnalyticsCardProps {
  participant: ParticipantAnalytics;
}

function ParticipantAnalyticsCard({ participant }: ParticipantAnalyticsCardProps) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
          <span className="text-sm font-medium text-blue-700">
            {participant.userName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <div className="font-medium">{participant.userName}</div>
          <div className="text-sm text-gray-500">
            {participant.role.toLowerCase()} • {formatDuration(participant.totalActiveTime)}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4 text-sm">
        <div className="text-center">
          <div className="font-medium">{participant.codeContributions}</div>
          <div className="text-gray-500">Changes</div>
        </div>
        <div className="text-center">
          <div className="font-medium">{participant.executionCount}</div>
          <div className="text-gray-500">Runs</div>
        </div>
        <div className="text-center">
          <div className="font-medium">{participant.engagementScore}%</div>
          <div className="text-gray-500">Engagement</div>
        </div>
      </div>
    </div>
  );
}
