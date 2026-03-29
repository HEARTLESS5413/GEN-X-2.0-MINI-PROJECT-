'use client';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usersAPI } from '@/lib/api';
import styles from './settings.module.css';

const themes = [
  { id: 'DARK', name: 'Dark', desc: 'Classic dark mode', colors: ['#0a0a0f', '#8B5CF6', '#EC4899'] },
  { id: 'NEON', name: 'Neon', desc: 'Electric neon vibes', colors: ['#050510', '#00FF88', '#00CCFF'] },
  { id: 'CYBERPUNK', name: 'Cyberpunk', desc: 'Futuristic cyber', colors: ['#0d0221', '#FF2A6D', '#05D9E8'] },
];

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuthStore();
  const [activeTheme, setActiveTheme] = useState(user?.theme || 'DARK');
  const [accountType, setAccountType] = useState(user?.accountType || 'PUBLIC');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleThemeChange = async (theme: string) => {
    setActiveTheme(theme);
    try {
      await usersAPI.updateTheme(theme);
      updateUser({ theme });
      // Apply theme to DOM
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

  return (
    <div className={styles.settingsPage}>
      <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800, marginBottom: 28 }}>Settings</h1>

      {/* Theme Switcher */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🎨 Theme</h2>
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
              {activeTheme === t.id && <span className={styles.activeLabel}>✓ Active</span>}
            </button>
          ))}
        </div>
      </section>

      {/* Account Privacy */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🔒 Privacy</h2>
        <p className={styles.sectionDesc}>Control who can see your content</p>
        <div className={styles.privacyOptions}>
          <button
            className={`${styles.privacyBtn} ${accountType === 'PUBLIC' ? styles.privacyActive : ''}`}
            onClick={() => handleAccountTypeChange('PUBLIC')}
          >
            <span className={styles.privacyIcon}>🌍</span>
            <div>
              <strong>Public</strong>
              <span>Everyone can see your posts</span>
            </div>
          </button>
          <button
            className={`${styles.privacyBtn} ${accountType === 'PRIVATE' ? styles.privacyActive : ''}`}
            onClick={() => handleAccountTypeChange('PRIVATE')}
          >
            <span className={styles.privacyIcon}>🔐</span>
            <div>
              <strong>Private</strong>
              <span>Only approved followers can see</span>
            </div>
          </button>
        </div>
        {saved && <p className={styles.savedMsg}>✅ Settings saved!</p>}
      </section>

      {/* Account Info */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>👤 Account</h2>
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
      <section className={styles.section}>
        <h2 className={styles.sectionTitle} style={{ color: 'var(--accent-danger)' }}>⚠️ Danger Zone</h2>
        <button className="btn btn-danger" onClick={logout}>🚪 Log Out</button>
      </section>
    </div>
  );
}
