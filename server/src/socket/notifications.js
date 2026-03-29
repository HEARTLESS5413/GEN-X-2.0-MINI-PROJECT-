function notificationHandler(io, socket, prisma) {
  // Mark notification as read
  socket.on('markNotificationRead', async ({ notificationId }) => {
    try {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { read: true }
      });
    } catch (error) {
      console.error('Mark notification read error:', error);
    }
  });

  // Mark all notifications as read
  socket.on('markAllNotificationsRead', async () => {
    try {
      await prisma.notification.updateMany({
        where: { userId: socket.userId, read: false },
        data: { read: true }
      });
    } catch (error) {
      console.error('Mark all read error:', error);
    }
  });
}

module.exports = notificationHandler;
