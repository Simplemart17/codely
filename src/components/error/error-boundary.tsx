'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
  errorBoundaryStack?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{
    error: Error;
    errorInfo: ErrorInfo;
    resetError: () => void;
  }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'critical';
}

// Error logging service
class ErrorLogger {
  static log(error: Error, errorInfo: ErrorInfo, level: string = 'component') {
    const errorId = this.generateErrorId();
    const errorData = {
      id: errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      level,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Error Boundary (${level})`);
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.error('Error ID:', errorId);
      console.groupEnd();
    }

    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      this.sendToErrorService(errorData);
    }

    return errorId;
  }

  private static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static async sendToErrorService(errorData: any) {
    try {
      // Example: Send to error tracking service
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      });
    } catch (err) {
      console.error('Failed to send error to tracking service:', err);
    }
  }
}

// Default error fallback component
const DefaultErrorFallback: React.FC<{
  error: Error;
  errorInfo: ErrorInfo;
  resetError: () => void;
  level?: string;
}> = ({ error, errorInfo, resetError, level = 'component' }) => {
  const [showDetails, setShowDetails] = React.useState(false);
  const [isReporting, setIsReporting] = React.useState(false);

  const handleReportError = async () => {
    setIsReporting(true);
    try {
      // Report error with additional context
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          userFeedback: 'User reported error',
          level,
        }),
      });
      alert('Error reported successfully. Thank you for helping us improve!');
    } catch (err) {
      alert('Failed to report error. Please try again later.');
    } finally {
      setIsReporting(false);
    }
  };

  const getErrorTitle = () => {
    switch (level) {
      case 'critical':
        return 'Critical System Error';
      case 'page':
        return 'Page Error';
      default:
        return 'Something went wrong';
    }
  };

  const getErrorDescription = () => {
    switch (level) {
      case 'critical':
        return 'A critical error has occurred that affects the entire application.';
      case 'page':
        return 'This page encountered an error and cannot be displayed.';
      default:
        return 'A component on this page encountered an error.';
    }
  };

  return (
    <div className={`flex items-center justify-center p-8 ${
      level === 'critical' ? 'min-h-screen bg-red-50 dark:bg-red-900/10' : 'min-h-64'
    }`}>
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className={`p-2 rounded-full ${
            level === 'critical' 
              ? 'bg-red-100 dark:bg-red-900/20' 
              : 'bg-yellow-100 dark:bg-yellow-900/20'
          }`}>
            <AlertTriangle className={`h-6 w-6 ${
              level === 'critical' 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-yellow-600 dark:text-yellow-400'
            }`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {getErrorTitle()}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {getErrorDescription()}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3">
            <p className="text-sm text-gray-700 dark:text-gray-300 font-mono">
              {error.message}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={resetError}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Try Again</span>
            </button>

            {level === 'page' && (
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                <Home className="h-4 w-4" />
                <span>Go Home</span>
              </button>
            )}

            <button
              onClick={handleReportError}
              disabled={isReporting}
              className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              <Bug className="h-4 w-4" />
              <span>{isReporting ? 'Reporting...' : 'Report Error'}</span>
            </button>
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            {showDetails ? 'Hide' : 'Show'} technical details
          </button>

          {showDetails && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3 text-xs">
              <div className="space-y-2">
                <div>
                  <strong>Error Stack:</strong>
                  <pre className="mt-1 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                </div>
                <div>
                  <strong>Component Stack:</strong>
                  <pre className="mt-1 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = ErrorLogger.log(error, errorInfo, this.props.level);
    
    this.setState({
      error,
      errorInfo,
      errorId,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            resetError={this.resetError}
          />
        );
      }

      // Use default fallback
      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          resetError={this.resetError}
          level={this.props.level}
        />
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

export default ErrorBoundary;
