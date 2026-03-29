const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get notifications
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      include: {
        sender: { select: { id: true, username: true, name: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get unread count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, read: false }
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Mark as read
router.put('/read', auth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true }
    });
    res.json({ message: 'Notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Mark single as read
router.put('/:notifId/read', auth, async (req, res) => {
  try {
    await prisma.notification.update({
      where: { id: req.params.notifId },
      data: { read: true }
    });
    res.json({ message: 'Notification marked as read.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
