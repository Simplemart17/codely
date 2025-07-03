'use client';

import React, { Suspense, lazy, memo, useMemo } from 'react';
import { Loader2, Users, Play } from 'lucide-react';
import { usePerformanceMonitor } from '@/lib/performance';

// Lazy load heavy components
const LazyMonacoEditor = lazy(() => 
  import('../editor/lazy-monaco-editor').then(module => ({ 
    default: module.LazyMonacoEditor 
  }))
);

const SessionAnalytics = lazy(() => 
  import('./session-analytics').then(module => ({ 
    default: module.SessionAnalytics 
  }))
);

const SessionRecording = lazy(() => 
  import('./session-recording').then(module => ({ 
    default: module.SessionRecording 
  }))
);

interface OptimizedSessionPageProps {
  sessionId: string;
  isInstructor?: boolean;
  initialData?: {
    title: string;
    description: string;
    language: 'JAVASCRIPT' | 'PYTHON' | 'CSHARP';
    code: string;
    participants: Array<{
      id: string;
      name: string;
      role: string;
      isActive: boolean;
    }>;
    status: 'ACTIVE' | 'ENDED';
  };
}

// Memoized components for better performance
const SessionHeader = memo(({ title, description, status }: {
  title: string;
  description: string;
  status: string;
}) => (
  <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {title}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {description}
        </p>
      </div>
      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
        status === 'ACTIVE' 
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      }`}>
        {status}
      </div>
    </div>
  </div>
));

SessionHeader.displayName = 'SessionHeader';

const ParticipantsList = memo(({ participants }: {
  participants: Array<{
    id: string;
    name: string;
    role: string;
    isActive: boolean;
  }>;
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <div className="flex items-center space-x-2 mb-3">
      <Users className="h-5 w-5 text-gray-500" />
      <h3 className="font-medium text-gray-900 dark:text-white">
        Participants ({participants.length})
      </h3>
    </div>
    <div className="space-y-2">
      {participants.map((participant) => (
        <div key={participant.id} className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              participant.isActive ? 'bg-green-500' : 'bg-gray-400'
            }`} />
            <span className="text-sm text-gray-900 dark:text-white">
              {participant.name}
            </span>
          </div>
          <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            {participant.role}
          </span>
        </div>
      ))}
    </div>
  </div>
));

ParticipantsList.displayName = 'ParticipantsList';

const CodeExecutionPanel = memo(({ 
  onExecute, 
  isExecuting, 
  output, 
  error, 
  executionTime 
}: {
  onExecute: () => void;
  isExecuting: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <h3 className="font-medium text-gray-900 dark:text-white">Output</h3>
      <button
        onClick={onExecute}
        disabled={isExecuting}
        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isExecuting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Running...</span>
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            <span>Run Code</span>
          </>
        )}
      </button>
    </div>
    <div className="p-4">
      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
          <div className="text-red-800 dark:text-red-200 font-mono text-sm">
            {error}
          </div>
        </div>
      ) : output ? (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-3">
          <pre className="text-gray-900 dark:text-white font-mono text-sm whitespace-pre-wrap">
            {output}
          </pre>
        </div>
      ) : (
        <div className="text-gray-500 dark:text-gray-400 text-sm">
          No output yet. Run your code to see results.
        </div>
      )}
      {executionTime && (
        <div className="mt-2 text-xs text-gray-500">
          Execution time: {executionTime}ms
        </div>
      )}
    </div>
  </div>
));

CodeExecutionPanel.displayName = 'CodeExecutionPanel';

// Loading skeleton for the session page
const SessionPageSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-6"></div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
        <div className="space-y-4">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    </div>
  </div>
);

export const OptimizedSessionPage: React.FC<OptimizedSessionPageProps> = ({
  sessionId,
  isInstructor = false,
  initialData,
}) => {
  const { measureEditorLoadTime, measureCodeExecutionTime } = usePerformanceMonitor();
  
  // State management with useMemo for expensive computations
  const [code, setCode] = React.useState(initialData?.code || '');
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [output, setOutput] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const [executionTime, setExecutionTime] = React.useState<number>();
  const [showAnalytics, setShowAnalytics] = React.useState(false);
  const [showRecording, setShowRecording] = React.useState(false);

  // Memoized participants list to prevent unnecessary re-renders
  const participantsList = useMemo(() => 
    initialData?.participants || [], 
    [initialData?.participants]
  );

  // Optimized code execution handler
  const handleCodeExecution = React.useCallback(async () => {
    if (isExecuting) return;
    
    setIsExecuting(true);
    setError(undefined);
    setOutput(undefined);
    
    const startTime = performance.now();
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const execTime = measureCodeExecutionTime(startTime);
      setExecutionTime(execTime);
      setOutput('Hello World\n42');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  }, [isExecuting, measureCodeExecutionTime]);

  // Optimized editor mount handler
  const handleEditorMount = React.useCallback((editor: unknown) => {
    const startTime = performance.now();

    // Configure editor with type assertion
    const monacoEditor = editor as { updateOptions: (options: Record<string, unknown>) => void };
    monacoEditor.updateOptions({
      fontSize: 14,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
    });

    measureEditorLoadTime(startTime);
  }, [measureEditorLoadTime]);

  // Show loading skeleton if no initial data
  if (!initialData) {
    return <SessionPageSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SessionHeader 
        title={initialData.title}
        description={initialData.description}
        status={initialData.status}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main editor area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {initialData.language}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Analytics
                </button>
                <button
                  onClick={() => setShowRecording(!showRecording)}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Recording
                </button>
              </div>
            </div>
            
            <Suspense fallback={
              <div className="h-96 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            }>
              <LazyMonacoEditor
                value={code}
                language={initialData.language}
                onChange={setCode}
                onMount={handleEditorMount}
                height="400px"
              />
            </Suspense>
          </div>
          
          <CodeExecutionPanel
            onExecute={handleCodeExecution}
            isExecuting={isExecuting}
            output={output}
            error={error}
            executionTime={executionTime}
          />
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          <ParticipantsList participants={participantsList} />
          
          {/* Lazy loaded components */}
          {showAnalytics && (
            <Suspense fallback={
              <div className="h-32 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg border">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            }>
              <SessionAnalytics sessionId={sessionId} />
            </Suspense>
          )}
          
          {showRecording && (
            <Suspense fallback={
              <div className="h-32 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg border">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            }>
              <SessionRecording sessionId={sessionId} isInstructor={isInstructor} />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
};

export default OptimizedSessionPage;
