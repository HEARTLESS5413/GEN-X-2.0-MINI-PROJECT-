function chatHandler(io, socket, prisma, onlineUsers) {
  // Send message
  socket.on('sendMessage', async (data) => {
    try {
      const { receiverId, content, vanishing } = data;
      
      const message = await prisma.message.create({
        data: {
          senderId: socket.userId,
          receiverId,
          content: content || '',
          vanishing: vanishing || false,
        }
      });

      // Send to receiver
      io.to(`user:${receiverId}`).emit('newMessage', message);
      // Send back to sender for confirmation
      socket.emit('messageSent', message);
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing', ({ receiverId, isTyping }) => {
    io.to(`user:${receiverId}`).emit('userTyping', {
      userId: socket.userId,
      isTyping
    });
  });

  // Mark messages as seen
  socket.on('markSeen', async ({ senderId }) => {
    try {
      await prisma.message.updateMany({
        where: { senderId, receiverId: socket.userId, seen: false },
        data: { seen: true }
      });

      io.to(`user:${senderId}`).emit('messagesSeen', {
        by: socket.userId
      });

      // Handle vanishing messages
      const vanishingMessages = await prisma.message.findMany({
        where: { senderId, receiverId: socket.userId, vanishing: true, deletedAt: null }
      });

      if (vanishingMessages.length > 0) {
        setTimeout(async () => {
          await prisma.message.updateMany({
            where: { id: { in: vanishingMessages.map(m => m.id) } },
            data: { deletedAt: new Date() }
          });
          // Notify both users
          const deletedIds = vanishingMessages.map(m => m.id);
          io.to(`user:${senderId}`).emit('messagesVanished', { messageIds: deletedIds });
          socket.emit('messagesVanished', { messageIds: deletedIds });
        }, 5000);
      }
    } catch (error) {
      console.error('Mark seen error:', error);
    }
  });
}

module.exports = chatHandler;
