'use client';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { watchAPI, UPLOADS_URL } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import './WatchUI.css';

interface WatchState {
  roomId: string | null;
  videoUrl: string;
  videoType: string;
  hostUsername: string;
  memberCount: number;
}

const WatchContext = createContext<{
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  activeRoom: WatchState | null;
}>({ joinRoom: () => {}, leaveRoom: () => {}, activeRoom: null });

export const useWatch = () => useContext(WatchContext);

export default function WatchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [activeRoom, setActiveRoom] = useState<WatchState | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);
  const floatingRef = useRef<HTMLDivElement>(null);

  // Determine if currently on the watch room page
  const isOnWatchPage = activeRoom?.roomId && pathname === `/watch/${activeRoom.roomId}`;

  // When we navigate to the watch room page, expand. When we leave, minimize.
  useEffect(() => {
    if (!activeRoom) return;
    if (isOnWatchPage) {
      setIsMinimized(false);
    } else {
      setIsMinimized(true);
    }
  }, [pathname, activeRoom]);

  // Listen for room closed event
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleRoomClosed = ({ roomId }: any) => {
      if (activeRoom?.roomId === roomId) {
        setActiveRoom(null);
        setIsMinimized(false);
      }
    };

    socket.on('watchRoomClosed', handleRoomClosed);
    return () => { socket.off('watchRoomClosed', handleRoomClosed); };
  }, [activeRoom]);

  const joinRoom = async (roomId: string) => {
    try {
      const { data } = await watchAPI.getRoom(roomId);
      const socket = getSocket();
      if (socket) socket.emit('joinWatchRoom', { roomId });

      setActiveRoom({
        roomId,
        videoUrl: data.videoUrl,
        videoType: data.videoType,
        hostUsername: data.host?.username || 'Host',
        memberCount: data.members?.length || 1,
      });
    } catch (err) {
      console.error('Failed to join watch room:', err);
    }
  };

  const leaveRoom = async () => {
    if (!activeRoom?.roomId) return;
    try {
      await watchAPI.leaveRoom(activeRoom.roomId);
      const socket = getSocket();
      if (socket) socket.emit('leaveWatchRoom', { roomId: activeRoom.roomId });
    } catch {}
    setActiveRoom(null);
    setIsMinimized(false);
  };

  const getYoutubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match?.[1];
  };

  // Drag handling
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const el = floatingRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startX: clientX - rect.left, startY: clientY - rect.top };

    const handleDragMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragRef.current || !el) return;
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      el.style.left = `${Math.max(0, Math.min(window.innerWidth - el.offsetWidth, cx - dragRef.current.startX))}px`;
      el.style.top = `${Math.max(0, Math.min(window.innerHeight - el.offsetHeight, cy - dragRef.current.startY))}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    };
    const handleDragEnd = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove);
    window.addEventListener('touchend', handleDragEnd);
  };

  // Expose globally so watch room page can call joinRoom
  useEffect(() => {
    (window as any).__watchProvider = { joinRoom, leaveRoom, activeRoom };
    return () => { delete (window as any).__watchProvider; };
  }, [activeRoom]);

  return (
    <WatchContext.Provider value={{ joinRoom, leaveRoom, activeRoom }}>
      {children}

      {/* Floating mini player — only show when minimized (user navigated away from watch page) */}
      {activeRoom && isMinimized && !isOnWatchPage && (
        <div
          ref={floatingRef}
          className="watch-floating-mini"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="watch-floating-inner">
            {activeRoom.videoType === 'youtube' && getYoutubeId(activeRoom.videoUrl) ? (
              <iframe
                src={`https://www.youtube.com/embed/${getYoutubeId(activeRoom.videoUrl)}?autoplay=1&mute=1`}
                className="watch-floating-video"
                allow="autoplay; encrypted-media"
              />
            ) : (
              <video
                src={activeRoom.videoUrl}
                className="watch-floating-video"
                autoPlay
                muted
              />
            )}
            <div className="watch-floating-overlay">
              <div className="watch-floating-info">
                <span className="watch-floating-host">🎬 {activeRoom.hostUsername}</span>
              </div>
              <div className="watch-floating-btns">
                <button
                  className="watch-mini-btn watch-mini-expand"
                  onClick={(e) => { e.stopPropagation(); router.push(`/watch/${activeRoom.roomId}`); }}
                  title="Return to room"
                >
                  ⬆
                </button>
                <button
                  className="watch-mini-btn watch-mini-leave"
                  onClick={(e) => { e.stopPropagation(); leaveRoom(); }}
                  title="Leave party"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </WatchContext.Provider>
  );
}
