'use client';
import { useEffect, useState } from 'react';
import { notificationsAPI, UPLOADS_URL } from '@/lib/api';
import { useNotificationStore } from '@/store/notificationStore';
import Link from 'next/link';
import styles from './notifications.module.css';

export default function NotificationsPage() {
  const { notifications, setNotifications, markAllRead } = useNotificationStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
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

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className={styles.notifPage}>
      <div className={styles.header}>
        <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800 }}>Notifications</h1>
      </div>

      <div className={styles.notifList}>
        {notifications.length === 0 ? (
          <div className={styles.empty}>
            <div style={{ fontSize: 48 }}>🔔</div>
            <h3>All caught up!</h3>
            <p>No notifications yet</p>
          </div>
        ) : (
          notifications.map((notif, i) => (
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
                <span className={styles.notifTime}>{timeAgo(notif.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
