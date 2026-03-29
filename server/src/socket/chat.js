function chatHandler(io, socket, prisma, onlineUsers) {
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

  // Send message
  socket.on('sendMessage', async (data) => {
    try {
      const { receiverId, content, vanishing } = data;

      // Check mutual follow or existing accepted conversation
      const mutual = await areMutualFollowers(socket.userId, receiverId);
      const hasAcceptedMessages = await prisma.message.count({
        where: {
          OR: [
            { senderId: socket.userId, receiverId, accepted: true },
            { senderId: receiverId, receiverId: socket.userId, accepted: true }
          ]
        }
      });
      const isAccepted = mutual || hasAcceptedMessages > 0;
      
      const message = await prisma.message.create({
        data: {
          senderId: socket.userId,
          receiverId,
          content: content || '',
          vanishing: vanishing || false,
          accepted: isAccepted,
        }
      });

      if (isAccepted) {
        // Normal message flow
        io.to(`user:${receiverId}`).emit('newMessage', message);
        socket.emit('messageSent', message);
      } else {
        // Message request flow
        io.to(`user:${receiverId}`).emit('newMessageRequest', message);
        socket.emit('messageSent', { ...message, isPending: true });
      }
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
