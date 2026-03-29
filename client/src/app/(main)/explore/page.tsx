'use client';
import { useEffect, useState } from 'react';
import { postsAPI, usersAPI, UPLOADS_URL } from '@/lib/api';
import Link from 'next/link';
import styles from './explore.module.css';

export default function ExplorePage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewPost, setViewPost] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'discover' | 'people'>('discover');

  useEffect(() => {
    loadExplore();
  }, []);

  const loadExplore = async () => {
    try {
      const [{ data: explorePosts }, { data: allUsers }] = await Promise.all([
        postsAPI.getExplore(),
        usersAPI.getSuggestions()
      ]);
      setPosts(explorePosts);
      setUsers(allUsers);
    } catch {}
    finally { setLoading(false); }
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      const { data } = await usersAPI.search(q);
      setSearchResults(data);
    } catch {}
  };

  const handleLike = async (postId: string) => {
    try {
      const { data } = await postsAPI.like(postId);
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p, isLiked: data.action === 'liked', _count: { ...p._count, likes: data.likesCount }
      } : p));
      if (viewPost?.id === postId) {
        setViewPost((p: any) => ({ ...p, isLiked: data.action === 'liked', _count: { ...p._count, likes: data.likesCount } }));
      }
    } catch {}
  };

  const handleFollow = async (userId: string) => {
    try {
      await usersAPI.follow(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch {}
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className={styles.explorePage}>
      <div className={styles.header}>
        <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800 }}>Explore</h1>
        <input
          className="input"
          placeholder="🔍 Search users..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className={styles.searchResults}>
          {searchResults.map(u => (
            <Link key={u.id} href={`/profile/${u.username}`} className={styles.searchItem}>
              {u.avatar ? (
                <img src={`${UPLOADS_URL}${u.avatar}`} alt="" className="avatar avatar-md" />
              ) : (
                <div className={styles.avatarFallback}>{u.name[0]}</div>
              )}
              <div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{u.username}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>{u.name}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === 'discover' ? styles.tabActive : ''}`} onClick={() => setActiveTab('discover')}>📷 Discover</button>
        <button className={`${styles.tab} ${activeTab === 'people' ? styles.tabActive : ''}`} onClick={() => setActiveTab('people')}>👥 People</button>
      </div>

      {activeTab === 'discover' ? (
        /* Posts Grid */
        <div className={styles.grid}>
          {posts.map((post, i) => (
            <div key={post.id} className={styles.gridItem} onClick={() => setViewPost(post)} style={{ animationDelay: `${i * 0.03}s` }}>
              {post.mediaUrl ? (
                post.mediaType === 'VIDEO' ? (
                  <video src={`${UPLOADS_URL}${post.mediaUrl}`} className={styles.gridMedia} muted />
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
          ))}
        </div>
      ) : (
        /* People */
        <div className={styles.peopleGrid}>
          {users.map(u => (
            <div key={u.id} className={styles.personCard}>
              {u.avatar ? (
                <img src={`${UPLOADS_URL}${u.avatar}`} alt="" className={styles.personAvatar} />
              ) : (
                <div className={styles.personAvatarFallback}>{u.name[0]}</div>
              )}
              <Link href={`/profile/${u.username}`} className={styles.personName}>{u.username}</Link>
              <span className={styles.personBio}>{u.name}</span>
              <button className="btn btn-primary btn-sm" onClick={() => handleFollow(u.id)} style={{ marginTop: 8 }}>Follow</button>
            </div>
          ))}
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
              <Link href={`/profile/${viewPost.user.username}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, textDecoration: 'none', color: 'inherit' }}>
                {viewPost.user.avatar ? (
                  <img src={`${UPLOADS_URL}${viewPost.user.avatar}`} alt="" className="avatar avatar-sm" />
                ) : (
                  <div className={styles.avatarFallbackSm}>{viewPost.user.name[0]}</div>
                )}
                <strong style={{ fontSize: 14 }}>@{viewPost.user.username}</strong>
              </Link>
              {viewPost.caption && <p style={{ fontSize: 14, marginBottom: 12 }}>{viewPost.caption}</p>}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <button onClick={() => handleLike(viewPost.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: viewPost.isLiked ? '#ef4444' : 'var(--text-secondary)' }}>
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
