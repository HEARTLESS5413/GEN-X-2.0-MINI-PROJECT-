'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { notificationsAPI } from '@/lib/api';
import { UPLOADS_URL } from '@/lib/api';
import CallProvider from '@/components/CallProvider';
import styles from './main.module.css';

const navItems = [
  { icon: '🏠', label: 'Home', href: '/feed' },
  { icon: '🔍', label: 'Explore', href: '/explore' },
  { icon: '💬', label: 'Messages', href: '/messages' },
  { icon: '🎮', label: 'Games', href: '/games' },
  { icon: '🎬', label: 'Watch', href: '/watch' },
  { icon: '🔔', label: 'Notifications', href: '/notifications' },
  { icon: '👤', label: 'Profile', href: '/profile' },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, loadUser, logout } = useAuthStore();
  const { unreadCount, setUnreadCount, setupListeners } = useNotificationStore();
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      notificationsAPI.getUnreadCount().then(({ data }) => setUnreadCount(data.count)).catch(() => {});
      setupListeners();
    }
  }, [isAuthenticated, setUnreadCount, setupListeners]);

  if (isLoading) {
    return (
      <div className="page-loading" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 className="gradient-text" style={{ fontSize: 36, fontWeight: 800 }}>GenX</h1>
          <div className="spinner" style={{ margin: '20px auto' }}></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const profileHref = user ? `/profile/${user.username}` : '/profile';

  return (
    <div className={styles.appLayout}>
      {/* Desktop Sidebar */}
      <nav className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <Link href="/feed" className={styles.sidebarLogo}>
            G<span>X</span>
          </Link>

          <div className={styles.navItems}>
            {navItems.map((item) => {
              const href = item.label === 'Profile' ? profileHref : item.href;
              const isActive = item.label === 'Profile'
                ? pathname.startsWith('/profile')
                : pathname === item.href || pathname.startsWith(item.href + '/');

              return (
                <Link
                  key={item.label}
                  href={href}
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                  title={item.label}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navLabel}>{item.label}</span>
                  {item.label === 'Notifications' && unreadCount > 0 && (
                    <span className={styles.navBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        <div className={styles.sidebarBottom}>
          <button onClick={() => setShowMenu(!showMenu)} className={styles.userBtn}>
            {user?.avatar ? (
              <img src={`${UPLOADS_URL}${user.avatar}`} alt="" className="avatar avatar-sm" />
            ) : (
              <div className={styles.avatarPlaceholder}>{user?.name?.[0]?.toUpperCase()}</div>
            )}
            <span className={styles.navLabel}>{user?.username}</span>
          </button>

          {showMenu && (
            <div className={styles.dropdownMenu}>
              <Link href={`/profile/${user?.username}`} className={styles.dropdownItem} onClick={() => setShowMenu(false)}>
                👤 Profile
              </Link>
              <Link href="/settings" className={styles.dropdownItem} onClick={() => setShowMenu(false)}>
                ⚙️ Settings
              </Link>
              {user?.role === 'ADMIN' && (
                <Link href="/admin" className={styles.dropdownItem} onClick={() => setShowMenu(false)}>
                  🛡️ Admin
                </Link>
              )}
              <button onClick={logout} className={`${styles.dropdownItem} ${styles.logoutBtn}`}>
                🚪 Log Out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Global Call Provider */}
      <CallProvider />

      {/* Main Content */}
      <main className={styles.mainContent}>
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className={styles.mobileNav}>
        {navItems.slice(0, 5).map((item) => {
          const href = item.label === 'Profile' ? profileHref : item.href;
          const isActive = item.label === 'Profile'
            ? pathname.startsWith('/profile')
            : pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.label}
              href={href}
              className={`${styles.mobileNavItem} ${isActive ? styles.mobileNavActive : ''}`}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              {item.label === 'Notifications' && unreadCount > 0 && (
                <span className={styles.mobileBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
