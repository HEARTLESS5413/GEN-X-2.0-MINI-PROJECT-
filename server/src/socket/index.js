const jwt = require('jsonwebtoken');
const chatHandler = require('./chat');
const notificationHandler = require('./notifications');
const gameHandler = require('./games');
const watchHandler = require('./watch');
const callHandler = require('./calls');

// Map userId -> Set of socketIds
const onlineUsers = new Map();

function setupSocket(io, prisma) {
  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`🟢 User connected: ${userId}`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Join personal room
    socket.join(`user:${userId}`);

    // Update online status in DB
    await prisma.user.update({
      where: { id: userId },
      data: { isOnline: true, lastSeen: new Date() }
    }).catch(() => {});

    // Broadcast online status
    io.emit('userOnline', { userId, isOnline: true });

    // Setup handlers
    chatHandler(io, socket, prisma, onlineUsers);
    notificationHandler(io, socket, prisma);
    gameHandler(io, socket, prisma);
    watchHandler(io, socket, prisma);
    callHandler(io, socket, prisma, onlineUsers);

    // Disconnect
    socket.on('disconnect', async () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          await prisma.user.update({
            where: { id: userId },
            data: { isOnline: false, lastSeen: new Date() }
          }).catch(() => {});
          io.emit('userOnline', { userId, isOnline: false });
        }
      }
      console.log(`🔴 User disconnected: ${userId}`);
    });
  });
}

module.exports = setupSocket;
