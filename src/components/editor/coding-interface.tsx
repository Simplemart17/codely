'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { MonacoEditor } from './monaco-editor';
import { EditorToolbar } from './editor-toolbar';
import { OutputPanel, createOutputLine } from './output-panel';
import { ConnectionStatus } from './connection-status';
import { codeExecutionService } from '@/lib/code-execution';
import { useSessionStore } from '@/stores/session-store';
import { useUserStore } from '@/stores/user-store';
import { useCollaboration } from '@/hooks/use-collaboration';
import { RealtimeService } from '@/lib/services/realtime-service';
import type { LanguageChangeEvent } from '@/lib/services/realtime-service';
import type { Language } from '@/types';

// Extend Window interface for auto-save timeout
declare global {
  interface Window {
    autoSaveTimeout?: NodeJS.Timeout;
  }
}

interface CodingInterfaceProps {
  sessionId?: string;
  initialCode?: string;
  initialLanguage?: Language;
  readOnly?: boolean;
  showToolbar?: boolean;
  isInstructor?: boolean;
  onCodeChange?: (code: string) => void;
  onLanguageChange?: (language: Language) => void;
}

export function CodingInterface({
  sessionId,
  initialCode = '',
  initialLanguage = 'JAVASCRIPT',
  readOnly = false,
  showToolbar = true,
  isInstructor = false,
  onCodeChange,
  onLanguageChange,
}: CodingInterfaceProps) {
  const { user } = useUserStore();
  const { updateSession } = useSessionStore();

  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [output, setOutput] = useState<
    Array<{
      id: string;
      type: 'stdout' | 'stderr' | 'info' | 'error';
      content: string;
      timestamp: Date;
    }>
  >([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const realtimeServiceRef = useRef<RealtimeService | null>(null);

  // Whether this is a collaborative session (has sessionId and user)
  const isCollaborative = Boolean(sessionId && user);

  // --- CRDT Collaboration ---
  const collaboration = useCollaboration({
    sessionId: sessionId || '',
    user: user
      ? { id: user.id, name: user.name, avatar: user.avatar }
      : { id: '', name: '' },
    initialContent: initialCode,
    enabled: isCollaborative,
  });

  // Non-collaborative code state (used when no session)
  const [localCode, setLocalCode] = useState(initialCode);

  // --- Supabase Realtime for language sync (not code — CRDT handles code) ---
  useEffect(() => {
    if (!sessionId || !user) return;

    const realtimeService = new RealtimeService();
    realtimeServiceRef.current = realtimeService;

    const handleIncomingLanguageChange = (event: LanguageChangeEvent) => {
      if (event.userId !== user.id) {
        setLanguage(event.language as Language);
      }
    };

    realtimeService.onLanguageChange(handleIncomingLanguageChange);
    realtimeService.joinSession(sessionId, user.id, user.name);

    return () => {
      realtimeService.leaveSession();
      realtimeService.cleanup();
      realtimeServiceRef.current = null;
    };
  }, [sessionId, user]);

  // Get current code content
  const getCurrentCode = useCallback((): string => {
    if (isCollaborative) {
      return collaboration.getContent();
    }
    return localCode;
  }, [isCollaborative, collaboration, localCode]);

  // Handle code changes in non-collaborative mode
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setLocalCode(newCode);
      onCodeChange?.(newCode);

      // Auto-save code changes to session (debounced, instructor only)
      if (sessionId && isInstructor) {
        if (window.autoSaveTimeout) {
          clearTimeout(window.autoSaveTimeout);
        }
        window.autoSaveTimeout = setTimeout(() => {
          updateSession(sessionId, {
            code: newCode,
            updatedAt: new Date(),
          }).catch((error) => {
            console.error('Failed to auto-save code:', error);
          });
        }, 1000);
      }
    },
    [onCodeChange, sessionId, updateSession, isInstructor]
  );

  // Auto-save collaborative content periodically (instructor only)
  useEffect(() => {
    if (!isCollaborative || !sessionId || !isInstructor) return;

    const autoSaveInterval = setInterval(() => {
      const content = collaboration.getContent();
      if (content) {
        updateSession(sessionId, {
          code: content,
          updatedAt: new Date(),
        }).catch((error) => {
          console.error('Failed to auto-save collaborative code:', error);
        });
      }
    }, 5000); // Save every 5 seconds

    return () => clearInterval(autoSaveInterval);
  }, [isCollaborative, sessionId, collaboration, updateSession, isInstructor]);

  const handleLanguageChange = useCallback(
    (newLanguage: Language) => {
      setLanguage(newLanguage);
      onLanguageChange?.(newLanguage);

      // Broadcast language change via Supabase Realtime
      if (realtimeServiceRef.current) {
        realtimeServiceRef.current.sendLanguageChange(newLanguage);
      }

      // Persist to session (instructor only)
      if (sessionId && isInstructor) {
        updateSession(sessionId, {
          language: newLanguage,
          updatedAt: new Date(),
        }).catch((error) => {
          console.error('Failed to update session language:', error);
        });
      }
    },
    [onLanguageChange, sessionId, updateSession, isInstructor]
  );

  const handleRun = useCallback(async () => {
    const code = getCurrentCode();
    if (isRunning || !code.trim()) return;

    setIsRunning(true);
    setOutput((prev) => [
      ...prev,
      createOutputLine('info', `Running ${language.toLowerCase()} code...`),
    ]);

    try {
      const result = await codeExecutionService.executeCode(code, language);

      if (result.success) {
        setOutput((prev) => [
          ...prev,
          createOutputLine('stdout', result.output),
          createOutputLine(
            'info',
            `Execution completed in ${result.executionTime}ms`
          ),
        ]);
      } else {
        setOutput((prev) => [
          ...prev,
          createOutputLine('error', result.error || 'Execution failed'),
        ]);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error';
      setOutput((prev) => [
        ...prev,
        createOutputLine(
          'error',
          `Execution failed: ${message}`
        ),
      ]);
    } finally {
      setIsRunning(false);
    }
  }, [getCurrentCode, language, isRunning]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    setOutput((prev) => [
      ...prev,
      createOutputLine('info', 'Saving code...'),
    ]);

    try {
      if (sessionId && isInstructor) {
        const code = getCurrentCode();
        await updateSession(sessionId, {
          code,
          language,
          updatedAt: new Date(),
        });
        setOutput((prev) => [
          ...prev,
          createOutputLine('info', 'Code saved successfully'),
        ]);
      } else if (sessionId) {
        setOutput((prev) => [
          ...prev,
          createOutputLine(
            'info',
            'Code is synced via collaboration. Only the instructor can save to session.'
          ),
        ]);
      } else {
        setOutput((prev) => [
          ...prev,
          createOutputLine('info', 'Code saved locally'),
        ]);
      }
    } catch {
      setOutput((prev) => [
        ...prev,
        createOutputLine('error', 'Failed to save code'),
      ]);
    } finally {
      setIsSaving(false);
    }
  }, [getCurrentCode, language, sessionId, updateSession, isSaving, isInstructor]);

  const handleFormat = useCallback(async () => {
    if (!editorRef.current) return;

    try {
      setOutput((prev) => [
        ...prev,
        createOutputLine('info', 'Formatting code...'),
      ]);

      const code = getCurrentCode();
      const formattedCode = await codeExecutionService.formatCode(
        code,
        language
      );

      if (isCollaborative) {
        // In collaborative mode, set content through CRDT
        collaboration.setContent(formattedCode);
      } else {
        setLocalCode(formattedCode);
        editorRef.current.setValue(formattedCode);
      }

      setOutput((prev) => [
        ...prev,
        createOutputLine('info', 'Code formatted successfully'),
      ]);
    } catch {
      setOutput((prev) => [
        ...prev,
        createOutputLine('error', 'Failed to format code'),
      ]);
    }
  }, [getCurrentCode, language, isCollaborative, collaboration]);

  const handleClearOutput = useCallback(() => {
    setOutput([]);
  }, []);

  const handleEditorMount = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor) => {
      editorRef.current = editor;

      // Bind editor to CRDT document for collaborative editing
      if (isCollaborative) {
        collaboration.bindEditor(editor);
      }

      // Add keyboard shortcuts
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        () => {
          handleRun();
        }
      );

      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        () => {
          handleSave();
        }
      );

      editor.addCommand(
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
        () => {
          handleFormat();
        }
      );
    },
    [handleRun, handleSave, handleFormat, isCollaborative, collaboration]
  );

  const canChangeLanguage =
    !readOnly && (!sessionId || user?.role === 'INSTRUCTOR');
  const showRunButton = !readOnly;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar */}
      {showToolbar && (
        <EditorToolbar
          language={language}
          onLanguageChange={handleLanguageChange}
          onRun={handleRun}
          onSave={handleSave}
          onFormat={handleFormat}
          isRunning={isRunning}
          isSaving={isSaving}
          canChangeLanguage={canChangeLanguage}
          showRunButton={showRunButton}
        />
      )}

      {/* Collaboration Status Bar */}
      {isCollaborative && (
        <div className="border-b border-border bg-muted/30 px-4 py-2">
          <ConnectionStatus
            status={collaboration.connectionStatus}
            connectedUsers={collaboration.connectedUsers}
            isSynced={collaboration.isSynced}
          />
        </div>
      )}

      {/* Main content area */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Code Editor */}
        <div className="min-h-0 flex-1">
          <MonacoEditor
            value={localCode}
            onChange={handleCodeChange}
            language={language}
            readOnly={readOnly}
            height="100%"
            onMount={handleEditorMount}
            collaborative={isCollaborative}
          />
        </div>

        {/* Output Panel */}
        <div className="w-full border-t border-border lg:w-96 lg:border-l lg:border-t-0">
          <OutputPanel
            output={output}
            isRunning={isRunning}
            onClear={handleClearOutput}
            height="100%"
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between border-t border-border bg-muted px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center space-x-4">
          <span>Language: {language}</span>
          <span>
            Lines: {getCurrentCode().split('\n').length}
          </span>
          <span>Characters: {getCurrentCode().length}</span>
        </div>
        <div className="flex items-center space-x-4">
          {isCollaborative && (
            <span className="flex items-center gap-1">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  collaboration.connectionStatus === 'connected'
                    ? 'bg-green-500'
                    : collaboration.connectionStatus === 'connecting'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
              />
              {collaboration.connectionStatus === 'connected'
                ? 'Live'
                : collaboration.connectionStatus === 'connecting'
                  ? 'Connecting...'
                  : 'Offline'}
            </span>
          )}
          {sessionId && (
            <span>Session: {sessionId.slice(0, 8)}...</span>
          )}
          {user && (
            <span>
              {user.name} ({user.role.toLowerCase()})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default CodingInterface;
