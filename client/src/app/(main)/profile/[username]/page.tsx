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

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;
  if (!profile) return <div className={styles.notFound}><h2>User not found</h2></div>;

  return (
    <div className={styles.profilePage}>
      {/* Profile Header */}
      <div className={styles.profileHeader}>
        <div className={styles.headerBg}></div>
        <div className={styles.headerContent}>
          <div className={styles.avatarSection}>
            <div className={styles.avatarWrapper} onClick={() => profile.isOwnProfile && avatarRef.current?.click()}>
              {profile.avatar ? (
                <img src={`${UPLOADS_URL}${profile.avatar}`} alt="" className={styles.profileAvatar} />
              ) : (
                <div className={styles.avatarLarge}>{profile.name[0]}</div>
              )}
              {profile.isOwnProfile && <div className={styles.avatarOverlay}>📷</div>}
              <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarUpload} hidden />
              {profile.isOnline && <div className={styles.onlineBadge}></div>}
            </div>
          </div>

          <div className={styles.profileInfo}>
            <div className={styles.nameRow}>
              <h1 className={styles.displayName}>{profile.name}</h1>
              <span className={styles.usernameTag}>@{profile.username}</span>
            </div>
            {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
            <div className={styles.stats}>
              <div className={styles.stat}><strong>{profile._count.posts}</strong><span>Posts</span></div>
              <div className={styles.stat}><strong>{profile._count.followers}</strong><span>Followers</span></div>
              <div className={styles.stat}><strong>{profile._count.following}</strong><span>Following</span></div>
            </div>

            <div className={styles.actionBtns}>
              {profile.isOwnProfile ? (
                <button className="btn btn-secondary" onClick={() => setEditing(true)}>✏️ Edit Profile</button>
              ) : (
                <>
                  <button
                    className={`btn ${profile.isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={handleFollow}
                  >
                    {profile.isFollowing ? 'Following' : profile.isPending ? 'Requested' : 'Follow'}
                  </button>
                  <Link href={`/messages/${profile.id}`} className="btn btn-secondary">💬 Message</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === 'posts' ? styles.tabActive : ''}`} onClick={() => setActiveTab('posts')}>📷 Posts</button>
        <button className={`${styles.tab} ${activeTab === 'saved' ? styles.tabActive : ''}`} onClick={() => { setActiveTab('saved'); if (profile.isOwnProfile && savedPosts.length === 0) loadSavedPosts(); }}>🔖 Saved</button>
      </div>

      {/* Posts Grid */}
      <div className={styles.postsGrid}>
        {(activeTab === 'posts' ? posts : savedPosts).length === 0 ? (
          <div className={styles.emptyGrid}><p>{activeTab === 'posts' ? 'No posts yet' : 'No saved posts'}</p></div>
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
                <span>❤️ {post._count.likes}</span>
                <span>💬 {post._count.comments}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Profile Modal */}
      {editing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditing(false)}>
          <div className="modal-content" style={{ padding: 28 }}>
            <h3 className="gradient-text" style={{ fontSize: 20, marginBottom: 20 }}>Edit Profile</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">Name</label>
                <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">Username</label>
                <input className="input" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">Bio</label>
                <textarea className="input" rows={3} value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} style={{ resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveProfile}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Post Modal */}
      {viewPost && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setViewPost(null)}>
          <div className="modal-content" style={{ maxWidth: 560, padding: 0, overflow: 'hidden' }}>
            {viewPost.mediaUrl && (
              viewPost.mediaType === 'VIDEO' ? (
                <video src={`${UPLOADS_URL}${viewPost.mediaUrl}`} controls style={{ width: '100%', maxHeight: 400 }} />
              ) : (
                <img src={`${UPLOADS_URL}${viewPost.mediaUrl}`} alt="" style={{ width: '100%', maxHeight: 400, objectFit: 'contain', background: '#000' }} />
              )
            )}
            <div style={{ padding: 16 }}>
              {viewPost.caption && <p style={{ marginBottom: 12, fontSize: 14 }}>{viewPost.caption}</p>}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <button className={`${styles.actionBtn} ${viewPost.isLiked ? styles.liked : ''}`} onClick={() => handleLike(viewPost.id)}>
                  {viewPost.isLiked ? '❤️' : '🤍'} {viewPost._count.likes}
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>💬 {viewPost._count.comments}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewPost(null)} style={{ marginLeft: 'auto' }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
