'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { notificationsAPI } from '@/lib/api';
import { UPLOADS_URL } from '@/lib/api';
import CallProvider from '@/components/CallProvider';
import WatchProvider from '@/components/WatchProvider';
import styles from './main.module.css';

const navItems = [
  {
    label: 'Home', href: '/feed',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    label: 'Explore', href: '/explore',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  },
  {
    label: 'Messages', href: '/messages',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  },
  {
    label: 'Games', href: '/games',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="10" y1="12" x2="10" y2="12"/><circle cx="17" cy="10" r="1"/><circle cx="15" cy="14" r="1"/></svg>,
  },
  {
    label: 'Watch', href: '/watch',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  },
  {
    label: 'Notifications', href: '/notifications',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  },
  {
    label: 'Profile', href: '/profile',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  },
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
          <div className={styles.loadingLogo}>
            <svg width="48" height="48" viewBox="0 0 40 40" fill="none">
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40">
                  <stop offset="0%" stopColor="#8B5CF6"/>
                  <stop offset="100%" stopColor="#EC4899"/>
                </linearGradient>
              </defs>
              <path d="M8 8h10v10H8V8z M22 8h10v10H22V8z M8 22h10v10H8V22z M22 22h10v6a4 4 0 0 1-4 4h-6V22z" fill="url(#logoGrad)" opacity="0.9"/>
            </svg>
            <span>GenX</span>
          </div>
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
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none" className={styles.logoSvg}>
              <defs>
                <linearGradient id="sideLogoGrad" x1="0" y1="0" x2="40" y2="40">
                  <stop offset="0%" stopColor="#8B5CF6"/>
                  <stop offset="100%" stopColor="#EC4899"/>
                </linearGradient>
              </defs>
              <path d="M8 8h10v10H8V8z M22 8h10v10H22V8z M8 22h10v10H8V22z M22 22h10v6a4 4 0 0 1-4 4h-6V22z" fill="url(#sideLogoGrad)"/>
            </svg>
            <span className={styles.logoText}>Gen<span>X</span></span>
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
              <img src={`${UPLOADS_URL}${user.avatar}`} alt="" className={styles.userAvatar} />
            ) : (
              <div className={styles.avatarPlaceholder}>{user?.name?.[0]?.toUpperCase()}</div>
            )}
            <span className={styles.navLabel}>{user?.username}</span>
          </button>

          {showMenu && (
            <div className={styles.dropdownMenu}>
              <Link href={`/profile/${user?.username}`} className={styles.dropdownItem} onClick={() => setShowMenu(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Profile
              </Link>
              <Link href="/settings" className={styles.dropdownItem} onClick={() => setShowMenu(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Settings
              </Link>
              {user?.role === 'ADMIN' && (
                <Link href="/admin" className={styles.dropdownItem} onClick={() => setShowMenu(false)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Admin
                </Link>
              )}
              <button onClick={logout} className={`${styles.dropdownItem} ${styles.logoutBtn}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Log Out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Global Call Provider */}
      <CallProvider />

      {/* Global Watch Provider */}
      <WatchProvider>
        <main className={styles.mainContent}>
          {children}
        </main>
      </WatchProvider>

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
              <span className={styles.mobileIcon}>{item.icon}</span>
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
