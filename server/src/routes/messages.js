const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const { uploadMessageMedia } = require('../middleware/upload');

const router = express.Router();
const prisma = new PrismaClient();

// Get chat list (users with recent messages)
router.get('/conversations', auth, async (req, res) => {
  try {
    // Get all unique conversations
    const sentMessages = await prisma.message.findMany({
      where: { senderId: req.user.id },
      select: { receiverId: true },
      distinct: ['receiverId']
    });
    const receivedMessages = await prisma.message.findMany({
      where: { receiverId: req.user.id },
      select: { senderId: true },
      distinct: ['senderId']
    });

    const userIds = [...new Set([
      ...sentMessages.map(m => m.receiverId),
      ...receivedMessages.map(m => m.senderId)
    ])];

    const conversations = await Promise.all(userIds.map(async (userId) => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, name: true, avatar: true, isOnline: true, lastSeen: true }
      });

      const lastMessage = await prisma.message.findFirst({
        where: {
          OR: [
            { senderId: req.user.id, receiverId: userId },
            { senderId: userId, receiverId: req.user.id }
          ],
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' }
      });

      const unreadCount = await prisma.message.count({
        where: { senderId: userId, receiverId: req.user.id, seen: false, deletedAt: null }
      });

      return { user, lastMessage, unreadCount };
    }));

    // Sort by last message time
    conversations.sort((a, b) => {
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
    });

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get messages with a user
router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.user.id, receiverId: userId },
          { senderId: userId, receiverId: req.user.id }
        ],
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    // Mark as seen
    await prisma.message.updateMany({
      where: { senderId: userId, receiverId: req.user.id, seen: false },
      data: { seen: true }
    });

    // Handle vanishing messages (delete after seen)
    const vanishingIds = messages
      .filter(m => m.vanishing && m.senderId === userId && !m.seen)
      .map(m => m.id);
    
    if (vanishingIds.length > 0) {
      setTimeout(async () => {
        await prisma.message.updateMany({
          where: { id: { in: vanishingIds } },
          data: { deletedAt: new Date() }
        });
      }, 5000); // Delete after 5 seconds of being seen
    }

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Send media message
router.post('/:userId/media', auth, uploadMessageMedia, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const mediaUrl = `/uploads/messages/${req.file.filename}`;
    const mediaType = req.file.mimetype.startsWith('video') ? 'VIDEO' : 'IMAGE';

    const message = await prisma.message.create({
      data: {
        senderId: req.user.id,
        receiverId: req.params.userId,
        mediaUrl,
        mediaType,
        content: req.body.content || '',
      }
    });

    const io = req.app.get('io');
    io.to(`user:${req.params.userId}`).emit('newMessage', message);

    res.status(201).json(message);
  } catch (error) {
    console.error('Send media error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
