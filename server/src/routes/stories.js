const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const { uploadStoryMedia } = require('../middleware/upload');

const router = express.Router();
const prisma = new PrismaClient();

// Get stories feed (users who have active stories)
router.get('/feed', auth, async (req, res) => {
  try {
    const now = new Date();

    // Get users that the current user follows + own stories
    const following = await prisma.follow.findMany({
      where: { followerId: req.user.id, status: 'ACCEPTED' },
      select: { followingId: true }
    });
    const userIds = [req.user.id, ...following.map(f => f.followingId)];

    const stories = await prisma.story.findMany({
      where: {
        userId: { in: userIds },
        expiresAt: { gt: now },
      },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
        views: { where: { userId: req.user.id }, select: { id: true } },
        _count: { select: { views: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group stories by user
    const grouped = {};
    stories.forEach(story => {
      if (!grouped[story.userId]) {
        grouped[story.userId] = {
          user: story.user,
          stories: [],
          hasUnviewed: false,
        };
      }
      const viewed = story.views.length > 0;
      if (!viewed) grouped[story.userId].hasUnviewed = true;
      grouped[story.userId].stories.push({
        ...story,
        isViewed: viewed,
        views: undefined,
      });
    });

    // Sort: own stories first, then unviewed, then viewed
    const sorted = Object.values(grouped).sort((a, b) => {
      if (a.user.id === req.user.id) return -1;
      if (b.user.id === req.user.id) return 1;
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return 0;
    });

    res.json(sorted);
  } catch (error) {
    console.error('Stories feed error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Create story
router.post('/', auth, uploadStoryMedia, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Media is required for a story.' });
    }

    const { caption } = req.body;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const story = await prisma.story.create({
      data: {
        userId: req.user.id,
        mediaUrl: `/uploads/stories/${req.file.filename}`,
        mediaType: req.file.mimetype.startsWith('video') ? 'VIDEO' : 'IMAGE',
        caption: caption || null,
        expiresAt,
      },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
        _count: { select: { views: true } },
      }
    });

    // Emit real-time story event
    const io = req.app.get('io');
    io.emit('newStory', { userId: req.user.id, story });

    res.status(201).json(story);
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// View a story
router.post('/:storyId/view', auth, async (req, res) => {
  try {
    const story = await prisma.story.findUnique({ where: { id: req.params.storyId } });
    if (!story) return res.status(404).json({ error: 'Story not found.' });

    // Don't count own views
    if (story.userId !== req.user.id) {
      await prisma.storyView.upsert({
        where: { storyId_userId: { storyId: req.params.storyId, userId: req.user.id } },
        update: {},
        create: { storyId: req.params.storyId, userId: req.user.id },
      });
    }

    res.json({ viewed: true });
  } catch (error) {
    console.error('View story error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get story viewers
router.get('/:storyId/viewers', auth, async (req, res) => {
  try {
    const story = await prisma.story.findUnique({ where: { id: req.params.storyId } });
    if (!story || story.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    const viewers = await prisma.storyView.findMany({
      where: { storyId: req.params.storyId },
      include: { user: { select: { id: true, username: true, name: true, avatar: true } } },
      orderBy: { viewedAt: 'desc' },
    });

    res.json(viewers.map(v => ({ ...v.user, viewedAt: v.viewedAt })));
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Delete story
router.delete('/:storyId', auth, async (req, res) => {
  try {
    const story = await prisma.story.findUnique({ where: { id: req.params.storyId } });
    if (!story) return res.status(404).json({ error: 'Story not found.' });
    if (story.userId !== req.user.id) return res.status(403).json({ error: 'Not authorized.' });

    await prisma.story.delete({ where: { id: req.params.storyId } });
    res.json({ message: 'Story deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
