'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { webSocketService } from '@/lib/services/websocket-service';
import type { CodeChangeEvent, LanguageChangeEvent } from '@/lib/services/websocket-service';

// Extend Window interface for auto-save timeout
declare global {
  interface Window {
    autoSaveTimeout?: NodeJS.Timeout;
  }
}
import * as monaco from 'monaco-editor';
import { MonacoEditor } from './monaco-editor';
import { EditorToolbar } from './editor-toolbar';
import { OutputPanel, createOutputLine } from './output-panel';
import { UserPresence } from './user-presence';
import { codeExecutionService } from '@/lib/code-execution';
import { useSessionStore } from '@/stores/session-store';
import { useUserStore } from '@/stores/user-store';
import type { Language } from '@/types';

interface CodingInterfaceProps {
  sessionId?: string;
  initialCode?: string;
  initialLanguage?: Language;
  readOnly?: boolean;
  showToolbar?: boolean;
  onCodeChange?: (code: string) => void;
  onLanguageChange?: (language: Language) => void;
}

export function CodingInterface({
  sessionId,
  initialCode = '',
  initialLanguage = 'JAVASCRIPT',
  readOnly = false,
  showToolbar = true,
  onCodeChange,
  onLanguageChange,
}: CodingInterfaceProps) {
  const { user } = useUserStore();
  const { updateSession } = useSessionStore();
  
  const [code, setCode] = useState(initialCode);
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [output, setOutput] = useState<Array<{ id: string; type: 'stdout' | 'stderr' | 'info' | 'error'; content: string; timestamp: Date }>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReceivingUpdate, setIsReceivingUpdate] = useState(false);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleCodeChange = useCallback((newCode: string) => {
    // Prevent infinite loops when receiving updates from WebSocket
    if (isReceivingUpdate) {
      return;
    }

    setCode(newCode);
    onCodeChange?.(newCode);

    // Send real-time update via WebSocket
    if (sessionId && user) {
      webSocketService.sendCodeChange(newCode, language);
    }

    // Auto-save code changes to session (debounced)
    if (sessionId) {
      // Clear previous timeout
      if (window.autoSaveTimeout) {
        clearTimeout(window.autoSaveTimeout);
      }

      // Set new timeout for auto-save (1 second delay)
      window.autoSaveTimeout = setTimeout(() => {
        updateSession(sessionId, {
          code: newCode,
          updatedAt: new Date(),
        }).catch(error => {
          console.error('Failed to auto-save code:', error);
        });
      }, 1000);
    }
  }, [onCodeChange, sessionId, updateSession, isReceivingUpdate, language, user]);

  const handleLanguageChange = useCallback((newLanguage: Language) => {
    setLanguage(newLanguage);
    onLanguageChange?.(newLanguage);

    // Send real-time language update via WebSocket
    if (sessionId && user) {
      webSocketService.sendLanguageChange(newLanguage);
    }

    // Update session with new language if sessionId is provided
    if (sessionId) {
      updateSession(sessionId, {
        language: newLanguage,
        updatedAt: new Date(),
      }).catch(error => {
        console.error('Failed to update session language:', error);
      });
    }
  }, [onLanguageChange, sessionId, updateSession, user]);

  const handleRun = useCallback(async () => {
    if (isRunning || !code.trim()) return;

    setIsRunning(true);
    setOutput(prev => [
      ...prev,
      createOutputLine('info', `Running ${language.toLowerCase()} code...`),
    ]);

    try {
      const result = await codeExecutionService.executeCode(code, language);
      
      if (result.success) {
        setOutput(prev => [
          ...prev,
          createOutputLine('stdout', result.output),
          createOutputLine('info', `Execution completed in ${result.executionTime}ms`),
        ]);
      } else {
        setOutput(prev => [
          ...prev,
          createOutputLine('error', result.error || 'Execution failed'),
        ]);
      }
    } catch {
      setOutput(prev => [
        ...prev,
        createOutputLine('error', 'Unknown error'),
      ]);
    } finally {
      setIsRunning(false);
    }
  }, [code, language, isRunning]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    setOutput(prev => [
      ...prev,
      createOutputLine('info', 'Saving code...'),
    ]);

    try {
      // Save to session if sessionId is provided
      if (sessionId) {
        await updateSession(sessionId, { 
          code,
          language,
          updatedAt: new Date(),
        });
      }

      setOutput(prev => [
        ...prev,
        createOutputLine('info', 'Code saved successfully'),
      ]);
    } catch {
      setOutput(prev => [
        ...prev,
        createOutputLine('error', 'Failed to save code'),
      ]);
    } finally {
      setIsSaving(false);
    }
  }, [code, language, sessionId, updateSession, isSaving]);

  // WebSocket connection and event handling
  useEffect(() => {
    if (!sessionId || !user) return;

    // Connect to WebSocket and join session
    webSocketService.connect();
    webSocketService.joinSession(sessionId, user.id);

    // Handle incoming code changes
    const handleIncomingCodeChange = (event: CodeChangeEvent) => {
      if (event.userId !== user.id) {
        setIsReceivingUpdate(true);
        setCode(event.code);
        setTimeout(() => setIsReceivingUpdate(false), 100);
      }
    };

    // Handle incoming language changes
    const handleIncomingLanguageChange = (event: LanguageChangeEvent) => {
      if (event.userId !== user.id) {
        setLanguage(event.language);
      }
    };

    // Set up event listeners
    webSocketService.onCodeChange(handleIncomingCodeChange);
    webSocketService.onLanguageChange(handleIncomingLanguageChange);

    // Cleanup on unmount
    return () => {
      webSocketService.offCodeChange(handleIncomingCodeChange);
      webSocketService.offLanguageChange(handleIncomingLanguageChange);
      webSocketService.leaveSession();
    };
  }, [sessionId, user]);

  const handleFormat = useCallback(async () => {
    if (!editorRef.current) return;

    try {
      setOutput(prev => [
        ...prev,
        createOutputLine('info', 'Formatting code...'),
      ]);

      const formattedCode = await codeExecutionService.formatCode(code, language);
      setCode(formattedCode);
      editorRef.current.setValue(formattedCode);

      setOutput(prev => [
        ...prev,
        createOutputLine('info', 'Code formatted successfully'),
      ]);
    } catch {
      setOutput(prev => [
        ...prev,
        createOutputLine('error', 'Failed to format code'),
      ]);
    }
  }, [code, language]);

  const handleClearOutput = useCallback(() => {
    setOutput([]);
  }, []);

  const handleEditorMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRun();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });

    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      handleFormat();
    });
  }, [handleRun, handleSave, handleFormat]);

  const canChangeLanguage = !readOnly && (!sessionId || user?.role === 'INSTRUCTOR');
  const showRunButton = !readOnly;

  return (
    <div className="h-full flex flex-col bg-white">
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

      {/* User Presence Indicator */}
      {sessionId && (
        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <UserPresence sessionId={sessionId} />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Code Editor */}
        <div className="flex-1 min-h-0">
          <MonacoEditor
            value={code}
            onChange={handleCodeChange}
            language={language}
            readOnly={readOnly}
            height="100%"
            onMount={handleEditorMount}
          />
        </div>

        {/* Output Panel */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-300">
          <OutputPanel
            output={output}
            isRunning={isRunning}
            onClear={handleClearOutput}
            height="100%"
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-gray-100 border-t border-gray-300 px-4 py-2 text-xs text-gray-600 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <span>Language: {language}</span>
          <span>Lines: {code.split('\n').length}</span>
          <span>Characters: {code.length}</span>
        </div>
        <div className="flex items-center space-x-4">
          {sessionId && (
            <span>Session: {sessionId.slice(0, 8)}...</span>
          )}
          {user && (
            <span>{user.name} ({user.role.toLowerCase()})</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default CodingInterface;
