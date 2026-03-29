'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { storiesAPI, UPLOADS_URL } from '@/lib/api';
import styles from './stories.module.css';

interface StoryUser {
  user: { id: string; username: string; name: string; avatar: string | null };
  stories: any[];
  hasUnviewed: boolean;
}

export default function StoriesBar() {
  const { user } = useAuthStore();
  const [storyUsers, setStoryUsers] = useState<StoryUser[]>([]);
  const [activeViewer, setActiveViewer] = useState<{ userIndex: number; storyIndex: number } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    try {
      const { data } = await storiesAPI.getFeed();
      setStoryUsers(data);
    } catch {}
  };

  const handleCreateStory = async (file: File) => {
    setCreating(true);
    try {
      const formData = new FormData();
      formData.append('media', file);
      await storiesAPI.create(formData);
      await loadStories();
      setShowCreate(false);
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const openViewer = (userIndex: number) => {
    setActiveViewer({ userIndex, storyIndex: 0 });
    startTimer();
  };

  const startTimer = () => {
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
    const start = Date.now();
    const duration = 5000; // 5 seconds per story
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timerRef.current);
        nextStory();
      }
    }, 50);
  };

  const nextStory = () => {
    if (!activeViewer) return;
    const currentUser = storyUsers[activeViewer.userIndex];
    if (activeViewer.storyIndex < currentUser.stories.length - 1) {
      const nextIdx = activeViewer.storyIndex + 1;
      setActiveViewer({ ...activeViewer, storyIndex: nextIdx });
      markViewed(currentUser.stories[nextIdx].id);
      startTimer();
    } else if (activeViewer.userIndex < storyUsers.length - 1) {
      const nextUserIdx = activeViewer.userIndex + 1;
      setActiveViewer({ userIndex: nextUserIdx, storyIndex: 0 });
      markViewed(storyUsers[nextUserIdx].stories[0].id);
      startTimer();
    } else {
      closeViewer();
    }
  };

  const prevStory = () => {
    if (!activeViewer) return;
    if (activeViewer.storyIndex > 0) {
      setActiveViewer({ ...activeViewer, storyIndex: activeViewer.storyIndex - 1 });
      startTimer();
    } else if (activeViewer.userIndex > 0) {
      const prevUserIdx = activeViewer.userIndex - 1;
      const prevUser = storyUsers[prevUserIdx];
      setActiveViewer({ userIndex: prevUserIdx, storyIndex: prevUser.stories.length - 1 });
      startTimer();
    }
  };

  const closeViewer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveViewer(null);
    setProgress(0);
  };

  const markViewed = async (storyId: string) => {
    try { await storiesAPI.view(storyId); } catch {}
  };

  useEffect(() => {
    if (activeViewer) {
      const story = storyUsers[activeViewer.userIndex]?.stories[activeViewer.storyIndex];
      if (story) markViewed(story.id);
    }
  }, [activeViewer]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const currentStoryUser = activeViewer ? storyUsers[activeViewer.userIndex] : null;
  const currentStory = currentStoryUser?.stories[activeViewer?.storyIndex || 0];

  return (
    <>
      {/* Stories Bar */}
      <div className={styles.storiesBar}>
        <div className={styles.storiesScroll}>
          {/* Add Story Button */}
          <button className={styles.storyItem} onClick={() => fileInputRef.current?.click()}>
            <div className={`${styles.storyRing} ${styles.addRing}`}>
              {user?.avatar ? (
                <img src={`${UPLOADS_URL}${user.avatar}`} alt="" className={styles.storyAvatar} />
              ) : (
                <div className={styles.storyAvatarFallback}>{user?.name?.[0]}</div>
              )}
              <span className={styles.addIcon}>+</span>
            </div>
            <span className={styles.storyName}>Your Story</span>
          </button>

          {/* Story Users */}
          {storyUsers.map((su, idx) => (
            <button key={su.user.id} className={styles.storyItem} onClick={() => openViewer(idx)}>
              <div className={`${styles.storyRing} ${su.hasUnviewed ? styles.unviewedRing : styles.viewedRing}`}>
                {su.user.avatar ? (
                  <img src={`${UPLOADS_URL}${su.user.avatar}`} alt="" className={styles.storyAvatar} />
                ) : (
                  <div className={styles.storyAvatarFallback}>{su.user.name[0]}</div>
                )}
              </div>
              <span className={styles.storyName}>{su.user.id === user?.id ? 'You' : su.user.username}</span>
            </button>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleCreateStory(file);
            e.target.value = '';
          }}
        />
      </div>

      {/* Full-Screen Story Viewer */}
      {activeViewer && currentStory && (
        <div className={styles.viewer} onClick={closeViewer}>
          <div className={styles.viewerContent} onClick={(e) => e.stopPropagation()}>
            {/* Progress Bars */}
            <div className={styles.progressBars}>
              {currentStoryUser?.stories.map((_, idx) => (
                <div key={idx} className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: idx < (activeViewer?.storyIndex || 0) ? '100%'
                        : idx === activeViewer?.storyIndex ? `${progress}%`
                        : '0%'
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className={styles.viewerHeader}>
              {currentStoryUser?.user.avatar ? (
                <img src={`${UPLOADS_URL}${currentStoryUser.user.avatar}`} alt="" className={styles.viewerAvatar} />
              ) : (
                <div className={styles.viewerAvatarFallback}>{currentStoryUser?.user.name[0]}</div>
              )}
              <div>
                <strong>{currentStoryUser?.user.username}</strong>
                <span className={styles.viewerTime}>
                  {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <button className={styles.closeBtn} onClick={closeViewer}>✕</button>
            </div>

            {/* Story Media */}
            <div className={styles.viewerMedia}>
              {currentStory.mediaType === 'VIDEO' ? (
                <video src={`${UPLOADS_URL}${currentStory.mediaUrl}`} className={styles.mediaContent} autoPlay muted />
              ) : (
                <img src={`${UPLOADS_URL}${currentStory.mediaUrl}`} alt="" className={styles.mediaContent} />
              )}
              {currentStory.caption && (
                <div className={styles.captionOverlay}>{currentStory.caption}</div>
              )}
            </div>

            {/* Navigation Tap Areas */}
            <div className={styles.tapAreas}>
              <div className={styles.tapLeft} onClick={prevStory}></div>
              <div className={styles.tapRight} onClick={nextStory}></div>
            </div>

            {/* View Count */}
            {currentStoryUser?.user.id === user?.id && (
              <div className={styles.viewCount}>
                👁️ {currentStory._count?.views || 0} views
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
