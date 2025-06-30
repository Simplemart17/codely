'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  Square, 
  Video, 
  Download, 
  Share2, 
  Clock,
  Eye,
  EyeOff,
  Trash2,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SessionRecording, CreateRecordingData } from '@/types';

interface SessionRecordingProps {
  sessionId: string;
  isInstructor: boolean;
  className?: string;
}

export function SessionRecording({ 
  sessionId, 
  isInstructor, 
  className 
}: SessionRecordingProps) {
  const [recordings, setRecordings] = useState<SessionRecording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    fetchRecordings();
  }, [sessionId]);

  useEffect(() => {
    if (isRecording && !isPaused) {
      intervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRecording, isPaused]);

  const fetchRecordings = async () => {
    try {
      // TODO: Replace with actual API call
      const mockRecordings: SessionRecording[] = [
        {
          id: 'rec_1',
          sessionId,
          title: 'JavaScript Basics - Session 1',
          description: 'Introduction to variables and functions',
          duration: 3600, // 1 hour
          fileUrl: '/recordings/session_1.mp4',
          thumbnailUrl: '/recordings/session_1_thumb.jpg',
          isPublic: false,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      ];
      setRecordings(mockRecordings);
    } catch (error) {
      console.error('Failed to fetch recordings:', error);
    }
  };

  const startRecording = async () => {
    try {
      // TODO: Implement actual recording logic
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);
      console.log('Starting recording for session:', sessionId);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const pauseRecording = () => {
    setIsPaused(true);
  };

  const resumeRecording = () => {
    setIsPaused(false);
  };

  const stopRecording = async () => {
    try {
      // TODO: Implement actual recording stop logic
      setIsRecording(false);
      setIsPaused(false);
      setShowCreateForm(true);
      console.log('Stopping recording, duration:', recordingDuration);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const handleCreateRecording = async (data: CreateRecordingData) => {
    try {
      // TODO: Replace with actual API call
      const newRecording: SessionRecording = {
        id: `rec_${Date.now()}`,
        sessionId: data.sessionId,
        title: data.title,
        description: data.description,
        duration: recordingDuration,
        fileUrl: `/recordings/session_${Date.now()}.mp4`,
        thumbnailUrl: `/recordings/session_${Date.now()}_thumb.jpg`,
        isPublic: data.isPublic,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      setRecordings(prev => [newRecording, ...prev]);
      setShowCreateForm(false);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Failed to save recording:', error);
    }
  };

  const handleDeleteRecording = async (recordingId: string) => {
    try {
      // TODO: Replace with actual API call
      setRecordings(prev => prev.filter(rec => rec.id !== recordingId));
    } catch (error) {
      console.error('Failed to delete recording:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Session Recording</h3>
        
        {isInstructor && (
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                size="sm"
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
              >
                <Video className="h-4 w-4" />
                Start Recording
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                  <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-red-700">
                    {formatDuration(recordingDuration)}
                  </span>
                </div>
                
                {isPaused ? (
                  <Button
                    onClick={resumeRecording}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Resume
                  </Button>
                ) : (
                  <Button
                    onClick={pauseRecording}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </Button>
                )}
                
                <Button
                  onClick={stopRecording}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Square className="h-4 w-4" />
                  Stop
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateForm && (
        <RecordingForm
          sessionId={sessionId}
          duration={recordingDuration}
          onSubmit={handleCreateRecording}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      <div className="space-y-3">
        {recordings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Video className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center">
                No recordings available yet. Start recording to capture your session.
              </p>
            </CardContent>
          </Card>
        ) : (
          recordings.map((recording) => (
            <RecordingCard
              key={recording.id}
              recording={recording}
              isInstructor={isInstructor}
              onDelete={handleDeleteRecording}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface RecordingFormProps {
  sessionId: string;
  duration: number;
  onSubmit: (data: CreateRecordingData) => void;
  onCancel: () => void;
}

function RecordingForm({ sessionId, duration, onSubmit, onCancel }: RecordingFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      sessionId,
      title: title.trim(),
      description: description.trim() || undefined,
      isPublic,
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Save Recording</CardTitle>
        <CardDescription>
          Recording completed ({formatDuration(duration)}). Add details to save it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Title
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter recording title"
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
              placeholder="Add a description for this recording"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="isPublic" className="text-sm font-medium">
              Make this recording public
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              Save Recording
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Discard
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface RecordingCardProps {
  recording: SessionRecording;
  isInstructor: boolean;
  onDelete: (id: string) => void;
}

function RecordingCard({ recording, isInstructor, onDelete }: RecordingCardProps) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Video className="h-4 w-4 text-gray-500" />
              <h4 className="font-medium">{recording.title}</h4>
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                {recording.isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {recording.isPublic ? 'Public' : 'Private'}
              </Badge>
            </div>
            
            {recording.description && (
              <p className="text-sm text-gray-600 mb-2">{recording.description}</p>
            )}
            
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(recording.duration)}
              </div>
              <span>
                Created {new Date(recording.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
            >
              <Play className="h-3 w-3" />
              Play
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Download
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
            >
              <Share2 className="h-3 w-3" />
              Share
            </Button>
            
            {isInstructor && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(recording.id)}
                className="flex items-center gap-1 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
