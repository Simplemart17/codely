'use client';

import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load Monaco Editor to reduce initial bundle size
const MonacoEditor = lazy(() => 
  import('./monaco-editor').then(module => ({ default: module.MonacoEditor }))
);

interface LazyMonacoEditorProps {
  value: string;
  language: 'JAVASCRIPT' | 'PYTHON' | 'CSHARP';
  onChange: (value: string) => void;
  readOnly?: boolean;
  height?: string;
  theme?: 'light' | 'dark';
  onMount?: (editor: any, monaco: any) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  loading?: boolean;
  error?: string | null;
}

// Loading component for Monaco Editor
const MonacoEditorSkeleton = () => (
  <div className="flex items-center justify-center h-96 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
    <div className="flex flex-col items-center space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Loading code editor...
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-500">
        This may take a moment on first load
      </div>
    </div>
  </div>
);

// Error boundary for Monaco Editor
class MonacoEditorErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Monaco Editor Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex items-center justify-center h-96 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="text-center space-y-2">
              <div className="text-red-600 dark:text-red-400 font-medium">
                Failed to load code editor
              </div>
              <div className="text-sm text-red-500 dark:text-red-500">
                {this.state.error?.message || 'Unknown error occurred'}
              </div>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export const LazyMonacoEditor: React.FC<LazyMonacoEditorProps> = (props) => {
  return (
    <MonacoEditorErrorBoundary>
      <Suspense fallback={<MonacoEditorSkeleton />}>
        <MonacoEditor {...props} />
      </Suspense>
    </MonacoEditorErrorBoundary>
  );
};

// Preload Monaco Editor for better UX
export const preloadMonacoEditor = () => {
  if (typeof window !== 'undefined') {
    import('./monaco-editor').catch(error => {
      console.warn('Failed to preload Monaco Editor:', error);
    });
  }
};

// Hook to preload Monaco Editor on user interaction
export const usePreloadMonacoEditor = () => {
  React.useEffect(() => {
    const handleUserInteraction = () => {
      preloadMonacoEditor();
      // Remove listeners after first interaction
      window.removeEventListener('mousedown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };

    // Preload on first user interaction
    window.addEventListener('mousedown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });

    return () => {
      window.removeEventListener('mousedown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);
};

export default LazyMonacoEditor;
