'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUserStore } from '@/stores/user-store';
import type { Language } from '@/types';

interface EditorToolbarProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onRun: () => void;
  onSave: () => void;
  onFormat: () => void;
  isRunning?: boolean;
  isSaving?: boolean;
  canChangeLanguage?: boolean;
  showRunButton?: boolean;
}

const LANGUAGE_OPTIONS = [
  { value: 'JAVASCRIPT', label: 'JavaScript', icon: '🟨' },
  { value: 'PYTHON', label: 'Python', icon: '🐍' },
  { value: 'CSHARP', label: 'C#', icon: '🔷' },
] as const;

export function EditorToolbar({
  language,
  onLanguageChange,
  onRun,
  onSave,
  onFormat,
  isRunning = false,
  isSaving = false,
  canChangeLanguage = true,
  showRunButton = true,
}: EditorToolbarProps) {
  const { user } = useUserStore();
  const [showSettings, setShowSettings] = useState(false);

  const currentLanguage = LANGUAGE_OPTIONS.find(lang => lang.value === language);

  const handleLanguageChange = (newLanguage: Language) => {
    if (canChangeLanguage) {
      onLanguageChange(newLanguage);
    }
  };

  // Keyboard shortcut handler (for future use)
  // const handleKeyboardShortcut = (action: string) => {
  //   switch (action) {
  //     case 'run':
  //       if (showRunButton && !isRunning) {
  //         onRun();
  //       }
  //       break;
  //     case 'save':
  //       if (!isSaving) {
  //         onSave();
  //       }
  //       break;
  //     case 'format':
  //       onFormat();
  //       break;
  //   }
  // };

  return (
    <Card className="border-b border-border rounded-none">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          {/* Left side - Language and actions */}
          <div className="flex items-center space-x-3">
            {/* Language Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-foreground">Language:</span>
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value as Language)}
                disabled={!canChangeLanguage}
                className="text-sm border-2 border-input rounded px-2 py-1 bg-background text-foreground disabled:bg-muted disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.icon} {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              {showRunButton && (
                <Button
                  size="sm"
                  onClick={onRun}
                  disabled={isRunning}
                  className="bg-success text-success-foreground hover:bg-success/90"
                >
                  {isRunning ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></div>
                      Running...
                    </>
                  ) : (
                    <>
                      ▶️ Run
                    </>
                  )}
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={onSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    💾 Save
                  </>
                )}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={onFormat}
              >
                ✨ Format
              </Button>
            </div>
          </div>

          {/* Right side - Settings and info */}
          <div className="flex items-center space-x-3">
            {/* Current language info */}
            <div className="hidden sm:flex items-center space-x-2 text-sm text-muted-foreground">
              <span>{currentLanguage?.icon}</span>
              <span>{currentLanguage?.label}</span>
            </div>

            {/* User info */}
            {user && (
              <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-primary font-semibold text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span>{user.name}</span>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                  {user.role.toLowerCase()}
                </span>
              </div>
            )}

            {/* Settings Button */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSettings(!showSettings)}
              className="p-1"
            >
              ⚙️
            </Button>
          </div>
        </div>

        {/* Keyboard Shortcuts Info */}
        <div className="mt-2 text-xs text-muted-foreground hidden lg:block">
          <span className="mr-4">
            <kbd className="px-1 py-0.5 bg-muted text-muted-foreground rounded">Ctrl+S</kbd> Save
          </span>
          {showRunButton && (
            <span className="mr-4">
              <kbd className="px-1 py-0.5 bg-muted text-muted-foreground rounded">Ctrl+Enter</kbd> Run
            </span>
          )}
          <span className="mr-4">
            <kbd className="px-1 py-0.5 bg-muted text-muted-foreground rounded">Shift+Alt+F</kbd> Format
          </span>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-3 p-3 bg-muted rounded border border-border">
            <h4 className="text-sm font-medium text-foreground mb-2">Editor Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <label className="block text-muted-foreground mb-1">Font Size</label>
                <select className="w-full text-xs border-2 border-input bg-background text-foreground rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                  <option value="12">12px</option>
                  <option value="14" selected>14px</option>
                  <option value="16">16px</option>
                  <option value="18">18px</option>
                </select>
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Theme</label>
                <select className="w-full text-xs border-2 border-input bg-background text-foreground rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Key Bindings</label>
                <select className="w-full text-xs border-2 border-input bg-background text-foreground rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                  <option value="vscode">VS Code</option>
                  <option value="vim">Vim</option>
                  <option value="emacs">Emacs</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default EditorToolbar;
