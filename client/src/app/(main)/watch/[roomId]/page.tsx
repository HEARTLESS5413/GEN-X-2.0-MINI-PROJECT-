'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { watchAPI, usersAPI, UPLOADS_URL } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import styles from './watchroom.module.css';

export default function WatchRoomPage() {
  const { roomId } = useParams() as { roomId: string };
  const router = useRouter();
  const { user } = useAuthStore();

  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [queueUrl, setQueueUrl] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [copied, setCopied] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    loadRoom();
    const socket = getSocket();
    if (!socket) return;
    socket.emit('joinWatchRoom', { roomId });

    socket.on('watchMemberJoined', ({ userId, username }: any) => {
      setChatMessages(prev => [...prev, { system: true, text: `${username || 'Someone'} joined` }]);
      loadRoom();
    });
    socket.on('watchMemberLeft', ({ userId, username }: any) => {
      setChatMessages(prev => [...prev, { system: true, text: `${username || 'Someone'} left` }]);
      loadRoom();
    });
    socket.on('watchChatMessage', (msg: any) => {
      setChatMessages(prev => [...prev, msg]);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    socket.on('watchSyncUpdate', (data: any) => {
      if (data.by === user?.id) return;
      if (videoRef.current) {
        videoRef.current.currentTime = data.currentTime;
        if (data.action === 'play') videoRef.current.play();
        else if (data.action === 'pause') videoRef.current.pause();
      }
    });
    socket.on('watchVideoChanged', (data: any) => {
      setRoom((prev: any) => prev ? { ...prev, videoUrl: data.videoUrl, videoType: data.videoType, videoQueue: data.queue || prev.videoQueue } : prev);
      setChatMessages(prev => [...prev, { system: true, text: 'Video changed!' }]);
    });
    socket.on('watchQueueUpdated', (data: any) => {
      setRoom((prev: any) => prev ? { ...prev, videoQueue: data.queue } : prev);
    });
    socket.on('watchRoomClosed', () => {
      alert('Watch party has ended.');
      router.push('/watch');
    });

    return () => {
      socket.off('watchMemberJoined');
      socket.off('watchMemberLeft');
      socket.off('watchChatMessage');
      socket.off('watchSyncUpdate');
      socket.off('watchVideoChanged');
      socket.off('watchQueueUpdated');
      socket.off('watchRoomClosed');
    };
  }, [roomId]);

  const loadRoom = async () => {
    try {
      const { data } = await watchAPI.getRoom(roomId);
      setRoom(data);
    } catch { router.push('/watch'); }
    finally { setLoading(false); }
  };

  const getYoutubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match?.[1];
  };

  const handleVideoEvent = (action: 'play' | 'pause' | 'seek') => {
    const socket = getSocket();
    if (!socket || !videoRef.current) return;
    socket.emit('watchSync', { roomId, action, currentTime: videoRef.current.currentTime });
  };

  const handleSendChat = (e?: any) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    const socket = getSocket();
    if (socket) socket.emit('watchChat', { roomId, message: chatInput.trim() });
    setChatInput('');
  };

  const handleLeave = async () => {
    try {
      await watchAPI.leaveRoom(roomId);
      const socket = getSocket();
      if (socket) socket.emit('leaveWatchRoom', { roomId });
      router.push('/watch');
    } catch {}
  };

  const handleCloseRoom = async () => {
    if (!confirm('Close this watch party for everyone?')) return;
    try {
      await watchAPI.closeRoom(roomId);
      router.push('/watch');
    } catch (e: any) { alert(e.response?.data?.error || 'Failed'); }
  };

  const handleQueueSubmit = async (e: any) => {
    e.preventDefault();
    if (!queueUrl.trim()) return;
    try {
      await watchAPI.queueVideo(roomId, queueUrl.trim());
      setQueueUrl('');
    } catch {}
  };

  const handleAcceptQueue = async (index: number) => {
    try { await watchAPI.acceptQueue(roomId, index); } catch {}
  };

  const handleRejectQueue = async (index: number) => {
    try { await watchAPI.rejectQueue(roomId, index); } catch {}
  };

  const fetchFriends = async () => {
    if (!user?.id) return;
    try {
      const [{ data: fData }, { data: gData }] = await Promise.all([usersAPI.getFollowers(user.id), usersAPI.getFollowing(user.id)]);
      const fl = fData?.users || fData || [];
      const gl = gData?.users || gData || [];
      setFriendsList(Array.from(new Map([...fl, ...gl].map((i: any) => [i.id, i])).values()));
    } catch {}
  };

  const handleInviteFriend = (friendId: string) => {
    setInvitingId(friendId);
    const socket = getSocket();
    if (socket) {
      socket.emit('watchSendInvite', { receiverId: friendId, roomId });
      setTimeout(() => { setInvitingId(null); alert('Invite sent!'); }, 300);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/watch/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHost = room?.hostId === user?.id;
  const queue = Array.isArray(room?.videoQueue) ? room.videoQueue : [];

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;
  if (!room) return <div style={{ padding: 40, textAlign: 'center' }}><h2>Room not found</h2></div>;

  return (
    <div className={styles.roomPage}>
      {/* Video Area */}
      <div className={styles.videoSection}>
        <div className={styles.videoContainer}>
          {room.videoType === 'youtube' ? (
            <iframe
              src={`https://www.youtube.com/embed/${getYoutubeId(room.videoUrl)}?enablejsapi=1&autoplay=1`}
              className={styles.videoPlayer}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
            />
          ) : (
            <video
              ref={videoRef}
              src={room.videoUrl}
              className={styles.videoPlayer}
              controls
              onPlay={() => handleVideoEvent('play')}
              onPause={() => handleVideoEvent('pause')}
              onSeeked={() => handleVideoEvent('seek')}
            />
          )}
        </div>

        {/* Room Controls */}
        <div className={styles.controls}>
          <div className={styles.roomMeta}>
            <span className={styles.hostBadge}>🎬 {room.host?.username}'s Party</span>
            <span className={styles.viewerCount}>👁️ {room.members?.length || 1} watching</span>
          </div>
          <div className={styles.controlBtns}>
            <button className={styles.controlBtn} onClick={handleCopyLink}>
              {copied ? '✅ Copied!' : '🔗 Copy Link'}
            </button>
            <button className={styles.controlBtn} onClick={() => { setShowInvite(true); fetchFriends(); }}>
              👋 Invite
            </button>
            <button className={styles.controlBtn} onClick={() => setShowChat(!showChat)}>
              💬 {showChat ? 'Hide' : 'Show'} Chat
            </button>
            {isHost ? (
              <button className={styles.controlBtn} onClick={handleCloseRoom} style={{ color: '#ef4444' }}>
                ✕ Close Room
              </button>
            ) : (
              <button className={styles.controlBtn} onClick={handleLeave} style={{ color: '#ef4444' }}>
                🚪 Leave
              </button>
            )}
          </div>
        </div>

        {/* Video Queue */}
        <div className={styles.queueSection}>
          <h4 className={styles.sectionLabel}>📋 Video Queue ({queue.length})</h4>
          <form onSubmit={handleQueueSubmit} className={styles.queueForm}>
            <input
              className={styles.queueInput}
              placeholder="Paste a YouTube or video URL..."
              value={queueUrl}
              onChange={(e) => setQueueUrl(e.target.value)}
            />
            <button type="submit" className={styles.queueSubmitBtn} disabled={!queueUrl.trim()}>Add</button>
          </form>
          {queue.length > 0 && (
            <div className={styles.queueList}>
              {queue.map((item: any, i: number) => (
                <div key={i} className={styles.queueItem}>
                  <div className={styles.queueItemInfo}>
                    <span className={styles.queueUrl}>{item.url.length > 40 ? item.url.slice(0, 40) + '...' : item.url}</span>
                    <span className={styles.queueBy}>by {item.addedByUsername}</span>
                  </div>
                  {isHost && (
                    <div className={styles.queueActions}>
                      <button onClick={() => handleAcceptQueue(i)} className={styles.queueAccept}>▶ Play</button>
                      <button onClick={() => handleRejectQueue(i)} className={styles.queueReject}>✕</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Members */}
        <div className={styles.membersSection}>
          <h4 className={styles.sectionLabel}>👥 Members</h4>
          <div className={styles.membersList}>
            {room.members?.map((m: any) => (
              <div key={m.user.id} className={styles.memberItem}>
                {m.user.avatar ? (
                  <img src={`${UPLOADS_URL}${m.user.avatar}`} alt="" className={styles.memberAvatar} />
                ) : (
                  <div className={styles.memberAvatarFallback}>{m.user.username[0].toUpperCase()}</div>
                )}
                <span>{m.user.username}</span>
                {m.user.id === room.hostId && <span className={styles.hostTag}>Host</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className={styles.chatPanel}>
          <div className={styles.chatHeader}>
            <h3>💬 Live Chat</h3>
            <button onClick={() => setShowChat(false)} className={styles.chatClose}>✕</button>
          </div>
          <div className={styles.chatMessages}>
            {chatMessages.map((msg, i) => (
              <div key={i} className={`${styles.chatMsg} ${msg.system ? styles.systemMsg : ''}`}>
                {msg.system ? (
                  <span className={styles.systemText}>{msg.text}</span>
                ) : (
                  <>
                    <strong className={styles.chatUser}>{msg.userId === user?.id ? 'You' : msg.username}</strong>
                    <span>{msg.message}</span>
                  </>
                )}
              </div>
            ))}
            <div ref={chatEndRef}></div>
          </div>
          <form onSubmit={handleSendChat} className={styles.chatInputArea}>
            <input
              className={styles.chatInputField}
              placeholder="Say something..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button type="submit" className={styles.chatSendBtn}>Send</button>
          </form>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className={styles.modalOverlay} onClick={() => setShowInvite(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Invite Friends</h3>
              <button onClick={() => setShowInvite(false)} className={styles.modalClose}>×</button>
            </div>
            <button className={styles.copyLinkBtn} onClick={handleCopyLink}>
              {copied ? '✅ Link Copied!' : '🔗 Copy Invite Link'}
            </button>
            <div className={styles.friendList}>
              {friendsList.length === 0 ? (
                <p className={styles.emptyText}>No friends found.</p>
              ) : friendsList.map(friend => (
                <div key={friend.id} className={styles.friendItem}>
                  <div className={styles.friendInfo}>
                    {friend.avatar ? (
                      <img src={`${UPLOADS_URL}${friend.avatar}`} alt="" className={styles.friendAvatar} />
                    ) : (
                      <div className={styles.friendAvatarFallback}>{friend.username[0].toUpperCase()}</div>
                    )}
                    <span>{friend.username}</span>
                  </div>
                  <button
                    className={styles.inviteBtn}
                    onClick={() => handleInviteFriend(friend.id)}
                    disabled={invitingId === friend.id}
                  >
                    {invitingId === friend.id ? 'Sending...' : 'Invite'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
