'use client';
import { useEffect, useState } from 'react';
import { notificationsAPI, usersAPI, UPLOADS_URL } from '@/lib/api';
import { useNotificationStore } from '@/store/notificationStore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './notifications.module.css';

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, setNotifications, markAllRead } = useNotificationStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'requests' | 'activity'>('requests');
  const [followRequests, setFollowRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
    loadFollowRequests();
  }, []);

  const loadNotifications = async () => {
    try {
      const { data } = await notificationsAPI.getAll();
      setNotifications(data);
      await notificationsAPI.markAllRead();
      markAllRead();
    } catch {}
    finally { setLoading(false); }
  };

  const loadFollowRequests = async () => {
    setRequestsLoading(true);
    try {
      const { data } = await usersAPI.getFollowRequests();
      setFollowRequests(data);
    } catch {}
    finally { setRequestsLoading(false); }
  };

  const handleAcceptRequest = async (followId: string, follower: any) => {
    setActionLoading(followId);
    try {
      await usersAPI.handleFollowRequest(followId, 'accept');
      // Mark as accepted in local state — show "Follow Back" option
      setFollowRequests(prev =>
        prev.map(r => r.id === followId ? { ...r, accepted: true } : r)
      );
    } catch {}
    finally { setActionLoading(null); }
  };

  const handleDeclineRequest = async (followId: string) => {
    setActionLoading(followId);
    try {
      await usersAPI.handleFollowRequest(followId, 'reject');
      setFollowRequests(prev => prev.filter(r => r.id !== followId));
    } catch {}
    finally { setActionLoading(null); }
  };

  const handleFollowBack = async (userId: string, followId: string) => {
    setActionLoading(followId);
    try {
      await usersAPI.follow(userId);
      setFollowRequests(prev =>
        prev.map(r => r.id === followId ? { ...r, followedBack: true } : r)
      );
    } catch {}
    finally { setActionLoading(null); }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'LIKE': return '❤️';
      case 'COMMENT': return '💬';
      case 'FOLLOW_REQUEST': return '👋';
      case 'FOLLOW_ACCEPT': return '✅';
      case 'NEW_POST': return '📸';
      case 'MESSAGE': return '✉️';
      case 'GAME_INVITE': return '🎮';
      case 'CALL': return '📞';
      default: return '🔔';
    }
  };

  const timeAgo = (date: string) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  // Filter activity notifications (exclude FOLLOW_REQUEST since those are in the requests tab)
  const activityNotifications = notifications.filter(n => n.type !== 'FOLLOW_REQUEST');

  if (loading && requestsLoading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className={styles.notifPage}>
      <div className={styles.header}>
        <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800 }}>Notifications</h1>
      </div>

      {/* Tab Switcher */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'requests' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          👋 Follow Requests
          {followRequests.filter(r => !r.accepted).length > 0 && (
            <span className={styles.tabBadge}>{followRequests.filter(r => !r.accepted).length}</span>
          )}
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'activity' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          🔔 Activity
        </button>
      </div>

      {/* Follow Requests Tab */}
      {activeTab === 'requests' && (
        <div className={styles.requestsSection}>
          {requestsLoading ? (
            <div className={styles.empty}><div className="spinner"></div></div>
          ) : followRequests.length === 0 ? (
            <div className={styles.empty}>
              <div style={{ fontSize: 48 }}>👋</div>
              <h3>No follow requests</h3>
              <p>When people request to follow you, they&apos;ll appear here</p>
            </div>
          ) : (
            <div className={styles.requestList}>
              {followRequests.map((req, i) => (
                <div key={req.id} className={styles.requestCard} style={{ animationDelay: `${i * 0.05}s` }}>
                  <Link href={`/profile/${req.follower.username}`} className={styles.requestUser}>
                    {req.follower.avatar ? (
                      <img src={`${UPLOADS_URL}${req.follower.avatar}`} alt="" className={styles.requestAvatar} />
                    ) : (
                      <div className={styles.requestAvatarFallback}>{req.follower.name[0]}</div>
                    )}
                    <div className={styles.requestInfo}>
                      <span className={styles.requestName}>{req.follower.name}</span>
                      <span className={styles.requestUsername}>@{req.follower.username}</span>
                      {req.follower.bio && <span className={styles.requestBio}>{req.follower.bio}</span>}
                    </div>
                  </Link>
                  <div className={styles.requestActions}>
                    {req.accepted ? (
                      req.followedBack ? (
                        <button className={`${styles.actionBtn} ${styles.followingBtn}`} disabled>
                          ✓ Following
                        </button>
                      ) : (
                        <>
                          <span className={styles.acceptedLabel}>✅ Accepted</span>
                          <button
                            className={`${styles.actionBtn} ${styles.followBackBtn}`}
                            onClick={() => handleFollowBack(req.follower.id, req.id)}
                            disabled={actionLoading === req.id}
                          >
                            {actionLoading === req.id ? '...' : '➕ Follow Back'}
                          </button>
                        </>
                      )
                    ) : (
                      <>
                        <button
                          className={`${styles.actionBtn} ${styles.acceptBtn}`}
                          onClick={() => handleAcceptRequest(req.id, req.follower)}
                          disabled={actionLoading === req.id}
                        >
                          {actionLoading === req.id ? '...' : 'Accept'}
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.declineBtn}`}
                          onClick={() => handleDeclineRequest(req.id)}
                          disabled={actionLoading === req.id}
                        >
                          Decline
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <div className={styles.notifList}>
          {activityNotifications.length === 0 ? (
            <div className={styles.empty}>
              <div style={{ fontSize: 48 }}>🔔</div>
              <h3>All caught up!</h3>
              <p>No notifications yet</p>
            </div>
          ) : (
            activityNotifications.map((notif, i) => (
              <div key={notif.id} className={`${styles.notifItem} ${!notif.read ? styles.unread : ''}`} style={{ animationDelay: `${i * 0.03}s` }}>
                <div className={styles.notifIcon}>{getIcon(notif.type)}</div>
                <div className={styles.notifContent}>
                  <div className={styles.notifRow}>
                    {notif.sender && (
                      <Link href={`/profile/${notif.sender.username}`} className={styles.notifSender}>
                        {notif.sender.avatar ? (
                          <img src={`${UPLOADS_URL}${notif.sender.avatar}`} alt="" className="avatar avatar-sm" />
                        ) : (
                          <div className={styles.avatarFallback}>{notif.sender.name[0]}</div>
                        )}
                      </Link>
                    )}
                    <p className={styles.notifText}>{notif.content}</p>
                  </div>
                  {notif.type === 'GAME_INVITE' && notif.referenceId && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: 6, padding: '6px 16px', fontSize: 12, borderRadius: 16 }}
                      onClick={() => router.push(`/games/${notif.referenceId}`)}
                    >
                      🎮 Join Now
                    </button>
                  )}
                  <span className={styles.notifTime}>{timeAgo(notif.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
