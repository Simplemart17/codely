'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
  height?: string | number;
}

export function OutputPanel({
  output,
  isRunning = false,
  onClear,
  height = '200px',
}: OutputPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new output is added
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const getLineStyle = (type: OutputLine['type']) => {
    switch (type) {
      case 'stdout':
        return 'text-foreground';
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

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center">
            <span className="mr-2">📟</span>
            Output
            {isRunning && (
              <div className="ml-2 flex items-center">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                <span className="ml-1 text-xs text-primary">Running...</span>
              </div>
            )}
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 h-6 w-6"
            >
              {isExpanded ? '🔽' : '🔼'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClear}
              className="p-1 h-6 w-6"
              disabled={output.length === 0}
            >
              🗑️
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="flex-1 p-0">
          <div
            ref={outputRef}
            className="h-full overflow-y-auto bg-card border border-border font-mono text-sm"
            style={{ height }}
          >
            {output.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <div className="text-2xl mb-2">📟</div>
                  <p>No output yet</p>
                  <p className="text-xs mt-1">Run your code to see output here</p>
                </div>
              </div>
            ) : (
              <div className="p-3 space-y-1">
                {output.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-start space-x-2 hover:bg-muted/50 px-2 py-1 rounded"
                  >
                    <span className="text-xs text-muted-foreground mt-0.5 min-w-[60px]">
                      {formatTimestamp(line.timestamp)}
                    </span>
                    <span className={`flex-1 whitespace-pre-wrap ${getLineStyle(line.type)}`}>
                      {getLinePrefix(line.type)}{line.content}
                    </span>
                  </div>
                ))}
                
                {isRunning && (
                  <div className="flex items-center space-x-2 px-2 py-1">
                    <span className="text-xs text-muted-foreground min-w-[60px]">
                      {formatTimestamp(new Date())}
                    </span>
                    <span className="text-primary flex items-center">
                      <div className="animate-pulse mr-2">⚡</div>
                      Executing...
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}

      {/* Output Statistics */}
      {output.length > 0 && (
        <div className="px-3 py-2 bg-muted border-t border-border text-xs text-muted-foreground flex justify-between">
          <span>
            {output.length} line{output.length !== 1 ? 's' : ''}
          </span>
          <span>
            {output.filter(line => line.type === 'error' || line.type === 'stderr').length} error{output.filter(line => line.type === 'error' || line.type === 'stderr').length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </Card>
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
