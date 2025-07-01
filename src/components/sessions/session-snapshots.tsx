'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Code,
  Download,
  Clock,
  User,
  Trash2,
  Eye,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SessionSnapshot, CreateSnapshotData } from '@/types';

interface SessionSnapshotsProps {
  sessionId: string;
  currentCode: string;
  isInstructor: boolean;
  onRestoreSnapshot?: (code: string) => void;
  className?: string;
}

export function SessionSnapshots({ 
  sessionId, 
  currentCode,
  isInstructor, 
  onRestoreSnapshot,
  className 
}: SessionSnapshotsProps) {
  const [snapshots, setSnapshots] = useState<SessionSnapshot[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSnapshots = useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      const mockSnapshots: SessionSnapshot[] = [
        {
          id: 'snap_1',
          sessionId,
          title: 'Initial Setup',
          description: 'Basic HTML structure and CSS setup',
          code: '<!DOCTYPE html>\n<html>\n<head>\n  <title>My App</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>',
          metadata: { 
            language: 'html',
            participants: 3,
            lineCount: 8
          },
          createdBy: 'user_1',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
        {
          id: 'snap_2',
          sessionId,
          title: 'Added JavaScript',
          description: 'Added event handlers and basic functionality',
          code: '<!DOCTYPE html>\n<html>\n<head>\n  <title>My App</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n  <button onclick="alert(\'Hello!\')">Click me</button>\n  <script>\n    console.log("App loaded");\n  </script>\n</body>\n</html>',
          metadata: { 
            language: 'html',
            participants: 3,
            lineCount: 12
          },
          createdBy: 'user_1',
          createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        },
      ];
      setSnapshots(mockSnapshots);
    } catch (error) {
      console.error('Failed to fetch snapshots:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const handleCreateSnapshot = async (data: CreateSnapshotData) => {
    try {
      // TODO: Replace with actual API call
      const newSnapshot: SessionSnapshot = {
        id: `snap_${Date.now()}`,
        sessionId: data.sessionId,
        title: data.title,
        description: data.description,
        code: data.code,
        metadata: {
          ...data.metadata,
          lineCount: data.code.split('\n').length,
          createdAt: new Date().toISOString(),
        },
        createdBy: 'current_user_id', // TODO: Get from auth context
        createdAt: new Date(),
      };
      
      setSnapshots(prev => [newSnapshot, ...prev]);
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create snapshot:', error);
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    try {
      // TODO: Replace with actual API call
      setSnapshots(prev => prev.filter(snap => snap.id !== snapshotId));
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
    }
  };

  const handleRestoreSnapshot = (snapshot: SessionSnapshot) => {
    if (onRestoreSnapshot) {
      onRestoreSnapshot(snapshot.code);
    }
  };

  const exportSnapshot = (snapshot: SessionSnapshot) => {
    const dataStr = JSON.stringify({
      title: snapshot.title,
      description: snapshot.description,
      code: snapshot.code,
      metadata: snapshot.metadata,
      createdAt: snapshot.createdAt,
    }, null, 2);
    
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${snapshot.title.replace(/\s+/g, '_')}_snapshot.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Session Snapshots</h3>
        
        <Button
          onClick={() => setShowCreateForm(true)}
          size="sm"
          className="flex items-center gap-2"
        >
          <Camera className="h-4 w-4" />
          Create Snapshot
        </Button>
      </div>

      {showCreateForm && (
        <SnapshotForm
          sessionId={sessionId}
          currentCode={currentCode}
          onSubmit={handleCreateSnapshot}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : snapshots.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Camera className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center">
                No snapshots created yet. Capture important moments in your coding session.
              </p>
            </CardContent>
          </Card>
        ) : (
          snapshots.map((snapshot) => (
            <SnapshotCard
              key={snapshot.id}
              snapshot={snapshot}
              isInstructor={isInstructor}
              onRestore={handleRestoreSnapshot}
              onDelete={handleDeleteSnapshot}
              onExport={exportSnapshot}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface SnapshotFormProps {
  sessionId: string;
  currentCode: string;
  onSubmit: (data: CreateSnapshotData) => void;
  onCancel: () => void;
}

function SnapshotForm({ sessionId, currentCode, onSubmit, onCancel }: SnapshotFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      sessionId,
      title: title.trim(),
      description: description.trim() || undefined,
      code: currentCode,
      metadata: {
        lineCount: currentCode.split('\n').length,
        characterCount: currentCode.length,
        timestamp: new Date().toISOString(),
      },
    });

    // Reset form
    setTitle('');
    setDescription('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Create Snapshot</CardTitle>
        <CardDescription>
          Save the current state of your code for future reference
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Snapshot Title
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Added user authentication"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what was accomplished in this snapshot"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">Code Preview:</div>
            <div className="text-xs text-gray-500">
              {currentCode.split('\n').length} lines, {currentCode.length} characters
            </div>
            <pre className="text-xs bg-white p-2 rounded border mt-2 max-h-32 overflow-y-auto">
              {currentCode.slice(0, 200)}
              {currentCode.length > 200 && '...'}
            </pre>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              Create Snapshot
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface SnapshotCardProps {
  snapshot: SessionSnapshot;
  isInstructor: boolean;
  onRestore: (snapshot: SessionSnapshot) => void;
  onDelete: (id: string) => void;
  onExport: (snapshot: SessionSnapshot) => void;
}

function SnapshotCard({ 
  snapshot, 
  isInstructor, 
  onRestore, 
  onDelete, 
  onExport 
}: SnapshotCardProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Camera className="h-4 w-4 text-gray-500" />
              <h4 className="font-medium">{snapshot.title}</h4>
              <Badge variant="outline" className="text-xs">
                {snapshot.metadata.lineCount || 0} lines
              </Badge>
            </div>
            
            {snapshot.description && (
              <p className="text-sm text-gray-600 mb-2">{snapshot.description}</p>
            )}
            
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Created by {snapshot.creator?.name || 'Unknown'}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(snapshot.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1"
            >
              <Eye className="h-3 w-3" />
              {showPreview ? 'Hide' : 'Preview'}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRestore(snapshot)}
              className="flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Restore
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => onExport(snapshot)}
              className="flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Export
            </Button>
            
            {isInstructor && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(snapshot.id)}
                className="flex items-center gap-1 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            )}
          </div>
        </div>

        {showPreview && (
          <div className="mt-4 border-t pt-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Code className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Code Preview</span>
              </div>
              <pre className="text-xs bg-white p-3 rounded border max-h-64 overflow-auto">
                {snapshot.code}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
