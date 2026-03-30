function watchHandler(io, socket, prisma) {
  // Join watch room
  socket.on('joinWatchRoom', ({ roomId }) => {
    socket.join(`watch:${roomId}`);
    io.to(`watch:${roomId}`).emit('watchMemberJoined', {
      roomId,
      userId: socket.userId,
      username: socket.username || 'User'
    });
  });

  // Leave watch room
  socket.on('leaveWatchRoom', ({ roomId }) => {
    socket.leave(`watch:${roomId}`);
    io.to(`watch:${roomId}`).emit('watchMemberLeft', {
      roomId,
      userId: socket.userId,
      username: socket.username || 'User'
    });
  });

  // Sync play/pause
  socket.on('watchSync', async ({ roomId, action, currentTime }) => {
    try {
      const room = await prisma.watchRoom.findUnique({ where: { id: roomId } });
      if (!room) return;

      await prisma.watchRoom.update({
        where: { id: roomId },
        data: {
          isPlaying: action === 'play',
          currentTime: currentTime || 0
        }
      });

      socket.to(`watch:${roomId}`).emit('watchSyncUpdate', {
        roomId,
        action,
        currentTime,
        by: socket.userId
      });
    } catch (error) {
      console.error('Watch sync error:', error);
    }
  });

  // Seek
  socket.on('watchSeek', async ({ roomId, currentTime }) => {
    try {
      await prisma.watchRoom.update({
        where: { id: roomId },
        data: { currentTime }
      });

      socket.to(`watch:${roomId}`).emit('watchSyncUpdate', {
        roomId,
        action: 'seek',
        currentTime,
        by: socket.userId
      });
    } catch (error) {
      console.error('Watch seek error:', error);
    }
  });

  // Chat in watch room
  socket.on('watchChat', ({ roomId, message }) => {
    io.to(`watch:${roomId}`).emit('watchChatMessage', {
      roomId,
      userId: socket.userId,
      username: socket.username || 'User',
      message,
      timestamp: new Date().toISOString()
    });
  });

  // Host changes video directly
  socket.on('watchChangeVideo', async ({ roomId, videoUrl }) => {
    try {
      const room = await prisma.watchRoom.findUnique({ where: { id: roomId } });
      if (!room || room.hostId !== socket.userId) return;

      const videoType = videoUrl.includes('youtube') || videoUrl.includes('youtu.be') ? 'youtube' : 'direct';
      await prisma.watchRoom.update({
        where: { id: roomId },
        data: { videoUrl, videoType, currentTime: 0, isPlaying: false }
      });

      io.to(`watch:${roomId}`).emit('watchVideoChanged', { roomId, videoUrl, videoType });
    } catch (error) {
      console.error('Watch change video error:', error);
    }
  });

  // Send watch invite via socket (from waiting room / watch page)
  socket.on('watchSendInvite', async ({ receiverId, roomId }) => {
    try {
      const sender = await prisma.user.findUnique({ where: { id: socket.userId }, select: { username: true, name: true, avatar: true } });
      if (!sender) return;

      const inviteContent = `__WATCH_INVITE__|${roomId}|Watch Party`;

      // Create chat message
      const message = await prisma.message.create({
        data: { senderId: socket.userId, receiverId, content: inviteContent, accepted: true }
      });
      io.to(`user:${receiverId}`).emit('newMessage', { ...message, isWatchInvite: true });
      socket.emit('messageSent', { ...message, isWatchInvite: true });

      // Create notification
      const notification = await prisma.notification.create({
        data: {
          userId: receiverId,
          senderId: socket.userId,
          type: 'WATCH_INVITE',
          referenceId: roomId,
          content: `${sender.username} invited you to a Watch Party!`,
        },
        include: { sender: { select: { id: true, username: true, avatar: true, name: true } } }
      });
      io.to(`user:${receiverId}`).emit('notification', notification);
    } catch (e) {
      console.error('watchSendInvite error:', e);
    }
  });

  // WebRTC voice signaling relay
  socket.on('watchVoiceSignal', ({ roomId, targetUserId, signal }) => {
    io.to(`watch:${roomId}`).emit('watchVoiceSignal', {
      fromUserId: socket.userId,
      signal,
      targetUserId
    });
  });

  socket.on('watchVoiceToggle', ({ roomId, isMuted }) => {
    socket.to(`watch:${roomId}`).emit('watchVoiceToggle', {
      userId: socket.userId,
      isMuted
    });
  });
}

module.exports = watchHandler;
