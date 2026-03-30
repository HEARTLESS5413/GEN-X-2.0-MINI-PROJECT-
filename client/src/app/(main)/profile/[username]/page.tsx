'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { usersAPI, postsAPI, UPLOADS_URL } from '@/lib/api';
import Link from 'next/link';
import styles from './profile.module.css';

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { user: currentUser, updateUser } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', bio: '', username: '' });
  const [viewPost, setViewPost] = useState<any>(null);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const avatarRef = useRef<HTMLInputElement>(null);

  // Followers/Following modal state
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [listPrivate, setListPrivate] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [username]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: profileData } = await usersAPI.getProfile(username);
      setProfile(profileData);
      setEditForm({ name: profileData.name, bio: profileData.bio || '', username: profileData.username });
      const { data: userPosts } = await postsAPI.getUserPosts(profileData.id);
      setPosts(userPosts);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleFollow = async () => {
    if (!profile) return;
    try {
      const { data } = await usersAPI.follow(profile.id);
      setProfile((p: any) => ({
        ...p,
        isFollowing: data.action === 'followed',
        isPending: data.action === 'requested',
        _count: {
          ...p._count,
          followers: data.action === 'followed' ? p._count.followers + 1 :
            data.action === 'unfollowed' ? p._count.followers - 1 : p._count.followers
        }
      }));
    } catch {}
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const { data } = await usersAPI.uploadAvatar(formData);
      setProfile((p: any) => ({ ...p, avatar: data.avatar }));
      updateUser({ avatar: data.avatar });
    } catch {}
  };

  const handleSaveProfile = async () => {
    try {
      const { data } = await usersAPI.updateProfile(editForm);
      setProfile((p: any) => ({ ...p, ...data }));
      updateUser(data);
      setEditing(false);
    } catch {}
  };

  const handleLike = async (postId: string) => {
    try {
      const { data } = await postsAPI.like(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, isLiked: data.action === 'liked', _count: { ...p._count, likes: data.likesCount } } : p));
      if (viewPost?.id === postId) setViewPost((p: any) => ({ ...p, isLiked: data.action === 'liked', _count: { ...p._count, likes: data.likesCount } }));
    } catch {}
  };

  const loadSavedPosts = async () => {
    try {
      const { data } = await postsAPI.getSaved();
      setSavedPosts(data);
    } catch {}
  };

  const openFollowersModal = async () => {
    if (!profile) return;
    setShowFollowersModal(true);
    setListLoading(true);
    setListPrivate(false);
    try {
      const { data } = await usersAPI.getFollowers(profile.id);
      if (data.private) {
        setListPrivate(true);
        setFollowersList([]);
      } else {
        setFollowersList(data.users || []);
      }
    } catch {}
    finally { setListLoading(false); }
  };

  const openFollowingModal = async () => {
    if (!profile) return;
    setShowFollowingModal(true);
    setListLoading(true);
    setListPrivate(false);
    try {
      const { data } = await usersAPI.getFollowing(profile.id);
      if (data.private) {
        setListPrivate(true);
        setFollowingList([]);
      } else {
        setFollowingList(data.users || []);
      }
    } catch {}
    finally { setListLoading(false); }
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;
  if (!profile) return <div className={styles.notFound}><h2>User not found</h2></div>;

  const UserListModal = ({ title, users, isOpen, onClose }: { title: string; users: any[]; isOpen: boolean; onClose: () => void }) => {
    if (!isOpen) return null;
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className={styles.userListModal}>
          <div className={styles.modalHeader}>
            <h3>{title}</h3>
            <button className={styles.modalClose} onClick={onClose}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className={styles.modalBody}>
            {listLoading ? (
              <div className={styles.modalEmpty}><div className="spinner"></div></div>
            ) : listPrivate ? (
              <div className={styles.privateOverlay}>
                <div className={styles.privateIcon}>🔒</div>
                <h4>This account is private</h4>
                <p>Follow this account to see their {title.toLowerCase()}</p>
              </div>
            ) : users.length === 0 ? (
              <div className={styles.modalEmpty}>
                <p style={{ color: 'var(--text-muted)' }}>No {title.toLowerCase()} yet</p>
              </div>
            ) : (
              users.map(u => (
                <Link key={u.id} href={`/profile/${u.username}`} className={styles.userListItem} onClick={onClose}>
                  {u.avatar ? (
                    <img src={`${UPLOADS_URL}${u.avatar}`} alt="" className={styles.userListAvatar} />
                  ) : (
                    <div className={styles.userListAvatarFallback}>{u.name[0].toUpperCase()}</div>
                  )}
                  <div className={styles.userListInfo}>
                    <span className={styles.userListName}>{u.name}</span>
                    <span className={styles.userListUsername}>@{u.username}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.profilePage}>
      {/* Profile Header section */}
      <div className={styles.profileHeader}>
        <div className={styles.headerContent}>
          {/* Avatar Area */}
          <div className={styles.avatarSection}>
            <div className={styles.avatarWrapper} onClick={() => profile.isOwnProfile && avatarRef.current?.click()}>
              {profile.avatar ? (
                <img src={`${UPLOADS_URL}${profile.avatar}`} alt="" className={styles.profileAvatar} />
              ) : (
                <div className={styles.avatarLarge}>{profile.name[0].toUpperCase()}</div>
              )}
              {profile.isOwnProfile && (
                <div className={styles.avatarOverlay}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </div>
              )}
              <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarUpload} hidden />
              {profile.isOnline && <div className={styles.onlineBadge}></div>}
            </div>
          </div>

          {/* Info & Stats */}
          <div className={styles.profileInfo}>
            <div className={styles.nameRow}>
              <span className={styles.usernameTag}>{profile.username}</span>
              {profile.accountType === 'PRIVATE' && <span className={styles.privateBadge} title="Private Account">🔒</span>}
              {profile.isOwnProfile ? (
                 <button className={styles.btnGhost} style={{ padding: '6px 14px', marginLeft: 16 }} onClick={() => setEditing(true)}>
                   Edit profile
                 </button>
              ) : (
                <div style={{ marginLeft: 16, display: 'flex', gap: 8 }}>
                  <button
                    className={profile.isFollowing || profile.isPending ? styles.btnGhost : styles.btnPrimary}
                    onClick={handleFollow}
                    style={{ padding: '6px 14px' }}
                  >
                    {profile.isFollowing ? 'Following' : profile.isPending ? 'Requested' : 'Follow'}
                  </button>
                  <Link href={`/messages/${profile.id}`} className={styles.btnGhost} style={{ padding: '6px 14px' }}>
                    Message
                  </Link>
                </div>
              )}
            </div>

            <div className={styles.stats}>
              <div className={styles.stat}>
                <strong>{profile._count.posts}</strong><span>posts</span>
              </div>
              <div className={`${styles.stat} ${styles.statClickable}`} onClick={openFollowersModal}>
                <strong>{profile._count.followers}</strong><span>followers</span>
              </div>
              <div className={`${styles.stat} ${styles.statClickable}`} onClick={openFollowingModal}>
                <strong>{profile._count.following}</strong><span>following</span>
              </div>
            </div>

            <h1 className={styles.displayName}>{profile.name}</h1>
            {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
          </div>
        </div>
      </div>

      {/* Futuristic Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === 'posts' ? styles.tabActive : ''}`} onClick={() => setActiveTab('posts')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          Posts
        </button>
        <button className={`${styles.tab} ${activeTab === 'saved' ? styles.tabActive : ''}`} onClick={() => { setActiveTab('saved'); if (profile.isOwnProfile && savedPosts.length === 0) loadSavedPosts(); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          Saved
        </button>
      </div>

      {/* Grid Area */}
      <div className={styles.postsGrid}>
        {(activeTab === 'posts' ? posts : savedPosts).length === 0 ? (
          <div className={styles.emptyGrid}>
            <p>{activeTab === 'posts' ? 'No posts yet' : 'No saved posts'}</p>
          </div>
        ) : (
          (activeTab === 'posts' ? posts : savedPosts).map(post => (
            <div key={post.id} className={styles.gridItem} onClick={() => setViewPost(post)}>
              {post.mediaUrl ? (
                post.mediaType === 'VIDEO' ? (
                  <video src={`${UPLOADS_URL}${post.mediaUrl}`} className={styles.gridMedia} />
                ) : (
                  <img src={`${UPLOADS_URL}${post.mediaUrl}`} alt="" className={styles.gridMedia} loading="lazy" />
                )
              ) : (
                <div className={styles.textPost}><p>{post.caption}</p></div>
              )}
              <div className={styles.gridOverlay}>
                <span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  {post._count.likes}
                </span>
                <span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  {post._count.comments}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Profile Modal (Futuristic Standard) */}
      {editing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditing(false)}>
          <div className="modal-content" style={{ padding: 32, borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 className="gradient-text" style={{ fontSize: 22, margin: '0 0 24px', fontWeight: 800 }}>Edit Profile</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-group">
                <label className="input-label">Display Name</label>
                <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">Username</label>
                <input className="input" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">Bio Details</label>
                <textarea className="input" rows={3} value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} style={{ resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                <button className={styles.btnGhost} onClick={() => setEditing(false)} style={{ padding: '10px 20px' }}>Cancel</button>
                <button className={styles.btnPrimary} onClick={handleSaveProfile} style={{ padding: '10px 24px' }}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Post Modal (Polished) */}
      {viewPost && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setViewPost(null)}>
          <div className="modal-content" style={{ maxWidth: 600, padding: 0, overflow: 'hidden', borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ position: 'relative', background: '#050505' }}>
              {viewPost.mediaUrl && (
                viewPost.mediaType === 'VIDEO' ? (
                  <video src={`${UPLOADS_URL}${viewPost.mediaUrl}`} controls style={{ width: '100%', maxHeight: 450, display: 'block' }} />
                ) : (
                  <img src={`${UPLOADS_URL}${viewPost.mediaUrl}`} alt="" style={{ width: '100%', maxHeight: 450, objectFit: 'contain', display: 'block' }} />
                )
              )}
            </div>
            <div style={{ padding: '24px', background: 'var(--bg-card)' }}>
              {viewPost.caption && <p style={{ marginBottom: 16, fontSize: 15, lineHeight: 1.5 }}>{viewPost.caption}</p>}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <button 
                  onClick={() => handleLike(viewPost.id)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', 
                    color: viewPost.isLiked ? '#ec4899' : 'var(--text-primary)', cursor: 'pointer', fontSize: 15, fontWeight: 700 
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={viewPost.isLiked ? '#ec4899' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  {viewPost._count.likes}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  {viewPost._count.comments}
                </div>
                <button className={styles.btnGhost} onClick={() => setViewPost(null)} style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 13 }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Followers Modal */}
      <UserListModal
        title="Followers"
        users={followersList}
        isOpen={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
      />

      {/* Following Modal */}
      <UserListModal
        title="Following"
        users={followingList}
        isOpen={showFollowingModal}
        onClose={() => setShowFollowingModal(false)}
      />
    </div>
  );
}
