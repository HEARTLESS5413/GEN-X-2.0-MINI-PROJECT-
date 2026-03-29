'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { adminAPI, UPLOADS_URL } from '@/lib/api';
import styles from './admin.module.css';

export default function AdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      router.replace('/feed');
      return;
    }
    loadData();
  }, [user, router]);

  const loadData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers(currentPage),
      ]);
      setStats(statsRes.data.stats);
      setRecentUsers(statsRes.data.recentUsers);
      setUsers(usersRes.data.users);
      setTotalPages(usersRes.data.pages);
    } catch {}
    finally { setLoading(false); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await adminAPI.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch {}
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className={styles.adminPage}>
      <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>🛡️ Admin Dashboard</h1>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>👥</span>
          <div>
            <strong className={styles.statNumber}>{stats?.users || 0}</strong>
            <span className={styles.statLabel}>Total Users</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>📸</span>
          <div>
            <strong className={styles.statNumber}>{stats?.posts || 0}</strong>
            <span className={styles.statLabel}>Total Posts</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>💬</span>
          <div>
            <strong className={styles.statNumber}>{stats?.messages || 0}</strong>
            <span className={styles.statLabel}>Messages</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>📞</span>
          <div>
            <strong className={styles.statNumber}>{stats?.activeCalls || 0}</strong>
            <span className={styles.statLabel}>Active Calls</span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>All Users</h2>
        <div className={styles.usersTable}>
          {users.map(u => (
            <div key={u.id} className={styles.userRow}>
              <div className={styles.userInfo}>
                {u.avatar ? (
                  <img src={`${UPLOADS_URL}${u.avatar}`} alt="" className="avatar avatar-sm" />
                ) : (
                  <div className={styles.avatarFallback}>{u.name[0]}</div>
                )}
                <div>
                  <span className={styles.userName}>{u.username}</span>
                  <span className={styles.userEmail}>{u.email}</span>
                </div>
              </div>
              <div className={styles.userMeta}>
                <span className={styles.roleBadge}>{u.role}</span>
                <span className={styles.userStat}>{u._count?.posts || 0} posts</span>
                <span className={`${styles.statusDot} ${u.isOnline ? styles.online : ''}`}></span>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id)}>Delete</button>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); loadData(); }} disabled={currentPage === 1}>← Prev</button>
            <span>Page {currentPage} of {totalPages}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => { setCurrentPage(p => p + 1); loadData(); }} disabled={currentPage >= totalPages}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
