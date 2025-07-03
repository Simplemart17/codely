'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  SESSION_TEMPLATES, 
  SESSION_CATEGORIES, 
  getTemplatesByLanguage, 
  getTemplatesByCategory,
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

  // Filter templates based on selections
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
        return '🟨';
      case 'PYTHON':
        return '🐍';
      case 'CSHARP':
        return '🔷';
      default:
        return '📝';
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Choose a Session Template</h2>
              <p className="text-muted-foreground mt-1">
                Start with a pre-built template to save time and ensure best practices
              </p>
            </div>
            <Button variant="outline" onClick={onClose}>
              ✕ Close
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mt-4">
            {/* Category Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-foreground">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-sm border-2 border-input bg-background text-foreground rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <option value="ALL">All Categories</option>
                {SESSION_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-foreground">Difficulty:</span>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="text-sm border-2 border-input bg-background text-foreground rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <option value="ALL">All Levels</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>

            {selectedLanguage && (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-foreground">Language:</span>
                <Badge variant="outline" className="text-sm">
                  {getLanguageIcon(selectedLanguage)} {selectedLanguage}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-lg font-medium text-foreground mb-2">No templates found</h3>
              <p className="text-muted-foreground">
                Try adjusting your filters or create a custom session
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <Card 
                  key={template.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50"
                  onClick={() => onSelectTemplate(template)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">
                          {getLanguageIcon(template.language)}
                        </span>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getDifficultyColor(template.difficulty)}`}
                      >
                        {template.difficulty}
                      </Badge>
                    </div>
                    <CardDescription className="text-sm">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {/* Duration and Category */}
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>⏱️ {template.estimatedDuration} min</span>
                        <span>📚 {SESSION_CATEGORIES.find(c => c.id === template.category)?.name}</span>
                      </div>

                      {/* Objectives Preview */}
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">Learning Objectives:</p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {template.objectives.slice(0, 2).map((objective, index) => (
                            <li key={index} className="flex items-start">
                              <span className="mr-1">•</span>
                              <span>{objective}</span>
                            </li>
                          ))}
                          {template.objectives.length > 2 && (
                            <li className="text-primary">
                              +{template.objectives.length - 2} more objectives
                            </li>
                          )}
                        </ul>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1">
                        {template.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {template.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{template.tags.length - 3}
                          </Badge>
                        )}
                      </div>

                      {/* Use Template Button */}
                      <Button 
                        className="w-full mt-3" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTemplate(template);
                        }}
                      >
                        Use This Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
            </p>
            <Button variant="outline" onClick={onClose}>
              Create Custom Session Instead
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
