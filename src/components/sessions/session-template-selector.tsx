'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  SESSION_TEMPLATES,
  SESSION_CATEGORIES,
  getTemplatesByLanguage,
  type SessionTemplate
} from '@/lib/session-templates';
import type { Language } from '@/types';

interface SessionTemplateSelectorProps {
  onSelectTemplate: (template: SessionTemplate) => void;
  selectedLanguage?: Language;
  onClose: () => void;
}

export function SessionTemplateSelector({
  onSelectTemplate,
  selectedLanguage,
  onClose
}: SessionTemplateSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('ALL');

  let filteredTemplates = SESSION_TEMPLATES;

  if (selectedLanguage) {
    filteredTemplates = getTemplatesByLanguage(selectedLanguage);
  }

  if (selectedCategory !== 'ALL') {
    filteredTemplates = filteredTemplates.filter(
      template => template.category === selectedCategory
    );
  }

  if (selectedDifficulty !== 'ALL') {
    filteredTemplates = filteredTemplates.filter(
      template => template.difficulty === selectedDifficulty
    );
  }

  const getDifficultyColor = (difficulty: SessionTemplate['difficulty']) => {
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

  const getLanguageIcon = (language: Language) => {
    switch (language) {
      case 'JAVASCRIPT':
        return 'JS';
      case 'PYTHON':
        return 'PY';
      case 'CSHARP':
        return 'C#';
      default:
        return '?';
    }
  };

  return (
    <div className="flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="p-6 pb-4 border-b">
        <h2 className="text-lg font-semibold text-foreground">Choose a Template</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Start with a pre-built template to save time
        </p>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[160px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {SESSION_CATEGORIES.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Difficulty</Label>
            <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
              <SelectTrigger className="w-[140px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Levels</SelectItem>
                <SelectItem value="BEGINNER">Beginner</SelectItem>
                <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                <SelectItem value="ADVANCED">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedLanguage && (
            <div className="flex items-end pb-0.5">
              <Badge variant="outline">
                {getLanguageIcon(selectedLanguage)} {selectedLanguage}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="p-6 overflow-y-auto flex-1">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-base font-medium text-foreground mb-2">No templates found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters or create a custom session
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer transition-colors hover:border-primary/50"
                onClick={() => onSelectTemplate(template)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs font-mono">
                        {getLanguageIcon(template.language)}
                      </Badge>
                      <CardTitle className="text-sm">{template.name}</CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getDifficultyColor(template.difficulty)}`}
                    >
                      {template.difficulty}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {template.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{template.estimatedDuration} min</span>
                      <span>{SESSION_CATEGORIES.find(c => c.id === template.category)?.name}</span>
                    </div>

                    <div>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {template.objectives.slice(0, 2).map((objective, index) => (
                          <li key={index} className="flex items-start gap-1">
                            <span className="shrink-0">&#x2022;</span>
                            <span>{objective}</span>
                          </li>
                        ))}
                        {template.objectives.length > 2 && (
                          <li className="text-primary text-xs">
                            +{template.objectives.length - 2} more
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {template.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs py-0">
                          {tag}
                        </Badge>
                      ))}
                      {template.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs py-0">
                          +{template.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
        </p>
        <Button variant="outline" size="sm" onClick={onClose}>
          Create Custom Instead
        </Button>
      </div>
    </div>
  );
}
