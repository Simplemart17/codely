'use client';

import { useEffect, useRef } from 'react';
import {
  Terminal,
  Trash2,
  PanelRight,
  PanelBottom,
  Loader2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEditorLayoutStore } from '@/stores/editor-layout-store';

interface OutputLine {
  id: string;
  type: 'stdout' | 'stderr' | 'info' | 'error';
  content: string;
  timestamp: Date;
}

interface OutputPanelProps {
  output: OutputLine[];
  isRunning?: boolean;
  onClear: () => void;
}

export function OutputPanel({
  output,
  isRunning = false,
  onClear,
}: OutputPanelProps) {
  const outputRef = useRef<HTMLDivElement>(null);
  const { consolePosition, setConsolePosition } = useEditorLayoutStore();

  // Auto-scroll to bottom when new output is added
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const getLineStyle = (type: OutputLine['type']) => {
    switch (type) {
      case 'stderr':
        return 'text-destructive';
      case 'error':
        return 'text-destructive font-medium';
      case 'info':
        return 'text-primary';
      default:
        return 'text-foreground';
    }
  };

  const getLinePrefix = (type: OutputLine['type']) => {
    switch (type) {
      case 'stderr':
        return '❌ ';
      case 'error':
        return '🚨 ';
      case 'info':
        return 'ℹ️ ';
      default:
        return '';
    }
  };

  const formatTimestamp = (timestamp: Date) =>
    timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });

  const errorCount = output.filter(
    (line) => line.type === 'error' || line.type === 'stderr'
  ).length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <Terminal className="size-4 shrink-0 text-primary" />
          <span className="truncate">Output</span>
          {isRunning && (
            <span className="flex items-center gap-1 text-xs font-normal text-primary">
              <Loader2 className="size-3 animate-spin" />
              Running…
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Dock position toggle */}
          <div className="mr-1 flex items-center rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setConsolePosition('right')}
              aria-pressed={consolePosition === 'right'}
              title="Dock console to the right"
              className={cn(
                'flex size-6 items-center justify-center rounded-sm transition-colors',
                consolePosition === 'right'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <PanelRight className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setConsolePosition('bottom')}
              aria-pressed={consolePosition === 'bottom'}
              title="Dock console to the bottom"
              className={cn(
                'flex size-6 items-center justify-center rounded-sm transition-colors',
                consolePosition === 'bottom'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <PanelBottom className="size-3.5" />
            </button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            disabled={output.length === 0}
            className="size-7 p-0 text-muted-foreground hover:text-foreground"
            title="Clear output"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div
        ref={outputRef}
        className="min-h-0 flex-1 overflow-y-auto font-mono text-sm"
      >
        {output.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Terminal className="mx-auto mb-2 size-7 opacity-50" />
              <p>No output yet</p>
              <p className="mt-1 text-xs">Run your code to see output here</p>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5 p-3">
            {output.map((line) => (
              <div
                key={line.id}
                className="flex items-start gap-2 rounded px-2 py-1 hover:bg-muted/50"
              >
                <span className="mt-0.5 min-w-15 text-xs text-muted-foreground">
                  {formatTimestamp(line.timestamp)}
                </span>
                <span
                  className={cn(
                    'flex-1 whitespace-pre-wrap wrap-break-word',
                    getLineStyle(line.type)
                  )}
                >
                  {getLinePrefix(line.type)}
                  {line.content}
                </span>
              </div>
            ))}

            {isRunning && (
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="min-w-15 text-xs text-muted-foreground">
                  {formatTimestamp(new Date())}
                </span>
                <span className="flex items-center gap-2 text-primary">
                  <Zap className="size-3.5 animate-pulse" />
                  Executing…
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer stats */}
      {output.length > 0 && (
        <div className="flex justify-between border-t border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            {output.length} line{output.length !== 1 ? 's' : ''}
          </span>
          <span>
            {errorCount} error{errorCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

// Helper function to create output lines
export const createOutputLine = (
  type: OutputLine['type'],
  content: string
): OutputLine => ({
  id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type,
  content,
  timestamp: new Date(),
});

export default OutputPanel;
