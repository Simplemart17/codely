'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CRDTDocument,
  createCRDTDocument,
  generateUserColor,
} from '@/lib/crdt/document';
import type { CollaborativeUser } from '@/lib/crdt/document';
import type { editor } from 'monaco-editor';

interface UseCollaborationOptions {
  sessionId: string;
  user: { id: string; name: string; avatar?: string };
  initialContent?: string;
  enabled?: boolean;
}

interface CollaborationState {
  isConnected: boolean;
  isSynced: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  connectedUsers: CollaborativeUser[];
  error: string | null;
}

interface UseCollaborationReturn extends CollaborationState {
  /** Get the underlying CRDTDocument instance (for remote cursor hooks, etc.) */
  getDocument: () => CRDTDocument | null;
  bindEditor: (editor: editor.IStandaloneCodeEditor) => void;
  disconnect: () => void;
  getContent: () => string;
  setContent: (content: string) => void;
}

const WS_URL =
  process.env.NEXT_PUBLIC_YJS_WEBSOCKET_URL || 'ws://localhost:3001';

const USER_POLL_INTERVAL = 3000;

export function useCollaboration({
  sessionId,
  user,
  initialContent,
  enabled = true,
}: UseCollaborationOptions): UseCollaborationReturn {
  const documentRef = useRef<CRDTDocument | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Store initialContent in a ref so it doesn't trigger reconnections.
  // It's only used once — when the Yjs document is first synced and empty.
  // We capture the value at mount time and never update it.
  const initialContentRef = useRef(initialContent);

  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    isSynced: false,
    connectionStatus: 'disconnected',
    connectedUsers: [],
    error: null,
  });

  // Create document and connect on mount.
  // Only re-run when session or user identity changes — NOT when content changes.
  useEffect(() => {
    if (!enabled) return;

    const collaborativeUser: CollaborativeUser = {
      id: user.id,
      name: user.name,
      color: generateUserColor(user.id),
      avatar: user.avatar,
    };

    const doc = createCRDTDocument(sessionId, collaborativeUser);
    documentRef.current = doc;

    // Listen for connection status changes
    doc.on('connectionStatus', (data: unknown) => {
      const event = data as { status: string };
      const status = event.status as
        | 'connected'
        | 'connecting'
        | 'disconnected';

      setState((prev) => ({
        ...prev,
        isConnected: status === 'connected',
        connectionStatus: status,
        error: status === 'disconnected' ? prev.error : null,
      }));
    });

    // Listen for sync events
    doc.on('sync', (data: unknown) => {
      const event = data as { isSynced: boolean };

      setState((prev) => ({
        ...prev,
        isSynced: event.isSynced,
      }));
    });

    // Listen for awareness changes
    doc.on('awarenessChange', () => {
      setState((prev) => ({
        ...prev,
        connectedUsers: doc.getConnectedUsers(),
      }));
    });

    // Listen for errors
    doc.on('error', (data: unknown) => {
      const event = data as { type: string; error: unknown };
      const message =
        event.error instanceof Error
          ? event.error.message
          : `Collaboration error: ${event.type}`;

      setState((prev) => ({
        ...prev,
        error: message,
      }));
    });

    // Connect to the WebSocket server (passes initial content for empty documents)
    doc.connect(WS_URL, initialContentRef.current);

    return () => {
      doc.destroy();
      documentRef.current = null;
      editorRef.current = null;

      setState({
        isConnected: false,
        isSynced: false,
        connectionStatus: 'disconnected',
        connectedUsers: [],
        error: null,
      });
    };
  }, [sessionId, user.id, user.name, user.avatar, enabled]);

  // Poll connected users periodically since awareness changes can be missed
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const doc = documentRef.current;
      if (doc) {
        const users = doc.getConnectedUsers();
        setState((prev) => {
          // Only update if the user list actually changed
          if (JSON.stringify(prev.connectedUsers) === JSON.stringify(users)) {
            return prev;
          }
          return { ...prev, connectedUsers: users };
        });
      }
    }, USER_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [enabled]);

  const bindEditor = useCallback(
    (monacoEditor: editor.IStandaloneCodeEditor) => {
      editorRef.current = monacoEditor;
      const doc = documentRef.current;

      if (!doc) {
        console.warn(
          'useCollaboration: Cannot bind editor — document not initialized'
        );
        return;
      }

      const status = doc.getConnectionStatus();
      if (status === 'connected') {
        doc.bindMonacoEditor(monacoEditor);
      } else {
        // Wait for connection, then bind
        const onConnected = () => {
          doc.off('connectionStatus', onStatusChange);
          doc.bindMonacoEditor(monacoEditor);
        };

        const onStatusChange = (data: unknown) => {
          const event = data as { status: string };
          if (event.status === 'connected') {
            onConnected();
          }
        };

        doc.on('connectionStatus', onStatusChange);
      }
    },
    []
  );

  const disconnect = useCallback(() => {
    const doc = documentRef.current;
    if (doc) {
      doc.disconnect();
    }
  }, []);

  const getContent = useCallback((): string => {
    const doc = documentRef.current;
    return doc ? doc.getContent() : '';
  }, []);

  const setContent = useCallback((content: string) => {
    const doc = documentRef.current;
    if (doc) {
      doc.setContent(content);
    }
  }, []);

  const getDocument = useCallback((): CRDTDocument | null => {
    return documentRef.current;
  }, []);

  return {
    ...state,
    getDocument,
    bindEditor,
    disconnect,
    getContent,
    setContent,
  };
}
