const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const { uploadPostMedia } = require('../middleware/upload');

const router = express.Router();
const prisma = new PrismaClient();

// Create post
router.post('/', auth, uploadPostMedia, async (req, res) => {
  try {
    const { caption } = req.body;
    const data = { userId: req.user.id, caption: caption || '' };

    if (req.file) {
      data.mediaUrl = `/uploads/posts/${req.file.filename}`;
      data.mediaType = req.file.mimetype.startsWith('video') ? 'VIDEO' : 'IMAGE';
    }

    const post = await prisma.post.create({
      data,
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
        _count: { select: { likes: true, comments: true } },
      }
    });

    // Emit real-time new post event
    const io = req.app.get('io');
    io.emit('newPost', post);

    res.status(201).json({ ...post, isLiked: false, isSaved: false });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get feed (all posts, sorted by latest)
router.get('/feed', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId: req.user.id }, select: { id: true } },
        saves: { where: { userId: req.user.id }, select: { id: true } },
      }
    });

    const enriched = posts.map(post => ({
      ...post,
      isLiked: post.likes.length > 0,
      isSaved: post.saves.length > 0,
      likes: undefined,
      saves: undefined,
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get explore (trending posts)
router.get('/explore', auth, async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      where: { mediaUrl: { not: null } },
      orderBy: { likes: { _count: 'desc' } },
      take: 30,
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId: req.user.id }, select: { id: true } },
        saves: { where: { userId: req.user.id }, select: { id: true } },
      }
    });

    const enriched = posts.map(post => ({
      ...post,
      isLiked: post.likes.length > 0,
      isSaved: post.saves.length > 0,
      likes: undefined,
      saves: undefined,
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get user posts
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId: req.user.id }, select: { id: true } },
        saves: { where: { userId: req.user.id }, select: { id: true } },
      }
    });

    const enriched = posts.map(post => ({
      ...post,
      isLiked: post.likes.length > 0,
      isSaved: post.saves.length > 0,
      likes: undefined,
      saves: undefined,
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get single post
router.get('/:postId', auth, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.postId },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { user: { select: { id: true, username: true, name: true, avatar: true } } }
        },
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId: req.user.id }, select: { id: true } },
        saves: { where: { userId: req.user.id }, select: { id: true } },
      }
    });

    if (!post) return res.status(404).json({ error: 'Post not found.' });

    res.json({ ...post, isLiked: post.likes.length > 0, isSaved: post.saves.length > 0 });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Like/Unlike post
router.post('/:postId/like', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const existingLike = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId: req.user.id } }
    });

    if (existingLike) {
      await prisma.like.delete({ where: { id: existingLike.id } });
      const count = await prisma.like.count({ where: { postId } });
      
      const io = req.app.get('io');
      io.emit('postLikeUpdate', { postId, likesCount: count, action: 'unliked', userId: req.user.id });
      
      return res.json({ action: 'unliked', likesCount: count });
    }

    await prisma.like.create({ data: { postId, userId: req.user.id } });
    const count = await prisma.like.count({ where: { postId } });

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('postLikeUpdate', { postId, likesCount: count, action: 'liked', userId: req.user.id });

    // Notify post owner
    if (post.userId !== req.user.id) {
      const notification = await prisma.notification.create({
        data: {
          userId: post.userId,
          senderId: req.user.id,
          type: 'LIKE',
          referenceId: postId,
          content: `${req.user.username} liked your post`,
        },
        include: { sender: { select: { id: true, username: true, avatar: true, name: true } } }
      });
      io.to(`user:${post.userId}`).emit('notification', notification);
    }

    res.json({ action: 'liked', likesCount: count });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Comment on post
router.post('/:postId/comment', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Comment text is required.' });

    const post = await prisma.post.findUnique({ where: { id: req.params.postId } });
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const comment = await prisma.comment.create({
      data: { postId: req.params.postId, userId: req.user.id, text: text.trim() },
      include: { user: { select: { id: true, username: true, name: true, avatar: true } } }
    });

    const count = await prisma.comment.count({ where: { postId: req.params.postId } });

    // Emit real-time
    const io = req.app.get('io');
    io.emit('newComment', { postId: req.params.postId, comment, commentsCount: count });

    // Notify post owner
    if (post.userId !== req.user.id) {
      const notification = await prisma.notification.create({
        data: {
          userId: post.userId,
          senderId: req.user.id,
          type: 'COMMENT',
          referenceId: req.params.postId,
          content: `${req.user.username} commented: "${text.trim().substring(0, 50)}"`,
        },
        include: { sender: { select: { id: true, username: true, avatar: true, name: true } } }
      });
      io.to(`user:${post.userId}`).emit('notification', notification);
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error('Comment error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Save/Unsave post
router.post('/:postId/save', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const existing = await prisma.save.findUnique({
      where: { postId_userId: { postId, userId: req.user.id } }
    });

    if (existing) {
      await prisma.save.delete({ where: { id: existing.id } });
      return res.json({ action: 'unsaved' });
    }

    await prisma.save.create({ data: { postId, userId: req.user.id } });
    res.json({ action: 'saved' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get saved posts
router.get('/saved/all', auth, async (req, res) => {
  try {
    const saves = await prisma.save.findMany({
      where: { userId: req.user.id },
      include: {
        post: {
          include: {
            user: { select: { id: true, username: true, name: true, avatar: true } },
            _count: { select: { likes: true, comments: true } },
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(saves.map(s => ({ ...s.post, isLiked: false, isSaved: true })));
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Delete post
router.delete('/:postId', auth, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.postId } });
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    if (post.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    await prisma.post.delete({ where: { id: req.params.postId } });
    
    const io = req.app.get('io');
    io.emit('postDeleted', { postId: req.params.postId });

    res.json({ message: 'Post deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
