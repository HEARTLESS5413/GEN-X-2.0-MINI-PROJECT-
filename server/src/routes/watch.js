const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Create watch room
router.post('/create', auth, async (req, res) => {
  try {
    const { videoUrl, videoType } = req.body;
    if (!videoUrl) return res.status(400).json({ error: 'Video URL is required.' });

    const room = await prisma.watchRoom.create({
      data: {
        hostId: req.user.id,
        videoUrl,
        videoType: videoType || 'youtube',
      },
      include: {
        host: { select: { id: true, username: true, name: true, avatar: true } },
        members: { include: { user: { select: { id: true, username: true, name: true, avatar: true } } } }
      }
    });

    // Add host as member
    await prisma.watchRoomMember.create({
      data: { roomId: room.id, userId: req.user.id }
    });

    res.status(201).json(room);
  } catch (error) {
    console.error('Create watch room error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get watch room
router.get('/:roomId', auth, async (req, res) => {
  try {
    const room = await prisma.watchRoom.findUnique({
      where: { id: req.params.roomId },
      include: {
        host: { select: { id: true, username: true, name: true, avatar: true } },
        members: { include: { user: { select: { id: true, username: true, name: true, avatar: true } } } }
      }
    });
    if (!room) return res.status(404).json({ error: 'Watch room not found.' });
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Join watch room
router.post('/:roomId/join', auth, async (req, res) => {
  try {
    const existing = await prisma.watchRoomMember.findUnique({
      where: { roomId_userId: { roomId: req.params.roomId, userId: req.user.id } }
    });
    if (!existing) {
      await prisma.watchRoomMember.create({
        data: { roomId: req.params.roomId, userId: req.user.id }
      });
    }

    const io = req.app.get('io');
    io.to(`watch:${req.params.roomId}`).emit('watchMemberJoined', {
      roomId: req.params.roomId,
      user: { id: req.user.id, username: req.user.username, name: req.user.name, avatar: req.user.avatar }
    });

    res.json({ message: 'Joined watch room.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Leave watch room
router.post('/:roomId/leave', auth, async (req, res) => {
  try {
    await prisma.watchRoomMember.deleteMany({
      where: { roomId: req.params.roomId, userId: req.user.id }
    });

    const io = req.app.get('io');
    io.to(`watch:${req.params.roomId}`).emit('watchMemberLeft', {
      roomId: req.params.roomId,
      userId: req.user.id
    });

    res.json({ message: 'Left watch room.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
