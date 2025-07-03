'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSessionStore } from '@/stores/session-store';
import { useUserStore } from '@/stores/user-store';
import type { CreateSessionData, Language } from '@/types';

interface CreateSessionFormProps {
  onSuccess?: (sessionId: string) => void;
  onCancel?: () => void;
}

export function CreateSessionForm({ onSuccess, onCancel }: CreateSessionFormProps) {
  const router = useRouter();
  const { createSession, isLoading, error } = useSessionStore();
  const { user } = useUserStore();
  
  const [formData, setFormData] = useState<CreateSessionData>({
    title: '',
    description: '',
    language: 'JAVASCRIPT',
    maxParticipants: 10,
    isPublic: true,
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = 'Session title is required';
    } else if (formData.title.length < 3) {
      errors.title = 'Title must be at least 3 characters';
    }

    if (formData.maxParticipants < 1) {
      errors.maxParticipants = 'Must allow at least 1 participant';
    } else if (formData.maxParticipants > 50) {
      errors.maxParticipants = 'Maximum 50 participants allowed';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setValidationErrors({ general: 'You must be logged in to create a session' });
      return;
    }

    // Check if user is an instructor
    if (user.role !== 'INSTRUCTOR') {
      setValidationErrors({ general: 'Only instructors can create sessions' });
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      const session = await createSession({
        ...formData,
        instructorId: user.id,
      });

      if (onSuccess) {
        onSuccess(session.id);
      } else {
        router.push(`/sessions/${session.id}`);
      }
    } catch (err) {
      console.error('Failed to create session:', err);

      // Handle specific error messages
      if (err instanceof Error) {
        if (err.message.includes('Only instructors')) {
          setValidationErrors({ general: 'Only instructors can create sessions' });
        } else if (err.message.includes('Unauthorized')) {
          setValidationErrors({ general: 'You must be logged in to create a session' });
        } else {
          setValidationErrors({ general: err.message });
        }
      } else {
        setValidationErrors({ general: 'Failed to create session. Please try again.' });
      }
    }
  };

  const handleInputChange = (field: keyof CreateSessionData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create New Session</CardTitle>
        <CardDescription>
          Start a new collaborative coding session for your students
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Session Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Session Title *
            </label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="e.g., JavaScript Fundamentals"
              className={validationErrors.title ? 'border-red-500' : ''}
            />
            {validationErrors.title && (
              <p className="text-sm text-red-600 mt-1">{validationErrors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Brief description of what you'll be teaching..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {/* Programming Language */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
              Programming Language *
            </label>
            <select
              id="language"
              value={formData.language}
              onChange={(e) => handleInputChange('language', e.target.value as Language)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="JAVASCRIPT">JavaScript</option>
              <option value="PYTHON">Python</option>
              <option value="CSHARP">C#</option>
            </select>
          </div>

          {/* Max Participants */}
          <div>
            <label htmlFor="maxParticipants" className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Participants *
            </label>
            <Input
              id="maxParticipants"
              type="number"
              min="1"
              max="50"
              value={formData.maxParticipants}
              onChange={(e) => handleInputChange('maxParticipants', parseInt(e.target.value) || 1)}
              className={validationErrors.maxParticipants ? 'border-red-500' : ''}
            />
            {validationErrors.maxParticipants && (
              <p className="text-sm text-red-600 mt-1">{validationErrors.maxParticipants}</p>
            )}
          </div>

          {/* Public/Private */}
          <div className="flex items-center space-x-2">
            <input
              id="isPublic"
              type="checkbox"
              checked={formData.isPublic}
              onChange={(e) => handleInputChange('isPublic', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isPublic" className="text-sm font-medium text-gray-700">
              Make this session public (others can discover and join)
            </label>
          </div>

          {/* Error Messages */}
          {(error || validationErrors.general) && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">
                {error || validationErrors.general}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? 'Creating...' : 'Create Session'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
