function watchHandler(io, socket, prisma) {
  // Join watch room
  socket.on('joinWatchRoom', ({ roomId }) => {
    socket.join(`watch:${roomId}`);
    io.to(`watch:${roomId}`).emit('watchMemberJoined', {
      roomId,
      userId: socket.userId
    });
  });

  // Leave watch room
  socket.on('leaveWatchRoom', ({ roomId }) => {
    socket.leave(`watch:${roomId}`);
    io.to(`watch:${roomId}`).emit('watchMemberLeft', {
      roomId,
      userId: socket.userId
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
      message,
      timestamp: new Date()
    });
  });
}

module.exports = watchHandler;
