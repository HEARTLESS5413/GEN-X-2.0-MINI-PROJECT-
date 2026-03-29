const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Store user locations in memory for matching
const userLocations = new Map();

// Update location
router.post('/location', auth, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Location is required.' });
    }

    userLocations.set(req.user.id, {
      userId: req.user.id,
      username: req.user.username,
      latitude,
      longitude,
      timestamp: Date.now()
    });

    res.json({ message: 'Location updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Find nearby users
router.get('/nearby', auth, async (req, res) => {
  try {
    const myLocation = userLocations.get(req.user.id);
    if (!myLocation) {
      return res.status(400).json({ error: 'Share your location first.' });
    }

    // Get active sessions to exclude already matched users
    const activeSessions = await prisma.exploreSession.findMany({
      where: {
        OR: [{ user1Id: req.user.id }, { user2Id: req.user.id }],
        status: { in: ['MATCHED', 'REVEALED'] },
      }
    });
    const excludeIds = activeSessions.map(s => s.user1Id === req.user.id ? s.user2Id : s.user1Id);

    const nearbyUsers = [];
    const now = Date.now();

    for (const [userId, location] of userLocations) {
      if (userId === req.user.id) continue;
      if (excludeIds.includes(userId)) continue;
      if (now - location.timestamp > 10 * 60 * 1000) continue; // Skip stale (10 min)

      const distance = calculateDistance(
        myLocation.latitude, myLocation.longitude,
        location.latitude, location.longitude
      );

      nearbyUsers.push({ userId, distance });
    }

    // Sort by distance
    nearbyUsers.sort((a, b) => a.distance - b.distance);

    res.json(nearbyUsers.slice(0, 10));
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Start anonymous chat
router.post('/match/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    const existing = await prisma.exploreSession.findFirst({
      where: {
        OR: [
          { user1Id: req.user.id, user2Id: userId },
          { user1Id: userId, user2Id: req.user.id },
        ],
        status: { in: ['MATCHED', 'REVEALED'] }
      }
    });

    if (existing) return res.json(existing);

    const session = await prisma.exploreSession.create({
      data: { user1Id: req.user.id, user2Id: userId }
    });

    const io = req.app.get('io');
    io.to(`user:${userId}`).emit('exploreMatch', { sessionId: session.id });

    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Reveal identity
router.post('/reveal/:sessionId', auth, async (req, res) => {
  try {
    const session = await prisma.exploreSession.findUnique({
      where: { id: req.params.sessionId }
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const update = {};
    if (session.user1Id === req.user.id) update.user1Revealed = true;
    else if (session.user2Id === req.user.id) update.user2Revealed = true;
    else return res.status(403).json({ error: 'Not part of this session.' });

    const updated = await prisma.exploreSession.update({
      where: { id: req.params.sessionId },
      data: {
        ...update,
        status: session.user1Revealed || session.user2Revealed ? 'REVEALED' : 'MATCHED'
      }
    });

    const io = req.app.get('io');
    const otherId = session.user1Id === req.user.id ? session.user2Id : session.user1Id;
    io.to(`user:${otherId}`).emit('exploreReveal', { sessionId: session.id, revealedBy: req.user.id });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// End explore session
router.post('/end/:sessionId', auth, async (req, res) => {
  try {
    await prisma.exploreSession.update({
      where: { id: req.params.sessionId },
      data: { status: 'ENDED' }
    });
    res.json({ message: 'Session ended.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) { return deg * (Math.PI / 180); }

module.exports = router;
