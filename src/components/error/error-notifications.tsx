'use client';

import React, { createContext, useContext, useReducer } from 'react';
import { X, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { AppError, ErrorSeverity, ErrorAction, ErrorType } from '@/lib/error-handling';

// Notification types
export type NotificationType = 'error' | 'warning' | 'info' | 'success';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  actions?: ErrorAction[];
  error?: AppError;
}

// Notification state management
interface NotificationState {
  notifications: Notification[];
}

type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_ALL' };

const notificationReducer = (
  state: NotificationState,
  action: NotificationAction
): NotificationState => {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };
    case 'CLEAR_ALL':
      return {
        ...state,
        notifications: [],
      };
    default:
      return state;
  }
};

// Context
interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  showError: (error: AppError) => void;
  showSuccess: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Provider component
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, { notifications: [] });

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? (notification.type === 'error' ? 8000 : 5000),
    };

    dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification });

    // Auto-remove non-persistent notifications
    if (!newNotification.persistent && newNotification.duration) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
      }, newNotification.duration);
    }
  };

  const removeNotification = (id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  };

  const clearAll = () => {
    dispatch({ type: 'CLEAR_ALL' });
  };

  const showError = (error: AppError) => {
    addNotification({
      type: 'error',
      title: getErrorTitle(error),
      message: error.userMessage || error.message,
      persistent: error.severity === ErrorSeverity.CRITICAL,
      actions: getErrorActions(error),
      error,
    });
  };

  const showSuccess = (message: string, title: string = 'Success') => {
    addNotification({
      type: 'success',
      title,
      message,
    });
  };

  const showWarning = (message: string, title: string = 'Warning') => {
    addNotification({
      type: 'warning',
      title,
      message,
    });
  };

  const showInfo = (message: string, title: string = 'Information') => {
    addNotification({
      type: 'info',
      title,
      message,
    });
  };

  const value: NotificationContextType = {
    notifications: state.notifications,
    addNotification,
    removeNotification,
    clearAll,
    showError,
    showSuccess,
    showWarning,
    showInfo,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

// Helper functions
const getErrorTitle = (error: AppError): string => {
  switch (error.severity) {
    case ErrorSeverity.CRITICAL:
      return 'Critical Error';
    case ErrorSeverity.HIGH:
      return 'Error';
    case ErrorSeverity.MEDIUM:
      return 'Warning';
    case ErrorSeverity.LOW:
      return 'Notice';
    default:
      return 'Error';
  }
};

const getErrorActions = (error: AppError): ErrorAction[] => {
  const actions: ErrorAction[] = [];

  if (error.retryable) {
    actions.push({
      label: 'Retry',
      action: () => {
        // Implement retry logic based on error context
        window.location.reload();
      },
      primary: true,
    });
  }

  return actions;
};

// Individual notification component
const NotificationItem: React.FC<{
  notification: Notification;
  onRemove: (id: string) => void;
}> = ({ notification, onRemove }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'error':
        return <AlertCircle className="h-5 w-5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      case 'info':
        return <Info className="h-5 w-5" />;
      case 'success':
        return <CheckCircle className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getStyles = () => {
    switch (notification.type) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-900/20 dark:border-gray-800 dark:text-gray-200';
    }
  };

  const getIconStyles = () => {
    switch (notification.type) {
      case 'error':
        return 'text-red-500 dark:text-red-400';
      case 'warning':
        return 'text-yellow-500 dark:text-yellow-400';
      case 'info':
        return 'text-blue-500 dark:text-blue-400';
      case 'success':
        return 'text-green-500 dark:text-green-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${getStyles()}`}>
      <div className="flex items-start space-x-3">
        <div className={`flex-shrink-0 ${getIconStyles()}`}>
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium">{notification.title}</h4>
          <p className="mt-1 text-sm opacity-90">{notification.message}</p>
          
          {notification.actions && notification.actions.length > 0 && (
            <div className="mt-3 flex space-x-2">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.action}
                  className={`text-xs px-3 py-1 rounded-md transition-colors ${
                    action.primary
                      ? 'bg-current text-white opacity-90 hover:opacity-100'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <button
          onClick={() => onRemove(notification.id)}
          className="flex-shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// Notification container
const NotificationContainer: React.FC = () => {
  const context = useContext(NotificationContext);
  
  if (!context) {
    throw new Error('NotificationContainer must be used within NotificationProvider');
  }

  const { notifications, removeNotification } = context;

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={removeNotification}
        />
      ))}
    </div>
  );
};

// Hook for using notifications
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  
  return context;
};

// Hook for error notifications specifically
export const useErrorNotifications = () => {
  const { showError } = useNotifications();
  
  return {
    showError,
    showNetworkError: () => showError({
      id: 'network',
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      message: 'Network error occurred',
      userMessage: 'Please check your internet connection and try again.',
      timestamp: new Date(),
      retryable: true,
    }),
    showSessionError: () => showError({
      id: 'session',
      type: ErrorType.SESSION,
      severity: ErrorSeverity.HIGH,
      message: 'Session expired',
      userMessage: 'Your session has expired. Please log in again.',
      timestamp: new Date(),
      retryable: false,
    }),
  };
};

export default NotificationProvider;
