'use client';

import React from 'react';
import { useConnectionStatus } from '@/hooks/use-socket';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  className?: string;
  showText?: boolean;
}

export function ConnectionStatus({ className, showText = true }: ConnectionStatusProps) {
  const { isConnected, isConnecting, connectionError } = useConnectionStatus();

  const getStatusInfo = () => {
    if (isConnecting) {
      return {
        icon: Loader2,
        text: 'Connecting...',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
      };
    }

    if (connectionError) {
      return {
        icon: WifiOff,
        text: `Connection Error: ${connectionError}`,
        color: 'text-red-500',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      };
    }

    if (isConnected) {
      return {
        icon: Wifi,
        text: 'Connected',
        color: 'text-green-500',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      };
    }

    return {
      icon: WifiOff,
      text: 'Disconnected',
      color: 'text-gray-500',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
    };
  };

  const { icon: Icon, text, color, bgColor, borderColor } = getStatusInfo();

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
        bgColor,
        borderColor,
        className
      )}
    >
      <Icon 
        className={cn(
          'h-4 w-4',
          color,
          isConnecting && 'animate-spin'
        )} 
      />
      {showText && (
        <span className={cn('text-sm font-medium', color)}>
          {text}
        </span>
      )}
    </div>
  );
}

interface ConnectionIndicatorProps {
  className?: string;
}

export function ConnectionIndicator({ className }: ConnectionIndicatorProps) {
  const { isConnected, isConnecting } = useConnectionStatus();

  return (
    <div
      className={cn(
        'h-3 w-3 rounded-full transition-colors',
        isConnecting && 'bg-yellow-400 animate-pulse',
        isConnected && !isConnecting && 'bg-green-400',
        !isConnected && !isConnecting && 'bg-red-400',
        className
      )}
      title={
        isConnecting 
          ? 'Connecting...' 
          : isConnected 
            ? 'Connected' 
            : 'Disconnected'
      }
    />
  );
}
