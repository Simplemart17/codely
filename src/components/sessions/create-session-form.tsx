'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSessionStore } from '@/stores/session-store';
import { useUserStore } from '@/stores/user-store';
import type { Language } from '@/types';

interface CreateSessionFormProps {
  onSuccess?: (sessionId: string) => void;
  onCancel?: () => void;
}

export function CreateSessionForm({ onSuccess, onCancel }: CreateSessionFormProps) {
  const router = useRouter();
  const { createSession, isLoading, error } = useSessionStore();
  const { user } = useUserStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState<Language | ''>('');
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [isPublic, setIsPublic] = useState(true);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!title.trim()) {
      errors.title = 'Session title is required';
    } else if (title.length < 3) {
      errors.title = 'Title must be at least 3 characters';
    }

    if (!language) {
      errors.language = 'Programming language is required';
    }

    if (maxParticipants < 2) {
      errors.maxParticipants = 'Must allow at least 2 participants';
    } else if (maxParticipants > 50) {
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

    if (user.role !== 'INSTRUCTOR') {
      setValidationErrors({ general: 'Only instructors can create sessions' });
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      const session = await createSession({
        title,
        description,
        language: language as Language,
        maxParticipants,
        isPublic,
        instructorId: user.id,
      });

      if (onSuccess) {
        onSuccess(session.id);
      } else {
        router.push(`/sessions/${session.id}`);
      }
    } catch (err) {
      console.error('Failed to create session:', err);

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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Session Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Session Title *</Label>
        <Input
          id="title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (validationErrors.title) {
              setValidationErrors(prev => ({ ...prev, title: '' }));
            }
          }}
          placeholder="e.g., JavaScript Fundamentals"
          aria-invalid={!!validationErrors.title}
        />
        {validationErrors.title && (
          <p className="text-sm text-destructive">{validationErrors.title}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of what you'll be teaching..."
          rows={2}
        />
      </div>

      {/* Language + Max Participants row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Language *</Label>
          <Select
            value={language || undefined}
            onValueChange={(v) => {
              setLanguage(v as Language);
              if (validationErrors.language) {
                setValidationErrors(prev => ({ ...prev, language: '' }));
              }
            }}
          >
            <SelectTrigger
              className="w-full"
              aria-invalid={!!validationErrors.language}
            >
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="JAVASCRIPT">JavaScript</SelectItem>
              <SelectItem value="PYTHON">Python</SelectItem>
              <SelectItem value="CSHARP">C#</SelectItem>
            </SelectContent>
          </Select>
          {validationErrors.language && (
            <p className="text-sm text-destructive">{validationErrors.language}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxParticipants">Max Participants *</Label>
          <Input
            id="maxParticipants"
            type="number"
            min="2"
            max="50"
            value={maxParticipants}
            onChange={(e) => {
              setMaxParticipants(parseInt(e.target.value) || 2);
              if (validationErrors.maxParticipants) {
                setValidationErrors(prev => ({ ...prev, maxParticipants: '' }));
              }
            }}
            aria-invalid={!!validationErrors.maxParticipants}
          />
          {validationErrors.maxParticipants && (
            <p className="text-sm text-destructive">{validationErrors.maxParticipants}</p>
          )}
        </div>
      </div>

      {/* Public toggle */}
      <div className="flex items-center gap-2">
        <input
          id="isPublic"
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="size-4 rounded border-input accent-primary"
        />
        <Label htmlFor="isPublic" className="font-normal">
          Make this session public
        </Label>
      </div>

      {/* Error Messages */}
      {(error || validationErrors.general) && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">
            {error || validationErrors.general}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-2">
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
  );
}
