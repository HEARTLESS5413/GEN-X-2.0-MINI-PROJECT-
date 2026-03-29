require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const gameRoutes = require('./routes/games');
const watchRoutes = require('./routes/watch');
const exploreRoutes = require('./routes/explore');
const adminRoutes = require('./routes/admin');
const storyRoutes = require('./routes/stories');
const setupSocket = require('./socket');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);

// Support multiple origins via comma-separated CLIENT_URL
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(limiter);
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/watch', watchRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stories', storyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io setup
setupSocket(io, prisma);

// Make io accessible in routes
app.set('io', io);
app.set('prisma', prisma);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 GenX server running on port ${PORT}`);
});

// Cleanup expired stories every hour
const cleanupExpiredStories = async () => {
  try {
    const deleted = await prisma.story.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    if (deleted.count > 0) console.log(`🧹 Cleaned up ${deleted.count} expired stories`);
  } catch {}
};
cleanupExpiredStories(); // Run on startup
setInterval(cleanupExpiredStories, 60 * 60 * 1000); // Every hour

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  server.close();
  process.exit(0);
});
