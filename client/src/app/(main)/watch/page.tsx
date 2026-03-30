'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { watchAPI, usersAPI, UPLOADS_URL } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import styles from './watch.module.css';

export default function WatchPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    if (!videoUrl.trim()) return;
    setLoading(true);
    try {
      const videoType = videoUrl.includes('youtube') || videoUrl.includes('youtu.be') ? 'youtube' : 'direct';
      const { data } = await watchAPI.createRoom(videoUrl, videoType);
      setCreatedRoomId(data.id);
      setShowCreate(false);
      setVideoUrl('');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to create room. Please try again.');
    }
    finally { setLoading(false); }
  };

  const handleGoToRoom = () => {
    if (createdRoomId) router.push(`/watch/${createdRoomId}`);
  };

  const handleCopyLink = () => {
    if (!createdRoomId) return;
    navigator.clipboard.writeText(`${window.location.origin}/watch/${createdRoomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    if (!createdRoomId) return;
    setInvitingId(friendId);
    const socket = getSocket();
    if (socket) {
      socket.emit('watchSendInvite', { receiverId: friendId, roomId: createdRoomId });
      setTimeout(() => { setInvitingId(null); }, 500);
    }
  };

  const handleJoinById = () => {
    const id = prompt('Enter Watch Room ID or Link:');
    if (!id) return;
    const roomId = id.includes('/watch/') ? id.split('/watch/')[1] : id;
    router.push(`/watch/${roomId.trim()}`);
  };

  return (
    <div className={styles.watchPage}>
      <div className={styles.header}>
        <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800 }}>📺 Watch Party</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleJoinById}>🔗 Join Room</button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>🎬 Create Room</button>
        </div>
      </div>

      {/* After room created - show invite panel */}
      {createdRoomId ? (
        <div className={styles.createdPanel}>
          <div className={styles.createdCard}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2>Room Created!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Share with friends or enter the room</p>

            <div className={styles.createdActions}>
              <button className="btn btn-primary btn-lg" onClick={handleGoToRoom} style={{ flex: 1 }}>
                ▶️ Enter Room
              </button>
              <button className="btn btn-secondary btn-lg" onClick={handleCopyLink} style={{ flex: 1 }}>
                {copied ? '✅ Copied!' : '🔗 Copy Link'}
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => { setShowInvite(true); fetchFriends(); }} style={{ flex: 1 }}>
                👋 Invite Friends
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className={styles.emptyState}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>📺</div>
          <h2>Watch Together</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 24px' }}>
            Create a watch party room and invite friends to watch videos in sync with live chat and voice!
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={() => setShowCreate(true)}>
              🚀 Create Watch Room
            </button>
            <button className="btn btn-secondary btn-lg" onClick={handleJoinById}>
              🔗 Join with Link
            </button>
          </div>
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
                onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
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

      {/* Invite Friends Modal */}
      {showInvite && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="modal-content" style={{ padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Invite Friends</h3>
              <button onClick={() => setShowInvite(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
              {friendsList.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No friends found.</p>
              ) : friendsList.map(friend => (
                <div key={friend.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, background: 'var(--bg-secondary)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {friend.avatar ? (
                      <img src={`${UPLOADS_URL}${friend.avatar}`} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {friend.username[0].toUpperCase()}
                      </div>
                    )}
                    <span style={{ fontWeight: 600 }}>{friend.username}</span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => handleInviteFriend(friend.id)} disabled={invitingId === friend.id}>
                    {invitingId === friend.id ? '✓ Sent' : 'Invite'}
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
