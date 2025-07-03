'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Session } from '@/types';

interface SessionMetadataProps {
  session: Session;
  showTitle?: boolean;
  compact?: boolean;
}

export function SessionMetadata({ session, showTitle = false, compact = false }: SessionMetadataProps) {
  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'BEGINNER':
        return 'bg-success/10 text-success border-success/20';
      case 'INTERMEDIATE':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'ADVANCED':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getLanguageIcon = (language: string) => {
    switch (language) {
      case 'JAVASCRIPT':
        return '🟨';
      case 'PYTHON':
        return '🐍';
      case 'CSHARP':
        return '🔷';
      default:
        return '📝';
    }
  };

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Basic Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getLanguageIcon(session.language)}</span>
            <span className="font-medium text-foreground">{session.language}</span>
          </div>
          {session.difficulty && (
            <Badge variant="outline" className={getDifficultyColor(session.difficulty)}>
              {session.difficulty}
            </Badge>
          )}
        </div>

        {/* Duration and Participants */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          {session.estimatedDuration && (
            <span>⏱️ {session.estimatedDuration} min</span>
          )}
          <span>👥 {session.participants?.length || 0}/{session.maxParticipants}</span>
        </div>

        {/* Tags */}
        {session.tags && session.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {session.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {session.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{session.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        {showTitle && (
          <>
            <CardTitle>{session.title}</CardTitle>
            {session.description && (
              <CardDescription>{session.description}</CardDescription>
            )}
          </>
        )}
        {!showTitle && (
          <CardTitle className="text-lg">Session Details</CardTitle>
        )}
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Language</p>
            <div className="flex items-center space-x-2">
              <span className="text-lg">{getLanguageIcon(session.language)}</span>
              <span className="font-medium text-foreground">{session.language}</span>
            </div>
          </div>

          {session.difficulty && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Difficulty</p>
              <Badge variant="outline" className={getDifficultyColor(session.difficulty)}>
                {session.difficulty}
              </Badge>
            </div>
          )}

          {session.estimatedDuration && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Duration</p>
              <p className="text-foreground">⏱️ {session.estimatedDuration} minutes</p>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Participants</p>
            <p className="text-foreground">👥 {session.participants?.length || 0}/{session.maxParticipants}</p>
          </div>
        </div>

        {/* Learning Objectives */}
        {session.objectives && session.objectives.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Learning Objectives</h4>
            <ul className="space-y-1">
              {session.objectives.map((objective, index) => (
                <li key={index} className="flex items-start text-sm text-muted-foreground">
                  <span className="mr-2 mt-1">•</span>
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Prerequisites */}
        {session.prerequisites && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Prerequisites</h4>
            <p className="text-sm text-muted-foreground">{session.prerequisites}</p>
          </div>
        )}

        {/* Tags */}
        {session.tags && session.tags.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {session.tags.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Session Status */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <span className="text-muted-foreground">
                Status: <span className="text-foreground font-medium">{session.status}</span>
              </span>
              <span className="text-muted-foreground">
                Visibility: <span className="text-foreground font-medium">{session.isPublic ? 'Public' : 'Private'}</span>
              </span>
            </div>
            <div className="text-muted-foreground">
              Created: {new Date(session.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
