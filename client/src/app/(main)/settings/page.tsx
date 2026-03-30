'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { usersAPI } from '@/lib/api';
import styles from './settings.module.css';

const themes = [
  { id: 'DARK', name: 'Dark', desc: 'Classic dark mode', colors: ['#0a0a0f', '#8B5CF6', '#EC4899'] },
  { id: 'NEON', name: 'Neon', desc: 'Electric neon vibes', colors: ['#050510', '#00FF88', '#00CCFF'] },
  { id: 'CYBERPUNK', name: 'Cyberpunk', desc: 'Futuristic cyber', colors: ['#0d0221', '#FF2A6D', '#05D9E8'] },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, updateUser, logout } = useAuthStore();
  const [activeTheme, setActiveTheme] = useState(user?.theme || 'DARK');
  const [accountType, setAccountType] = useState(user?.accountType || 'PUBLIC');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleThemeChange = async (theme: string) => {
    setActiveTheme(theme);
    try {
      await usersAPI.updateTheme(theme);
      updateUser({ theme });
      const themeMap: Record<string, string> = { DARK: '', NEON: 'neon', CYBERPUNK: 'cyberpunk' };
      document.documentElement.setAttribute('data-theme', themeMap[theme] || '');
    } catch {}
  };

  const handleAccountTypeChange = async (type: string) => {
    setAccountType(type);
    setSaving(true);
    try {
      await usersAPI.updateProfile({ accountType: type });
      updateUser({ accountType: type });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    finally { setSaving(false); }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') return;
    setDeleting(true);
    try {
      await usersAPI.deleteAccount();
      logout();
      router.push('/login');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete account.');
    }
    finally { setDeleting(false); }
  };

  return (
    <div className={styles.settingsPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#setGrad)" strokeWidth="2">
            <defs><linearGradient id="setGrad" x1="0" y1="0" x2="24" y2="24"><stop offset="0%" stopColor="#8B5CF6"/><stop offset="100%" stopColor="#EC4899"/></linearGradient></defs>
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </div>
        <div>
          <h1 className={styles.pageTitle}>Settings</h1>
          <p className={styles.pageSubtitle}>Customize your experience</p>
        </div>
      </div>

      {/* Theme Switcher */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <h2>Theme</h2>
        </div>
        <p className={styles.sectionDesc}>Choose your vibe</p>
        <div className={styles.themeGrid}>
          {themes.map(t => (
            <button
              key={t.id}
              className={`${styles.themeCard} ${activeTheme === t.id ? styles.themeActive : ''}`}
              onClick={() => handleThemeChange(t.id)}
            >
              <div className={styles.themePreview}>
                {t.colors.map((c, i) => (
                  <div key={i} className={styles.colorDot} style={{ background: c }}></div>
                ))}
              </div>
              <span className={styles.themeName}>{t.name}</span>
              <span className={styles.themeDesc}>{t.desc}</span>
              {activeTheme === t.id && (
                <span className={styles.activeLabel}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  Active
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Account Privacy */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <h2>Privacy</h2>
        </div>
        <p className={styles.sectionDesc}>Control who can see your content</p>
        <div className={styles.privacyOptions}>
          <button
            className={`${styles.privacyBtn} ${accountType === 'PUBLIC' ? styles.privacyActive : ''}`}
            onClick={() => handleAccountTypeChange('PUBLIC')}
          >
            <div className={styles.privacyIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            <div>
              <strong>Public</strong>
              <span>Everyone can see your posts</span>
            </div>
            {accountType === 'PUBLIC' && <div className={styles.checkMark}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>}
          </button>
          <button
            className={`${styles.privacyBtn} ${accountType === 'PRIVATE' ? styles.privacyActive : ''}`}
            onClick={() => handleAccountTypeChange('PRIVATE')}
          >
            <div className={styles.privacyIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div>
              <strong>Private</strong>
              <span>Only approved followers can see</span>
            </div>
            {accountType === 'PRIVATE' && <div className={styles.checkMark}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>}
          </button>
        </div>
        {saved && <p className={styles.savedMsg}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          Settings saved!
        </p>}
      </section>

      {/* Account Info */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <h2>Account</h2>
        </div>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Username</span>
            <span className={styles.infoValue}>@{user?.username}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Email</span>
            <span className={styles.infoValue}>{user?.email}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Gender</span>
            <span className={styles.infoValue}>{user?.gender}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Role</span>
            <span className={styles.infoValue}>{user?.role}</span>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className={`${styles.section} ${styles.dangerSection}`}>
        <div className={styles.sectionHeader}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <h2 style={{color: '#ef4444'}}>Danger Zone</h2>
        </div>

        <div className={styles.dangerActions}>
          <button className={styles.logoutBtnFull} onClick={logout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log Out
          </button>

          <button className={styles.deleteBtn} onClick={() => setShowDeleteConfirm(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            Delete Account Permanently
          </button>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowDeleteConfirm(false)}>
          <div className={styles.modalCard}>
            <div className={styles.modalDangerIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3 className={styles.modalTitle}>Delete Your Account?</h3>
            <p className={styles.modalDesc}>
              This action is <strong>permanent and irreversible</strong>. All your posts, messages, followers, and data will be permanently erased.
            </p>
            <div className={styles.modalInput}>
              <label>Type <strong>DELETE</strong> to confirm</label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="Type DELETE here"
                className={styles.deleteInputField}
              />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}>
                Cancel
              </button>
              <button
                className={styles.confirmDeleteBtn}
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'DELETE' || deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
