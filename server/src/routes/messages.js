const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const { uploadMessageMedia } = require('../middleware/upload');

const router = express.Router();
const prisma = new PrismaClient();

// Helper: check if two users mutually follow each other
async function areMutualFollowers(userId1, userId2) {
  const [follow1, follow2] = await Promise.all([
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId1, followingId: userId2 } }
    }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId2, followingId: userId1 } }
    }),
  ]);
  return (follow1?.status === 'ACCEPTED') && (follow2?.status === 'ACCEPTED');
}

// Get chat list (users with recent messages) — split into accepted & pending
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

    const allConversations = await Promise.all(userIds.map(async (userId) => {
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

      // Check if conversation is accepted (mutual follow OR user has sent/accepted messages)
      const mutual = await areMutualFollowers(req.user.id, userId);
      
      // Also check if user explicitly accepted this conversation
      const hasAcceptedMessages = await prisma.message.count({
        where: {
          OR: [
            { senderId: req.user.id, receiverId: userId, accepted: true },
            { senderId: userId, receiverId: req.user.id, accepted: true }
          ]
        }
      });

      const isAccepted = mutual || hasAcceptedMessages > 0;

      return { user, lastMessage, unreadCount, isAccepted };
    }));

    // Sort by last message time
    allConversations.sort((a, b) => {
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
    });

    const conversations = allConversations.filter(c => c.isAccepted);
    const pendingConversations = allConversations.filter(c => !c.isAccepted);

    res.json({ conversations, pendingConversations });
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
      }, 5000);
    }

    // Check if this conversation is accepted
    const mutual = await areMutualFollowers(req.user.id, userId);
    const hasAcceptedMessages = await prisma.message.count({
      where: {
        OR: [
          { senderId: req.user.id, receiverId: userId, accepted: true },
          { senderId: userId, receiverId: req.user.id, accepted: true }
        ]
      }
    });
    const isAccepted = mutual || hasAcceptedMessages > 0;

    res.json({ messages: messages.reverse(), isAccepted });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Accept a message request
router.post('/:userId/accept', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Mark all messages from this user as accepted
    await prisma.message.updateMany({
      where: {
        OR: [
          { senderId: userId, receiverId: req.user.id },
          { senderId: req.user.id, receiverId: userId }
        ]
      },
      data: { accepted: true }
    });

    const io = req.app.get('io');
    io.to(`user:${userId}`).emit('messageRequestAccepted', { userId: req.user.id });

    res.json({ success: true });
  } catch (error) {
    console.error('Accept message request error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Decline a message request
router.post('/:userId/decline', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Delete all messages from this conversation
    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: req.user.id },
          { senderId: req.user.id, receiverId: userId }
        ]
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Decline message request error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Send media message
router.post('/:userId/media', auth, uploadMessageMedia, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const mediaUrl = `/uploads/messages/${req.file.filename}`;
    const mediaType = req.file.mimetype.startsWith('video') ? 'VIDEO' : 'IMAGE';

    // Check mutual follow for accepted status
    const mutual = await areMutualFollowers(req.user.id, req.params.userId);
    const hasAcceptedMessages = await prisma.message.count({
      where: {
        OR: [
          { senderId: req.user.id, receiverId: req.params.userId, accepted: true },
          { senderId: req.params.userId, receiverId: req.user.id, accepted: true }
        ]
      }
    });
    const isAccepted = mutual || hasAcceptedMessages > 0;

    const message = await prisma.message.create({
      data: {
        senderId: req.user.id,
        receiverId: req.params.userId,
        mediaUrl,
        mediaType,
        content: req.body.content || '',
        accepted: isAccepted,
      }
    });

    const io = req.app.get('io');
    if (isAccepted) {
      io.to(`user:${req.params.userId}`).emit('newMessage', message);
    } else {
      io.to(`user:${req.params.userId}`).emit('newMessageRequest', message);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Send media error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
