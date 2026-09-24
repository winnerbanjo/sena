'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  X,
  CheckCheck,
  Brush,
  CreditCard,
  DoorOpen,
  Calendar,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  type: 'housekeeping' | 'booking' | 'payment' | 'front_desk';
  href: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

interface NotificationsPopoverProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsPopover({ open, onClose }: NotificationsPopoverProps) {
  const router = useRouter();
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  if (!open) return null;

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleClickItem = (item: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, unread: false } : n))
    );
    router.push(item.href);
    onClose();
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'housekeeping':
        return <Brush className="w-3.5 h-3.5 text-[#B85C3E]" />;
      case 'booking':
        return <Calendar className="w-3.5 h-3.5 text-[#2E6B4F]" />;
      case 'payment':
        return <CreditCard className="w-3.5 h-3.5 text-[#3B6699]" />;
      case 'front_desk':
        return <DoorOpen className="w-3.5 h-3.5 text-[#71382D]" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-[#7A7267]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-16 sm:pt-20">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      {/* Popover Card */}
      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl border border-[#E8E2DA] overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-[#E8E2DA] flex items-center justify-between bg-[#FAFAFA]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#B85C3E]" />
            <h3 className="text-sm font-semibold text-[#191816]">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-[#B85C3E] text-white">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] text-[#B85C3E] hover:underline font-medium flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded text-[#7A7267] hover:text-[#191816]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="divide-y divide-[#E8E2DA] max-h-[380px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-[#7A7267] text-xs">
              No new notifications.
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleClickItem(item)}
                className={`p-3.5 flex items-start gap-3 hover:bg-[#FAFAFA] transition-colors cursor-pointer ${
                  item.unread ? 'bg-[#FDFBF9]' : 'bg-white'
                }`}
              >
                <div className="p-1.5 rounded bg-white border border-[#E8E2DA] flex-shrink-0 mt-0.5">
                  {getIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-semibold text-[#191816] truncate">
                      {item.title}
                    </h4>
                    <span className="text-[10px] text-[#7A7267] flex-shrink-0">
                      {item.time}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#7A7267] line-clamp-2 mt-0.5">
                    {item.description}
                  </p>
                </div>

                {item.unread && (
                  <span className="w-2 h-2 rounded-full bg-[#B85C3E] flex-shrink-0 mt-1.5 ring-2 ring-white" />
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-2.5 border-t border-[#E8E2DA] bg-[#FAFAFA] text-center">
          <button
            onClick={() => {
              router.push('/reservations');
              onClose();
            }}
            className="text-[11px] text-[#B85C3E] hover:underline font-medium flex items-center justify-center gap-1 w-full"
          >
            <span>View all property activity</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
