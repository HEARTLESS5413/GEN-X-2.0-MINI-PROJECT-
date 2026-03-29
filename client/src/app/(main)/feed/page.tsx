'use client';
import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { postsAPI, usersAPI, UPLOADS_URL } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import Link from 'next/link';
import StoriesBar from '@/components/StoriesBar';
import styles from './feed.module.css';

interface Post {
  id: string;
  caption: string;
  mediaUrl: string | null;
  mediaType: string | null;
  createdAt: string;
  isLiked: boolean;
  isSaved: boolean;
  user: { id: string; username: string; name: string; avatar: string | null };
  _count: { likes: number; comments: number };
}

interface Suggestion {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
  bio: string | null;
}

export default function FeedPage() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [caption, setCaption] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const [postComments, setPostComments] = useState<Record<string, any[]>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFeed();
    loadSuggestions();
    setupRealtime();
  }, []);

  const setupRealtime = () => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('newPost', (post: Post) => {
      if (post.user.id !== user?.id) {
        setPosts(prev => [{ ...post, isLiked: false, isSaved: false }, ...prev]);
      }
    });
    socket.on('postLikeUpdate', ({ postId, likesCount, action, userId }: any) => {
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        _count: { ...p._count, likes: likesCount },
        isLiked: userId === user?.id ? action === 'liked' : p.isLiked
      } : p));
    });
    socket.on('newComment', ({ postId, commentsCount }: any) => {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, _count: { ...p._count, comments: commentsCount } } : p));
    });
    socket.on('postDeleted', ({ postId }: any) => {
      setPosts(prev => prev.filter(p => p.id !== postId));
    });
    return () => {
      socket.off('newPost');
      socket.off('postLikeUpdate');
      socket.off('newComment');
      socket.off('postDeleted');
    };
  };

  const loadFeed = async () => {
    try {
      const { data } = await postsAPI.getFeed();
      setPosts(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadSuggestions = async () => {
    try {
      const { data } = await usersAPI.getSuggestions();
      setSuggestions(data.slice(0, 5));
    } catch {}
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleCreatePost = async () => {
    if (!caption.trim() && !mediaFile) return;
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('caption', caption);
      if (mediaFile) formData.append('media', mediaFile);
      const { data } = await postsAPI.create(formData);
      setPosts(prev => [data, ...prev]);
      setCaption('');
      setMediaFile(null);
      setMediaPreview(null);
      setShowCreate(false);
    } catch (err) { console.error(err); }
    finally { setPosting(false); }
  };

  const handleLike = async (postId: string) => {
    try {
      const { data } = await postsAPI.like(postId);
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p, isLiked: data.action === 'liked',
        _count: { ...p._count, likes: data.likesCount }
      } : p));
    } catch {}
  };

  const handleSave = async (postId: string) => {
    try {
      const { data } = await postsAPI.save(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, isSaved: data.action === 'saved' } : p));
    } catch {}
  };

  const handleComment = async (postId: string) => {
    const text = commentText[postId]?.trim();
    if (!text) return;
    try {
      const { data } = await postsAPI.comment(postId, text);
      setPostComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), data] }));
      setCommentText(prev => ({ ...prev, [postId]: '' }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, _count: { ...p._count, comments: p._count.comments + 1 } } : p));
    } catch {}
  };

  const loadComments = async (postId: string) => {
    if (showComments[postId]) {
      setShowComments(prev => ({ ...prev, [postId]: false }));
      return;
    }
    try {
      const { data } = await postsAPI.getPost(postId);
      setPostComments(prev => ({ ...prev, [postId]: data.comments || [] }));
      setShowComments(prev => ({ ...prev, [postId]: true }));
    } catch {}
  };

  const timeAgo = (date: string) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  };

  const handleFollow = async (userId: string) => {
    try {
      await usersAPI.follow(userId);
      setSuggestions(prev => prev.filter(s => s.id !== userId));
    } catch {}
  };

  return (
    <div className={styles.feedPage}>
      <div className={styles.feedColumn}>
        {/* Stories */}
        <StoriesBar />

        {/* Create Post */}
        <div className={styles.createSection} onClick={() => setShowCreate(true)}>
          <div className={styles.createAvatar}>
            {user?.avatar ? (
              <img src={`${UPLOADS_URL}${user.avatar}`} alt="" className="avatar avatar-md" />
            ) : (
              <div className={styles.avatarFallback}>{user?.name?.[0]}</div>
            )}
          </div>
          <span className={styles.createPlaceholder}>What's on your mind, {user?.name?.split(' ')[0]}?</span>
          <button className="btn btn-primary btn-sm">Post</button>
        </div>

        {/* Create Post Modal */}
        {showCreate && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
            <div className="modal-content" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 className="gradient-text" style={{ fontSize: 20, fontWeight: 700 }}>Create Post</h3>
                <button onClick={() => setShowCreate(false)} className="btn btn-ghost btn-icon">✕</button>
              </div>
              <textarea
                className="input"
                placeholder="Share something awesome..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                style={{ resize: 'none', marginBottom: 12 }}
              />
              {mediaPreview && (
                <div className={styles.mediaPreview}>
                  {mediaFile?.type.startsWith('video') ? (
                    <video src={mediaPreview} controls style={{ maxHeight: 300, borderRadius: 12, width: '100%' }} />
                  ) : (
                    <img src={mediaPreview} alt="" style={{ maxHeight: 300, borderRadius: 12, width: '100%', objectFit: 'cover' }} />
                  )}
                  <button className={styles.removeMedia} onClick={() => { setMediaFile(null); setMediaPreview(null); }}>✕</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleMediaSelect} hidden />
                  <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>📷 Media</button>
                </div>
                <button className="btn btn-primary" onClick={handleCreatePost} disabled={posting || (!caption.trim() && !mediaFile)}>
                  {posting ? 'Posting...' : '✨ Post'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Posts */}
        {loading ? (
          <div className="page-loading"><div className="spinner"></div></div>
        ) : posts.length === 0 ? (
          <div className={styles.emptyState}>
            <div style={{ fontSize: 48 }}>🌟</div>
            <h3>No Posts Yet</h3>
            <p>Be the first to share something!</p>
          </div>
        ) : (
          posts.map((post, i) => (
            <div key={post.id} className={styles.postCard} style={{ animationDelay: `${i * 0.05}s` }}>
              {/* Post Header */}
              <div className={styles.postHeader}>
                <Link href={`/profile/${post.user.username}`} className={styles.postUser}>
                  {post.user.avatar ? (
                    <img src={`${UPLOADS_URL}${post.user.avatar}`} alt="" className="avatar avatar-md avatar-gradient" />
                  ) : (
                    <div className={styles.avatarFallback}>{post.user.name[0]}</div>
                  )}
                  <div>
                    <span className={styles.postUsername}>{post.user.username}</span>
                    <span className={styles.postTime}>{timeAgo(post.createdAt)}</span>
                  </div>
                </Link>
                {post.user.id === user?.id && (
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={async () => {
                    if (confirm('Delete this post?')) {
                      await postsAPI.delete(post.id);
                      setPosts(prev => prev.filter(p => p.id !== post.id));
                    }
                  }}>🗑️</button>
                )}
              </div>

              {/* Caption */}
              {post.caption && <p className={styles.postCaption}>{post.caption}</p>}

              {/* Media */}
              {post.mediaUrl && (
                <div className={styles.postMedia}>
                  {post.mediaType === 'VIDEO' ? (
                    <video src={`${UPLOADS_URL}${post.mediaUrl}`} controls className={styles.mediaContent} />
                  ) : (
                    <img src={`${UPLOADS_URL}${post.mediaUrl}`} alt="" className={styles.mediaContent} loading="lazy" />
                  )}
                </div>
              )}

              {/* Actions */}
              <div className={styles.postActions}>
                <div className={styles.actionGroup}>
                  <button className={`${styles.actionBtn} ${post.isLiked ? styles.liked : ''}`} onClick={() => handleLike(post.id)}>
                    {post.isLiked ? '❤️' : '🤍'} <span>{post._count.likes}</span>
                  </button>
                  <button className={styles.actionBtn} onClick={() => loadComments(post.id)}>
                    💬 <span>{post._count.comments}</span>
                  </button>
                  <button className={styles.actionBtn} onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/profile/${post.user.username}`);
                    alert('Link copied!');
                  }}>↗️</button>
                </div>
                <button className={`${styles.actionBtn} ${post.isSaved ? styles.saved : ''}`} onClick={() => handleSave(post.id)}>
                  {post.isSaved ? '🔖' : '📑'}
                </button>
              </div>

              {/* Comments Section */}
              {showComments[post.id] && (
                <div className={styles.commentsSection}>
                  {(postComments[post.id] || []).map((c: any) => (
                    <div key={c.id} className={styles.comment}>
                      <Link href={`/profile/${c.user.username}`} className={styles.commentUser}>
                        <strong>@{c.user.username}</strong>
                      </Link>
                      <span>{c.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Comment */}
              <div className={styles.addComment}>
                <input
                  className="input"
                  placeholder="Add a comment..."
                  value={commentText[post.id] || ''}
                  onChange={(e) => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleComment(post.id)}
                  style={{ fontSize: 13 }}
                />
                <button className="btn btn-ghost btn-sm" onClick={() => handleComment(post.id)} disabled={!commentText[post.id]?.trim()}>
                  Send
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Right Panel - Suggestions */}
      <div className={styles.rightPanel}>
        <div className={styles.suggestionsCard}>
          <h3 className={styles.suggestionsTitle}>Suggested For You</h3>
          {suggestions.map(s => (
            <div key={s.id} className={styles.suggestionItem}>
              <Link href={`/profile/${s.username}`} className={styles.suggestionUser}>
                {s.avatar ? (
                  <img src={`${UPLOADS_URL}${s.avatar}`} alt="" className="avatar avatar-md" />
                ) : (
                  <div className={styles.avatarFallback}>{s.name[0]}</div>
                )}
                <div>
                  <span className={styles.suggestionName}>{s.username}</span>
                  <span className={styles.suggestionBio}>{s.name}</span>
                </div>
              </Link>
              <button className="btn btn-primary btn-sm" onClick={() => handleFollow(s.id)}>Follow</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
