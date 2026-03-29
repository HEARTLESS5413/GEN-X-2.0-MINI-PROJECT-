'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { watchAPI } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import styles from './watch.module.css';

export default function WatchPage() {
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState<any[]>([]);
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setupSocket();
  }, []);

  const setupSocket = () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('watchSync', (data: any) => {
      if (videoRef.current && data.senderId !== user?.id) {
        videoRef.current.currentTime = data.currentTime;
        if (data.isPlaying) videoRef.current.play();
        else videoRef.current.pause();
      }
    });

    socket.on('watchChat', (msg: any) => {
      setChatMessages(prev => [...prev, msg]);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    socket.on('watchUserJoined', ({ userId, username }: any) => {
      setChatMessages(prev => [...prev, { system: true, text: `${username} joined the room` }]);
    });

    socket.on('watchUserLeft', ({ userId, username }: any) => {
      setChatMessages(prev => [...prev, { system: true, text: `${username} left the room` }]);
    });

    return () => {
      socket.off('watchSync');
      socket.off('watchChat');
      socket.off('watchUserJoined');
      socket.off('watchUserLeft');
    };
  };

  const handleCreateRoom = async () => {
    if (!videoUrl.trim()) return;
    setLoading(true);
    try {
      const videoType = videoUrl.includes('youtube') || videoUrl.includes('youtu.be') ? 'YOUTUBE' : 'DIRECT';
      const { data } = await watchAPI.createRoom(videoUrl, videoType);
      setActiveRoom(data);
      setShowCreate(false);
      setVideoUrl('');

      const socket = getSocket();
      if (socket) socket.emit('joinWatchRoom', { roomId: data.id });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleJoinRoom = async (roomId: string) => {
    try {
      const { data } = await watchAPI.joinRoom(roomId);
      setActiveRoom(data);

      const socket = getSocket();
      if (socket) socket.emit('joinWatchRoom', { roomId });
    } catch {}
  };

  const handleLeaveRoom = async () => {
    if (!activeRoom) return;
    try {
      await watchAPI.leaveRoom(activeRoom.id);
      const socket = getSocket();
      if (socket) socket.emit('leaveWatchRoom', { roomId: activeRoom.id });
      setActiveRoom(null);
      setChatMessages([]);
    } catch {}
  };

  const handleVideoEvent = (action: 'play' | 'pause' | 'seek') => {
    const socket = getSocket();
    if (!socket || !videoRef.current || !activeRoom) return;

    socket.emit('watchAction', {
      roomId: activeRoom.id,
      action,
      currentTime: videoRef.current.currentTime,
      isPlaying: action === 'play',
    });
  };

  const handleSendChat = () => {
    if (!chatInput.trim() || !activeRoom) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('watchChat', {
      roomId: activeRoom.id,
      message: chatInput.trim(),
    });

    setChatInput('');
  };

  const getYoutubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match?.[1];
  };

  return (
    <div className={styles.watchPage}>
      <div className={styles.header}>
        <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800 }}>Watch Party</h1>
        {!activeRoom && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>🎬 Create Room</button>
        )}
      </div>

      {activeRoom ? (
        <div className={styles.activeRoom}>
          {/* Video Player */}
          <div className={styles.videoSection}>
            <div className={styles.videoContainer}>
              {activeRoom.videoType === 'YOUTUBE' ? (
                <iframe
                  src={`https://www.youtube.com/embed/${getYoutubeId(activeRoom.videoUrl)}?enablejsapi=1&autoplay=1`}
                  className={styles.videoPlayer}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                ></iframe>
              ) : (
                <video
                  ref={videoRef}
                  src={activeRoom.videoUrl}
                  className={styles.videoPlayer}
                  controls
                  onPlay={() => handleVideoEvent('play')}
                  onPause={() => handleVideoEvent('pause')}
                  onSeeked={() => handleVideoEvent('seek')}
                />
              )}
            </div>

            <div className={styles.videoControls}>
              <div className={styles.roomInfo}>
                <span className={styles.roomHost}>🎬 Room by {activeRoom.host?.username || 'You'}</span>
                <span className={styles.viewerCount}>👁️ {activeRoom.participants?.length || 1} watching</span>
              </div>
              <button className="btn btn-danger btn-sm" onClick={handleLeaveRoom}>Leave Room</button>
            </div>
          </div>

          {/* Chat Panel */}
          <div className={styles.chatPanel}>
            <div className={styles.chatHeader}>
              <h3>💬 Live Chat</h3>
            </div>
            <div className={styles.chatMessages}>
              {chatMessages.map((msg, i) => (
                <div key={i} className={`${styles.chatMsg} ${msg.system ? styles.systemMsg : ''}`}>
                  {msg.system ? (
                    <span className={styles.systemText}>{msg.text}</span>
                  ) : (
                    <>
                      <strong className={styles.chatUser}>{msg.username}</strong>
                      <span>{msg.message}</span>
                    </>
                  )}
                </div>
              ))}
              <div ref={chatEndRef}></div>
            </div>
            <div className={styles.chatInput}>
              <input
                className="input"
                placeholder="Say something..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              />
              <button className="btn btn-primary btn-sm" onClick={handleSendChat} disabled={!chatInput.trim()}>Send</button>
            </div>
          </div>
        </div>
      ) : (
        /* Room List / Empty State */
        <div className={styles.emptyState}>
          <div style={{ fontSize: 64 }}>🎬</div>
          <h2>Watch Together</h2>
          <p>Create a room and invite friends to watch videos in sync with live chat!</p>
          <button className="btn btn-primary btn-lg" onClick={() => setShowCreate(true)} style={{ marginTop: 16 }}>
            🚀 Create a Watch Room
          </button>
        </div>
      )}

      {/* Create Room Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-content" style={{ padding: 28 }}>
            <h3 className="gradient-text" style={{ fontSize: 20, marginBottom: 16 }}>Create Watch Room</h3>
            <div className="input-group" style={{ marginBottom: 16 }}>
              <label className="input-label">Video URL</label>
              <input
                className="input"
                placeholder="Paste YouTube or video URL..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Supports YouTube links and direct video URLs</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateRoom} disabled={loading || !videoUrl.trim()}>
                {loading ? 'Creating...' : '🎬 Create Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
