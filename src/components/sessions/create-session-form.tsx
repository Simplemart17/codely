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
    language: '' as Language, // No default language - force user to choose
    maxParticipants: 10,
    isPublic: true,
    objectives: [],
    tags: [],
    estimatedDuration: 60,
    difficulty: 'BEGINNER',
    prerequisites: '',
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [newObjective, setNewObjective] = useState('');
  const [newTag, setNewTag] = useState('');

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = 'Session title is required';
    } else if (formData.title.length < 3) {
      errors.title = 'Title must be at least 3 characters';
    }

    if (!formData.language || formData.language === '') {
      errors.language = 'Programming language is required';
    }

    if (formData.maxParticipants < 1) {
      errors.maxParticipants = 'Must allow at least 1 participant';
    } else if (formData.maxParticipants > 50) {
      errors.maxParticipants = 'Maximum 50 participants allowed';
    }

    if (formData.estimatedDuration && (formData.estimatedDuration < 15 || formData.estimatedDuration > 480)) {
      errors.estimatedDuration = 'Duration must be between 15 and 480 minutes';
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

  const addObjective = () => {
    if (newObjective.trim() && !formData.objectives?.includes(newObjective.trim())) {
      setFormData(prev => ({
        ...prev,
        objectives: [...(prev.objectives || []), newObjective.trim()]
      }));
      setNewObjective('');
    }
  };

  const removeObjective = (index: number) => {
    setFormData(prev => ({
      ...prev,
      objectives: prev.objectives?.filter((_, i) => i !== index) || []
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter((_, i) => i !== index) || []
    }));
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
            <label htmlFor="title" className="block text-sm font-medium text-foreground mb-1">
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
            <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">
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
            <label htmlFor="language" className="block text-sm font-medium text-foreground mb-1">
              Programming Language *
            </label>
            <select
              id="language"
              value={formData.language}
              onChange={(e) => handleInputChange('language', e.target.value as Language)}
              className="w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:border-primary hover:border-border/80"
            >
              <option value="">Select a programming language...</option>
              <option value="JAVASCRIPT">JavaScript</option>
              <option value="PYTHON">Python</option>
              <option value="CSHARP">C#</option>
            </select>
          </div>

          {/* Max Participants */}
          <div>
            <label htmlFor="maxParticipants" className="block text-sm font-medium text-foreground mb-1">
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

          {/* Learning Objectives */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Learning Objectives
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="Add a learning objective..."
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addObjective())}
                />
                <Button type="button" onClick={addObjective} size="sm">
                  Add
                </Button>
              </div>
              {formData.objectives && formData.objectives.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.objectives.map((objective, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-sm"
                    >
                      {objective}
                      <button
                        type="button"
                        onClick={() => removeObjective(index)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Tags
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag..."
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <Button type="button" onClick={addTag} size="sm">
                  Add
                </Button>
              </div>
              {formData.tags && formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-accent text-accent-foreground rounded-md text-sm"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(index)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Difficulty Level */}
          <div>
            <label htmlFor="difficulty" className="block text-sm font-medium text-foreground mb-1">
              Difficulty Level
            </label>
            <select
              id="difficulty"
              value={formData.difficulty}
              onChange={(e) => handleInputChange('difficulty', e.target.value)}
              className="w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:border-primary hover:border-border/80"
            >
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>
          </div>

          {/* Estimated Duration */}
          <div>
            <label htmlFor="estimatedDuration" className="block text-sm font-medium text-foreground mb-1">
              Estimated Duration (minutes)
            </label>
            <Input
              id="estimatedDuration"
              type="number"
              min="15"
              max="480"
              value={formData.estimatedDuration}
              onChange={(e) => handleInputChange('estimatedDuration', parseInt(e.target.value) || 60)}
              placeholder="60"
            />
          </div>

          {/* Prerequisites */}
          <div>
            <label htmlFor="prerequisites" className="block text-sm font-medium text-foreground mb-1">
              Prerequisites
            </label>
            <textarea
              id="prerequisites"
              value={formData.prerequisites}
              onChange={(e) => handleInputChange('prerequisites', e.target.value)}
              placeholder="What should students know before joining this session?"
              rows={2}
              className="w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:border-primary hover:border-border/80"
            />
          </div>

          {/* Public/Private */}
          <div className="flex items-center space-x-2">
            <input
              id="isPublic"
              type="checkbox"
              checked={formData.isPublic}
              onChange={(e) => handleInputChange('isPublic', e.target.checked)}
              className="rounded border-input text-primary focus:ring-primary focus:ring-offset-2"
            />
            <label htmlFor="isPublic" className="text-sm font-medium text-foreground">
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
