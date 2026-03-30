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

// Follow/Unfollow user — ALL follows now start as PENDING
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
      // Unfollow / Cancel request
      await prisma.follow.delete({ where: { id: existingFollow.id } });
      return res.json({ action: 'unfollowed' });
    }

    // All follows start as PENDING
    await prisma.follow.create({
      data: { followerId: req.user.id, followingId: userId, status: 'PENDING' }
    });

    // Create follow request notification
    const io = req.app.get('io');
    const notification = await prisma.notification.create({
      data: {
        userId: userId,
        senderId: req.user.id,
        type: 'FOLLOW_REQUEST',
        content: `${req.user.username} sent you a follow request`,
      },
      include: { sender: { select: { id: true, username: true, avatar: true, name: true } } }
    });
    io.to(`user:${userId}`).emit('notification', notification);

    res.json({ action: 'requested' });
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
      where: { id: followId, followingId: req.user.id, status: 'PENDING' },
      include: { follower: { select: { id: true, username: true, name: true, avatar: true } } }
    });

    if (!follow) return res.status(404).json({ error: 'Follow request not found.' });

    const io = req.app.get('io');

    if (action === 'accept') {
      await prisma.follow.update({ where: { id: followId }, data: { status: 'ACCEPTED' } });
      
      // Notify the follower that their request was accepted
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
      io.to(`user:${follow.followerId}`).emit('followRequestAccepted', { userId: req.user.id });

      return res.json({ action: 'accepted', follower: follow.follower });
    }

    // Decline — delete the follow record and notify
    await prisma.follow.delete({ where: { id: followId } });
    io.to(`user:${follow.followerId}`).emit('followRequestDeclined', { userId: req.user.id });

    res.json({ action: 'rejected' });
  } catch (error) {
    console.error('Follow request error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get pending follow requests for current user
router.get('/follow-requests', auth, async (req, res) => {
  try {
    const requests = await prisma.follow.findMany({
      where: { followingId: req.user.id, status: 'PENDING' },
      include: {
        follower: { select: { id: true, username: true, name: true, avatar: true, bio: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    console.error('Get follow requests error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get followers (with privacy check)
router.get('/:userId/followers', auth, async (req, res) => {
  try {
    const targetUser = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });

    // Privacy check: if private account and not own profile, check if current user follows them
    if (targetUser.accountType === 'PRIVATE' && req.params.userId !== req.user.id) {
      const followRecord = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: req.user.id, followingId: req.params.userId } }
      });
      if (!followRecord || followRecord.status !== 'ACCEPTED') {
        return res.json({ private: true, users: [] });
      }
    }

    const follows = await prisma.follow.findMany({
      where: { followingId: req.params.userId, status: 'ACCEPTED' },
      include: { follower: { select: { id: true, username: true, name: true, avatar: true } } }
    });
    res.json({ private: false, users: follows.map(f => f.follower) });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get following (with privacy check)
router.get('/:userId/following', auth, async (req, res) => {
  try {
    const targetUser = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });

    // Privacy check: if private account and not own profile, check if current user follows them
    if (targetUser.accountType === 'PRIVATE' && req.params.userId !== req.user.id) {
      const followRecord = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: req.user.id, followingId: req.params.userId } }
      });
      if (!followRecord || followRecord.status !== 'ACCEPTED') {
        return res.json({ private: true, users: [] });
      }
    }

    const follows = await prisma.follow.findMany({
      where: { followerId: req.params.userId, status: 'ACCEPTED' },
      include: { following: { select: { id: true, username: true, name: true, avatar: true } } }
    });
    res.json({ private: false, users: follows.map(f => f.following) });
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

// Delete user account permanently
router.delete('/account', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete all related data in proper order (respecting FK constraints)
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { OR: [{ userId }, { actorId: userId }] } }),
      prisma.like.deleteMany({ where: { userId } }),
      prisma.comment.deleteMany({ where: { userId } }),
      prisma.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }),
      prisma.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
      prisma.gameRoomMember.deleteMany({ where: { userId } }),
      prisma.watchRoomMember.deleteMany({ where: { userId } }),
      prisma.story.deleteMany({ where: { userId } }),
      prisma.post.deleteMany({ where: { userId } }),
      prisma.gameRoom.deleteMany({ where: { hostId: userId } }),
      prisma.watchRoom.deleteMany({ where: { hostId: userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    res.json({ message: 'Account deleted permanently.' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account. Please try again.' });
  }
});

module.exports = router;
