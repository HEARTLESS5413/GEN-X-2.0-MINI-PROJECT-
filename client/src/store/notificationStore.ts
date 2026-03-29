import { create } from 'zustand';
import { getSocket } from '@/lib/socket';

interface Notification {
  id: string;
  type: string;
  content: string;
  read: boolean;
  senderId: string;
  referenceId?: string;
  sender?: { id: string; username: string; avatar: string; name: string };
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (n: Notification[]) => void;
  addNotification: (n: Notification) => void;
  setUnreadCount: (c: number) => void;
  markAllRead: () => void;
  setupListeners: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) => set({ notifications }),
  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
    // Play notification sound
    if (typeof window !== 'undefined') {
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgkLS4lV84LViKtbiidkEtUIC3vKd9RTFTfbW6qIFFNU+Asr2qg0g5T4CwvaqDSjpOgK++q4JLPFB/rbysf0s/Un6svax+S0FSfqu8rX1MQ1N9qrytfExDU32qvK18TENTfaq8rXxMQ1N9');
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch {}
    }
  },
  setUnreadCount: (count) => set({ unreadCount: count }),
  markAllRead: () => set({ notifications: get().notifications.map(n => ({ ...n, read: true })), unreadCount: 0 }),
  
  setupListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('notification', (notification: Notification) => {
      get().addNotification(notification);
    });
  },
}));
