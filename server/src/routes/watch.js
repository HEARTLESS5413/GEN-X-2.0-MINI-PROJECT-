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
    const room = await prisma.watchRoom.findUnique({ where: { id: req.params.roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found.' });
    if (room.status !== 'ACTIVE') return res.status(400).json({ error: 'Room is closed.' });

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

    // Return full room data
    const updatedRoom = await prisma.watchRoom.findUnique({
      where: { id: req.params.roomId },
      include: {
        host: { select: { id: true, username: true, name: true, avatar: true } },
        members: { include: { user: { select: { id: true, username: true, name: true, avatar: true } } } }
      }
    });

    res.json(updatedRoom);
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
      userId: req.user.id,
      username: req.user.username
    });

    res.json({ message: 'Left watch room.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Invite users to watch room
router.post('/:roomId/invite', auth, async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds)) return res.status(400).json({ error: 'userIds required.' });

    const room = await prisma.watchRoom.findUnique({ where: { id: req.params.roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    const io = req.app.get('io');

    for (const userId of userIds) {
      const inviteContent = `__WATCH_INVITE__|${req.params.roomId}|Watch Party`;

      // Chat message
      await prisma.message.create({
        data: { senderId: req.user.id, receiverId: userId, content: inviteContent, accepted: true }
      });

      // Notification
      const notification = await prisma.notification.create({
        data: {
          userId,
          senderId: req.user.id,
          type: 'WATCH_INVITE',
          referenceId: req.params.roomId,
          content: `${req.user.username} invited you to a Watch Party!`,
        },
        include: { sender: { select: { id: true, username: true, avatar: true, name: true } } }
      });

      io.to(`user:${userId}`).emit('notification', notification);
      io.to(`user:${userId}`).emit('newMessage', { senderId: req.user.id, receiverId: userId, content: inviteContent, isWatchInvite: true });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Watch invite error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Queue a video
router.post('/:roomId/queue', auth, async (req, res) => {
  try {
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ error: 'videoUrl required.' });

    const room = await prisma.watchRoom.findUnique({ where: { id: req.params.roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    const queue = Array.isArray(room.videoQueue) ? room.videoQueue : [];
    queue.push({ url: videoUrl, addedBy: req.user.id, addedByUsername: req.user.username, addedAt: new Date().toISOString() });

    const updated = await prisma.watchRoom.update({
      where: { id: req.params.roomId },
      data: { videoQueue: queue }
    });

    const io = req.app.get('io');
    io.to(`watch:${req.params.roomId}`).emit('watchQueueUpdated', { roomId: req.params.roomId, queue });

    res.json({ queue });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Accept queued video (host only)
router.post('/:roomId/queue/:index/accept', auth, async (req, res) => {
  try {
    const room = await prisma.watchRoom.findUnique({ where: { id: req.params.roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found.' });
    if (room.hostId !== req.user.id) return res.status(403).json({ error: 'Only host can accept.' });

    const queue = Array.isArray(room.videoQueue) ? [...room.videoQueue] : [];
    const index = parseInt(req.params.index);
    if (index < 0 || index >= queue.length) return res.status(400).json({ error: 'Invalid index.' });

    const accepted = queue.splice(index, 1)[0];
    const videoType = accepted.url.includes('youtube') || accepted.url.includes('youtu.be') ? 'youtube' : 'direct';

    const updated = await prisma.watchRoom.update({
      where: { id: req.params.roomId },
      data: { videoUrl: accepted.url, videoType, videoQueue: queue, currentTime: 0, isPlaying: false }
    });

    const io = req.app.get('io');
    io.to(`watch:${req.params.roomId}`).emit('watchVideoChanged', {
      roomId: req.params.roomId,
      videoUrl: accepted.url,
      videoType,
      queue
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Reject queued video (host only)
router.delete('/:roomId/queue/:index', auth, async (req, res) => {
  try {
    const room = await prisma.watchRoom.findUnique({ where: { id: req.params.roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found.' });
    if (room.hostId !== req.user.id) return res.status(403).json({ error: 'Only host can reject.' });

    const queue = Array.isArray(room.videoQueue) ? [...room.videoQueue] : [];
    const index = parseInt(req.params.index);
    if (index < 0 || index >= queue.length) return res.status(400).json({ error: 'Invalid index.' });

    queue.splice(index, 1);
    await prisma.watchRoom.update({ where: { id: req.params.roomId }, data: { videoQueue: queue } });

    const io = req.app.get('io');
    io.to(`watch:${req.params.roomId}`).emit('watchQueueUpdated', { roomId: req.params.roomId, queue });

    res.json({ queue });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Close watch room (host can delete, members can leave)
router.delete('/:roomId/close', auth, async (req, res) => {
  try {
    const room = await prisma.watchRoom.findUnique({
      where: { id: req.params.roomId },
      include: { members: true }
    });
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    const isMember = room.members.some(m => m.userId === req.user.id);
    const isHost = room.hostId === req.user.id;

    if (!isMember && !isHost) {
      return res.status(403).json({ error: 'Not a member of this room.' });
    }

    if (isHost) {
      // Host closes = delete room for everyone
      await prisma.watchRoom.delete({ where: { id: req.params.roomId } });
      const io = req.app.get('io');
      io.to(`watch:${req.params.roomId}`).emit('watchRoomClosed', { roomId: req.params.roomId });
    } else {
      // Non-host = just leave
      await prisma.watchRoomMember.deleteMany({
        where: { roomId: req.params.roomId, userId: req.user.id }
      });
      const io = req.app.get('io');
      io.to(`watch:${req.params.roomId}`).emit('watchMemberLeft', {
        roomId: req.params.roomId,
        userId: req.user.id,
        username: req.user.username
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Close watch room error:', error);
    res.status(500).json({ error: 'Server error: ' + (error.message || 'Unknown') });
  }
});

module.exports = router;
