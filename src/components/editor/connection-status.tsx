'use client';

interface ConnectedUser {
  id: string;
  name: string;
  color: string;
  avatar?: string;
}

interface ConnectionStatusProps {
  status: 'connected' | 'connecting' | 'disconnected';
  connectedUsers: ConnectedUser[];
  isSynced: boolean;
}

const STATUS_CONFIG = {
  connected: {
    dotClass: 'bg-green-500',
    label: 'Connected',
  },
  connecting: {
    dotClass: 'bg-yellow-500 animate-pulse',
    label: 'Connecting...',
  },
  disconnected: {
    dotClass: 'bg-red-500',
    label: 'Disconnected',
  },
} as const;

export function ConnectionStatus({
  status,
  connectedUsers,
  isSynced,
}: ConnectionStatusProps) {
  const { dotClass, label } = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-3 text-sm">
      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
        <span className="text-muted-foreground">{label}</span>
      </div>

      {/* Sync indicator */}
      {!isSynced && status === 'connected' && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <span className="text-xs">Syncing</span>
        </div>
      )}

      {/* Connected user count */}
      {connectedUsers.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {connectedUsers.length}{' '}
            {connectedUsers.length === 1 ? 'user' : 'users'}
          </span>

          {/* User avatars */}
          <div className="flex -space-x-1.5">
            {connectedUsers.slice(0, 5).map((user) => (
              <div
                key={user.id}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-xs font-semibold text-white"
                style={{ backgroundColor: user.color }}
                title={user.name}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {connectedUsers.length > 5 && (
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold text-muted-foreground">
                +{connectedUsers.length - 5}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectionStatus;
