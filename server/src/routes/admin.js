const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get platform stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [users, posts, messages, activeCalls] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.message.count(),
      prisma.call.count({ where: { status: 'ACTIVE' } }),
    ]);

    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, username: true, name: true, avatar: true, createdAt: true }
    });

    res.json({ stats: { users, posts, messages, activeCalls }, recentUsers });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, username: true, email: true, name: true, role: true,
          avatar: true, isOnline: true, createdAt: true,
          _count: { select: { posts: true, followers: true, following: true } }
        }
      }),
      prisma.user.count()
    ]);

    res.json({ users, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Delete user
router.delete('/users/:userId', adminAuth, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.userId } });
    res.json({ message: 'User deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Delete post
router.delete('/posts/:postId', adminAuth, async (req, res) => {
  try {
    await prisma.post.delete({ where: { id: req.params.postId } });
    const io = req.app.get('io');
    io.emit('postDeleted', { postId: req.params.postId });
    res.json({ message: 'Post deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get reported content (placeholder)
router.get('/reports', adminAuth, async (req, res) => {
  res.json([]);
});

module.exports = router;
