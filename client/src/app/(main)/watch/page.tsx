'use client';
import { useState } from 'react';
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
      {/* Animated background elements */}
      <div className={styles.bgOrbs}>
        <div className={styles.orb1}></div>
        <div className={styles.orb2}></div>
        <div className={styles.orb3}></div>
      </div>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#iconGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <defs><linearGradient id="iconGrad" x1="0" y1="0" x2="24" y2="24"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#ec4899"/></linearGradient></defs>
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><polygon points="10,8 16,11 10,14" fill="url(#iconGrad)" stroke="none"/>
            </svg>
          </div>
          <div>
            <h1 className={styles.title}>Watch Party</h1>
            <p className={styles.subtitle}>Sync videos with friends in real-time</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnGhost} onClick={handleJoinById}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Join Room
          </button>
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Room
          </button>
        </div>
      </div>

      {/* After room created - show invite panel */}
      {createdRoomId ? (
        <div className={styles.createdPanel}>
          <div className={styles.createdCard}>
            <div className={styles.successIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <h2 className={styles.createdTitle}>Room is Live!</h2>
            <p className={styles.createdSub}>Share the link or invite friends to start watching</p>

            <div className={styles.createdActions}>
              <button className={styles.actionCard} onClick={handleGoToRoom}>
                <div className={styles.actionIcon} style={{background: 'linear-gradient(135deg, #a78bfa, #7c3aed)'}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polygon points="5,3 19,12 5,21"/></svg>
                </div>
                <span>Enter Room</span>
              </button>
              <button className={styles.actionCard} onClick={handleCopyLink}>
                <div className={styles.actionIcon} style={{background: 'linear-gradient(135deg, #06b6d4, #0284c7)'}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </div>
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
              <button className={styles.actionCard} onClick={() => { setShowInvite(true); fetchFriends(); }}>
                <div className={styles.actionIcon} style={{background: 'linear-gradient(135deg, #f472b6, #ec4899)'}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                </div>
                <span>Invite Friends</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Hero / Empty state */
        <div className={styles.heroSection}>
          <div className={styles.heroCard}>
            <div className={styles.heroVisual}>
              <div className={styles.screenMock}>
                <div className={styles.screenTop}>
                  <span></span><span></span><span></span>
                </div>
                <div className={styles.screenBody}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,0.6)" strokeWidth="1.5"><polygon points="5,3 19,12 5,21"/></svg>
                </div>
              </div>
              <div className={styles.avatarStack}>
                <div className={styles.stackAvatar} style={{background: '#a78bfa'}}>A</div>
                <div className={styles.stackAvatar} style={{background: '#ec4899'}}>B</div>
                <div className={styles.stackAvatar} style={{background: '#06b6d4'}}>C</div>
                <div className={styles.stackAvatar} style={{background: '#22c55e', fontSize: 12}}>+2</div>
              </div>
            </div>
            <h2 className={styles.heroTitle}>Watch Together, <span>Anywhere</span></h2>
            <p className={styles.heroDesc}>
              Create a room, invite friends, and enjoy synced video playback with live chat. Perfect for movie nights, music sessions, or study groups.
            </p>
            <div className={styles.heroFeatures}>
              <div className={styles.featureTag}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Synced Playback
              </div>
              <div className={styles.featureTag}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Live Chat
              </div>
              <div className={styles.featureTag}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
                Invite Friends
              </div>
            </div>
            <div className={styles.heroBtns}>
              <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5,3 19,12 5,21"/></svg>
                Create Watch Room
              </button>
              <button className={styles.btnGhost} onClick={handleJoinById}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                Join with Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Room Modal */}
      {showCreate && (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div className={styles.modalIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
              <h3>Create Watch Room</h3>
              <button onClick={() => setShowCreate(false)} className={styles.modalClose}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.inputLabel}>Video URL</label>
              <div className={styles.inputWrapper}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <input
                  className={styles.inputField}
                  placeholder="Paste YouTube or video URL..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                  autoFocus
                />
              </div>
              <p className={styles.inputHint}>Supports YouTube links and direct video URLs</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleCreateRoom} disabled={loading || !videoUrl.trim()}>
                {loading ? (
                  <><span className={styles.spinner}></span> Creating...</>
                ) : (
                  <>Create Room</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Friends Modal */}
      {showInvite && (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowInvite(false)}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div className={styles.modalIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              </div>
              <h3>Invite Friends</h3>
              <button onClick={() => setShowInvite(false)} className={styles.modalClose}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className={styles.friendList}>
              {friendsList.length === 0 ? (
                <p className={styles.emptyFriends}>No friends found. Follow users first!</p>
              ) : friendsList.map(friend => (
                <div key={friend.id} className={styles.friendItem}>
                  <div className={styles.friendInfo}>
                    {friend.avatar ? (
                      <img src={`${UPLOADS_URL}${friend.avatar}`} alt="" className={styles.friendAvatar} />
                    ) : (
                      <div className={styles.friendAvatarFb}>{friend.username[0].toUpperCase()}</div>
                    )}
                    <span className={styles.friendName}>{friend.username}</span>
                  </div>
                  <button
                    className={invitingId === friend.id ? styles.btnSent : styles.btnInvite}
                    onClick={() => handleInviteFriend(friend.id)}
                    disabled={invitingId === friend.id}
                  >
                    {invitingId === friend.id ? (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Sent</>
                    ) : 'Invite'}
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
