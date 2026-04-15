'use client';
import { trpc } from '@/lib/trpc';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale/el';
import Link from 'next/link';

const TYPE_ICON: Record<string, string> = {
  DEADLINE_APPROACHING: '⏰',
  NEW_MATCHING_TENDER: '🔍',
  DOCUMENT_READY: '✅',
  TEAM_ACTIVITY: '👤',
};

export function NotificationDropdown() {
  const { data: notifications = [], refetch } = trpc.notification.list.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const { data: unreadCount = 0 } = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const markAllRead = trpc.notification.markAllRead.useMutation({ onSuccess: () => refetch() });
  const markRead = trpc.notification.markRead.useMutation({ onSuccess: () => refetch() });

  const visible = notifications.slice(0, 5);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground/70 hover:bg-foreground/[0.04] cursor-pointer h-8 w-8"
        >
          <Bell className="h-[15px] w-[15px]" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Ειδοποιήσεις</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="text-[11px] text-primary hover:underline"
            >
              Σήμανση όλων
            </button>
          )}
        </div>

        {/* Items */}
        {visible.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Δεν υπάρχουν ειδοποιήσεις
          </div>
        ) : (
          <div>
            {visible.map(n => (
              <div
                key={n.id}
                className={cn(
                  'flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-muted/50',
                  !n.readAt && 'border-l-2 border-l-primary bg-primary/[0.03]'
                )}
                onClick={() => {
                  if (!n.readAt) markRead.mutate({ id: n.id });
                }}
              >
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-base">
                  {TYPE_ICON[n.type] ?? '🔔'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs leading-snug', !n.readAt ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                    {n.title}
                  </p>
                  {n.body && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[10px] text-muted-foreground/60">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: el })}
                  </p>
                </div>
                {!n.readAt && <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-border px-4 py-2.5 text-center">
            <Link href="/notifications" className="text-[11px] text-primary hover:underline">
              Δες όλες τις ειδοποιήσεις →
            </Link>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
