const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');

const router = express.Router();
const prisma = new PrismaClient();

// Get user profile by username
router.get('/profile/:username', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        id: true, username: true, name: true, gender: true,
        avatar: true, bio: true, accountType: true, createdAt: true, isOnline: true, lastSeen: true,
        _count: { select: { posts: true, followers: { where: { status: 'ACCEPTED' } }, following: { where: { status: 'ACCEPTED' } } } },
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if current user follows this profile
    const followRecord = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.user.id, followingId: user.id } }
    });

    const isFollowing = followRecord?.status === 'ACCEPTED';
    const isPending = followRecord?.status === 'PENDING';
    const isOwnProfile = req.user.id === user.id;

    res.json({ ...user, isFollowing, isPending, isOwnProfile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Update profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, bio, username, accountType } = req.body;
    const data = {};

    if (name) data.name = name;
    if (bio !== undefined) data.bio = bio;
    if (accountType) data.accountType = accountType;
    if (username) {
      const existing = await prisma.user.findFirst({
        where: { username: username.toLowerCase(), NOT: { id: req.user.id } }
      });
      if (existing) return res.status(400).json({ error: 'Username already taken.' });
      data.username = username.toLowerCase();
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true, username: true, email: true, name: true,
        avatar: true, bio: true, role: true, accountType: true, theme: true,
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Upload avatar
router.post('/avatar', auth, uploadAvatar, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: avatarUrl },
      select: { id: true, avatar: true }
    });

    res.json(user);
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Follow/Unfollow user
router.post('/follow/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot follow yourself.' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });

    const existingFollow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.user.id, followingId: userId } }
    });

    if (existingFollow) {
      // Unfollow
      await prisma.follow.delete({ where: { id: existingFollow.id } });
      return res.json({ action: 'unfollowed' });
    }

    // Follow
    const status = targetUser.accountType === 'PRIVATE' ? 'PENDING' : 'ACCEPTED';
    await prisma.follow.create({
      data: { followerId: req.user.id, followingId: userId, status }
    });

    // Create notification
    const io = req.app.get('io');
    const notification = await prisma.notification.create({
      data: {
        userId: userId,
        senderId: req.user.id,
        type: status === 'PENDING' ? 'FOLLOW_REQUEST' : 'FOLLOW_ACCEPT',
        content: status === 'PENDING' 
          ? `${req.user.username} sent you a follow request` 
          : `${req.user.username} started following you`,
      },
      include: { sender: { select: { id: true, username: true, avatar: true, name: true } } }
    });
    io.to(`user:${userId}`).emit('notification', notification);

    res.json({ action: status === 'PENDING' ? 'requested' : 'followed' });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Accept/Reject follow request
router.post('/follow-request/:followId/:action', auth, async (req, res) => {
  try {
    const { followId, action } = req.params;
    const follow = await prisma.follow.findFirst({
      where: { id: followId, followingId: req.user.id, status: 'PENDING' }
    });

    if (!follow) return res.status(404).json({ error: 'Follow request not found.' });

    if (action === 'accept') {
      await prisma.follow.update({ where: { id: followId }, data: { status: 'ACCEPTED' } });
      
      // Notify
      const io = req.app.get('io');
      const notification = await prisma.notification.create({
        data: {
          userId: follow.followerId,
          senderId: req.user.id,
          type: 'FOLLOW_ACCEPT',
          content: `${req.user.username} accepted your follow request`,
        },
        include: { sender: { select: { id: true, username: true, avatar: true, name: true } } }
      });
      io.to(`user:${follow.followerId}`).emit('notification', notification);

      return res.json({ action: 'accepted' });
    }

    await prisma.follow.delete({ where: { id: followId } });
    res.json({ action: 'rejected' });
  } catch (error) {
    console.error('Follow request error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get followers
router.get('/:userId/followers', auth, async (req, res) => {
  try {
    const follows = await prisma.follow.findMany({
      where: { followingId: req.params.userId, status: 'ACCEPTED' },
      include: { follower: { select: { id: true, username: true, name: true, avatar: true } } }
    });
    res.json(follows.map(f => f.follower));
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get following
router.get('/:userId/following', auth, async (req, res) => {
  try {
    const follows = await prisma.follow.findMany({
      where: { followerId: req.params.userId, status: 'ACCEPTED' },
      include: { following: { select: { id: true, username: true, name: true, avatar: true } } }
    });
    res.json(follows.map(f => f.following));
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Search users
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
        NOT: { id: req.user.id }
      },
      select: { id: true, username: true, name: true, avatar: true },
      take: 20,
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get suggested users
router.get('/suggestions', auth, async (req, res) => {
  try {
    const following = await prisma.follow.findMany({
      where: { followerId: req.user.id },
      select: { followingId: true }
    });
    const followingIds = following.map(f => f.followingId);

    const suggestions = await prisma.user.findMany({
      where: {
        NOT: { id: { in: [req.user.id, ...followingIds] } }
      },
      select: { id: true, username: true, name: true, avatar: true, bio: true },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Update theme
router.put('/theme', auth, async (req, res) => {
  try {
    const { theme } = req.body;
    if (!['DARK', 'NEON', 'CYBERPUNK'].includes(theme)) {
      return res.status(400).json({ error: 'Invalid theme.' });
    }
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { theme },
      select: { id: true, theme: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get all users (for chat list etc.)
router.get('/all', auth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { NOT: { id: req.user.id } },
      select: { id: true, username: true, name: true, avatar: true, isOnline: true, lastSeen: true },
      orderBy: { lastSeen: 'desc' },
      take: 50,
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
