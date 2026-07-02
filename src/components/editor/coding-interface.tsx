'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { editor as MonacoEditorType } from 'monaco-editor';
import { MonacoEditor } from './monaco-editor';
import { EditorToolbar } from './editor-toolbar';
import { OutputPanel, createOutputLine } from './output-panel';
import { ConnectionStatus } from './connection-status';
import { InstructorNotesPanel } from './instructor-notes-panel';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { codeExecutionService } from '@/lib/code-execution';
import type { OutputStream } from '@/lib/code-execution';
import { createClient } from '@/lib/supabase/client';
import { useSessionStore } from '@/stores/session-store';
import { useUserStore } from '@/stores/user-store';
import { useEditorLayoutStore } from '@/stores/editor-layout-store';
import { useCollaboration } from '@/hooks/use-collaboration';
import { useRemoteCursors } from '@/hooks/use-remote-cursors';
import { RealtimeService } from '@/lib/services/realtime-service';
import type {
  LanguageChangeEvent,
  SessionStatusChangeEvent,
  ExecutionOutputEvent,
} from '@/lib/services/realtime-service';
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
  onSessionEnded?: () => void;
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
  onSessionEnded,
}: CodingInterfaceProps) {
  const { user } = useUserStore();
  const { updateSession } = useSessionStore();
  const { consolePosition } = useEditorLayoutStore();

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
  const [showNotes, setShowNotes] = useState(false);

  const editorRef = useRef<MonacoEditorType.IStandaloneCodeEditor | null>(null);
  const realtimeServiceRef = useRef<RealtimeService | null>(null);
  // Deferred-teardown bookkeeping so a StrictMode remount reuses the live
  // realtime channel instead of churning it (see the realtime effect below).
  const realtimeTeardownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeKeyRef = useRef<string | null>(null);
  // Single-flight guard read synchronously, so the Ctrl+Enter command (which
  // captures `handleRun` once at editor mount and would otherwise see a stale
  // `isRunning`) can't launch overlapping runs.
  const isRunningRef = useRef(false);

  // Stable refs for callbacks to avoid tearing down effects on every render
  const onSessionEndedRef = useRef(onSessionEnded);
  onSessionEndedRef.current = onSessionEnded;

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

  // Inject dynamic CSS for remote cursor labels and colors
  useRemoteCursors(collaboration.getDocument, isCollaborative);

  // Non-collaborative code state (used when no session)
  const [localCode, setLocalCode] = useState(initialCode);

  // --- Supabase Realtime for language sync (not code — CRDT handles code) ---
  // Only re-run when session or user identity changes — NOT on every user
  // object reference change or callback change.
  const userId = user?.id;
  const userName = user?.name;
  useEffect(() => {
    if (!sessionId || !userId || !userName) return;

    const desiredKey = `${sessionId}|${userId}|${userName}`;

    // Cancel a teardown scheduled by a just-fired cleanup. React StrictMode
    // remounts effects in dev (mount → unmount → mount), and the browser
    // Supabase client is a SINGLETON with one socket. Creating a second channel
    // for the same `session:<id>` topic makes the two race their join/leave on
    // that socket — the first channel's leave lands after the second joins and
    // closes it, leaving the live channel CLOSED. That silently dropped all
    // broadcast delivery (execution output, language sync) after the first
    // event. Reusing the existing channel across the remount avoids the churn.
    if (realtimeTeardownRef.current) {
      clearTimeout(realtimeTeardownRef.current);
      realtimeTeardownRef.current = null;
    }

    // Identity genuinely changed (not a StrictMode echo) — drop the old channel.
    if (realtimeServiceRef.current && realtimeKeyRef.current !== desiredKey) {
      realtimeServiceRef.current.leaveSession();
      realtimeServiceRef.current.cleanup();
      realtimeServiceRef.current = null;
    }

    if (!realtimeServiceRef.current) {
      realtimeKeyRef.current = desiredKey;
      const realtimeService = new RealtimeService();
      realtimeServiceRef.current = realtimeService;

      // Apply language changes from every other connection. Supabase broadcast
      // is `self: false`, so we never receive our own change here; filtering by
      // userId would only drop changes from another connection on the same
      // account (e.g. two tabs). setLanguage doesn't re-broadcast, so there's no
      // loop.
      const handleIncomingLanguageChange = (event: LanguageChangeEvent) => {
        setLanguage(event.language as Language);
      };

      const handleSessionStatusChange = (event: SessionStatusChangeEvent) => {
        if (event.status === 'ENDED') {
          onSessionEndedRef.current?.();
        }
      };

      // Render runs triggered by other participants. The clicker executes the
      // code; everyone else just shows the broadcast result.
      const handleIncomingExecution = (event: ExecutionOutputEvent) => {
        setOutput((prev) => {
          const next = [
            ...prev,
            createOutputLine(
              'info',
              `▶ ${event.userName} ran ${event.language.toLowerCase()} code`
            ),
            ...event.streams.map((s) => createOutputLine(s.type, s.content)),
          ];
          if (event.error) {
            next.push(createOutputLine('error', event.error));
          }
          return next;
        });
      };

      realtimeService.onLanguageChange(handleIncomingLanguageChange);
      realtimeService.onSessionStatusChange(handleSessionStatusChange);
      realtimeService.onExecutionOutput(handleIncomingExecution);
      realtimeService.joinSession(sessionId, userId, userName);
    }

    return () => {
      // Defer teardown one tick: a synchronous StrictMode remount cancels it
      // above (reusing the channel); a real unmount lets it run.
      realtimeTeardownRef.current = setTimeout(() => {
        realtimeTeardownRef.current = null;
        realtimeKeyRef.current = null;
        const svc = realtimeServiceRef.current;
        realtimeServiceRef.current = null;
        svc?.leaveSession();
        svc?.cleanup();
      }, 0);
    };
  }, [sessionId, userId, userName]);

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
          const supabase = createClient();
          supabase
            .from('sessions')
            .update({ code: newCode })
            .eq('id', sessionId)
            .then(({ error }) => {
              if (error) console.error('Failed to auto-save code:', error);
            });
        }, 1000);
      }
    },
    [onCodeChange, sessionId, isInstructor]
  );

  // Auto-save collaborative content periodically (instructor only).
  // Uses a direct Supabase update to avoid updating the store (which would
  // trigger re-renders and previously caused reconnection loops).
  const getCollabContent = collaboration.getContent;
  useEffect(() => {
    if (!isCollaborative || !sessionId || !isInstructor) return;

    const supabase = createClient();
    const autoSaveInterval = setInterval(() => {
      const content = getCollabContent();
      if (content) {
        supabase
          .from('sessions')
          .update({ code: content })
          .eq('id', sessionId)
          .then(({ error }) => {
            if (error) {
              console.error('Failed to auto-save collaborative code:', error);
            }
          });
      }
    }, 5000); // Save every 5 seconds

    return () => clearInterval(autoSaveInterval);
  }, [isCollaborative, sessionId, getCollabContent, isInstructor]);

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
    if (isRunningRef.current || !code.trim()) return;

    isRunningRef.current = true;
    setIsRunning(true);
    setOutput((prev) => [
      ...prev,
      createOutputLine('info', `Running ${language.toLowerCase()} code...`),
    ]);

    try {
      const result = await codeExecutionService.executeCode(code, language);

      // Validation errors (empty/unsupported) carry no streams — fall back to
      // the single `output` blob, treated as stdout.
      const streams: OutputStream[] =
        result.streams ??
        (result.output ? [{ type: 'stdout', content: result.output }] : []);
      const outputLines = streams.map((s) =>
        createOutputLine(s.type, s.content)
      );

      // Always render captured output — including on failure, where partial
      // stdout before an error is common and must not be dropped.
      if (result.success) {
        setOutput((prev) => [
          ...prev,
          ...outputLines,
          createOutputLine(
            'info',
            `Execution completed in ${result.executionTime}ms`
          ),
        ]);
      } else {
        setOutput((prev) => [
          ...prev,
          ...outputLines,
          createOutputLine('error', result.error || 'Execution failed'),
        ]);
      }

      // Share the run with other participants so they see the same output.
      realtimeServiceRef.current?.sendExecutionOutput({
        language,
        success: result.success,
        streams,
        error: result.error,
      });
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
      isRunningRef.current = false;
      setIsRunning(false);
    }
  }, [getCurrentCode, language]);

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
    async (editor: MonacoEditorType.IStandaloneCodeEditor) => {
      editorRef.current = editor;

      // Bind editor to CRDT document for collaborative editing
      if (isCollaborative) {
        collaboration.bindEditor(editor);
      }

      // Dynamically import monaco for key constants (avoid SSR crash)
      const monaco = await import('monaco-editor');

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
        monaco.KeyMod.Shift |
          monaco.KeyMod.Alt |
          monaco.KeyCode.KeyF,
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
          showNotesToggle={isInstructor}
          notesShown={showNotes}
          onToggleNotes={() => setShowNotes((v) => !v)}
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

      {/* Main content area. Outer horizontal split: the editor+console
          workspace on the left, and an optional docked Instructor Notes column
          on the right that SHARES horizontal space (shrinks the workspace)
          rather than overlaying it — so the instructor can keep coding while
          notes are open. */}
      <div className="min-h-0 flex-1">
        <ResizablePanelGroup direction="horizontal">
          {/* Workspace: editor + resizable, repositionable output console.
              The console docks right (horizontal split) or bottom (vertical
              split) based on the persisted `consolePosition`. Direction is
              toggled live (no remount) so the Monaco/CRDT instance is never
              torn down. */}
          <ResizablePanel
            id="workspace"
            order={1}
            minSize={30}
            className="min-h-0"
          >
            <div className="h-full p-2">
              <ResizablePanelGroup
                direction={
                  consolePosition === 'bottom' ? 'vertical' : 'horizontal'
                }
                autoSaveId="codely-editor-console"
              >
                {/* Code Editor */}
                <ResizablePanel
                  id="editor"
                  order={1}
                  defaultSize={62}
                  minSize={25}
                  className="min-h-0"
                >
                  <MonacoEditor
                    value={localCode}
                    onChange={handleCodeChange}
                    language={language}
                    readOnly={readOnly}
                    height="100%"
                    onMount={handleEditorMount}
                    collaborative={isCollaborative}
                  />
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Output Console — always docked (never collapses to 0) so its
                    header controls, including the dock-position toggle, stay
                    reachable. */}
                <ResizablePanel
                  id="console"
                  order={2}
                  defaultSize={38}
                  minSize={15}
                  className="min-h-0 overflow-hidden rounded-lg border border-border"
                >
                  <OutputPanel
                    output={output}
                    isRunning={isRunning}
                    onClear={handleClearOutput}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>

          {/* Instructor Notes — instructor-only, private (never broadcast).
              A docked, resizable side column, not an overlay. */}
          {sessionId && isInstructor && showNotes && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel
                id="notes"
                order={2}
                defaultSize={28}
                minSize={18}
                maxSize={45}
                className="min-h-0"
              >
                <div className="h-full py-2 pr-2">
                  <InstructorNotesPanel
                    sessionId={sessionId}
                    language={language}
                    getCode={getCurrentCode}
                    onClose={() => setShowNotes(false)}
                  />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
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
