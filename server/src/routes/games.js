const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const VALID_GAMES = ['TIC_TAC_TOE', 'ROCK_PAPER_SCISSORS', 'CHESS', 'FLAPPY_BIRD', 'LUDO', 'GUESS_THE_WORD'];

function getInitialState(gameType, player1Id) {
  switch (gameType) {
    case 'TIC_TAC_TOE':
      return { board: Array(9).fill(null), currentTurn: player1Id, moves: 0 };
    case 'ROCK_PAPER_SCISSORS':
      return { player1Choice: null, player2Choice: null, round: 1, scores: { p1: 0, p2: 0 } };
    case 'CHESS':
      return getInitialChessState(player1Id);
    case 'FLAPPY_BIRD':
      return { player1Score: null, player2Score: null, currentPlayer: null, phase: 'waiting' };
    case 'LUDO':
      return getInitialLudoState(player1Id);
    case 'GUESS_THE_WORD':
      return { word: null, guessedLetters: [], maxWrong: 6, wrongCount: 0, setter: null, guesser: null, phase: 'setting' };
    default:
      return {};
  }
}

function getInitialChessState(player1Id) {
  // Standard chess starting position
  const board = [
    ['br','bn','bb','bq','bk','bb','bn','br'],
    ['bp','bp','bp','bp','bp','bp','bp','bp'],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ['wp','wp','wp','wp','wp','wp','wp','wp'],
    ['wr','wn','wb','wq','wk','wb','wn','wr'],
  ];
  return { board, currentTurn: player1Id, moveHistory: [], capturedPieces: { w: [], b: [] } };
}

function getInitialLudoState(player1Id) {
  return {
    currentTurn: player1Id,
    dice: null,
    rolled: false,
    consecutiveSixes: 0,
    tokens: {
      p1: [-1, -1, -1, -1], // positions -1 = base, 0-50 = shared path, 51-56 = home column, 57 = finished
      p2: [-1, -1, -1, -1],
    },
    finished: { p1: 0, p2: 0 },
  };
}

// Create game session (from chat)
router.post('/create', auth, async (req, res) => {
  try {
    const { gameType, opponentId } = req.body;
    if (!VALID_GAMES.includes(gameType)) {
      return res.status(400).json({ error: 'Invalid game type.' });
    }

    const initialState = getInitialState(gameType, req.user.id);

    const session = await prisma.gameSession.create({
      data: {
        gameType,
        player1Id: req.user.id,
        player2Id: opponentId || null,
        state: initialState,
        status: 'WAITING',
      },
      include: {
        player1: { select: { id: true, username: true, name: true, avatar: true } },
        player2: { select: { id: true, username: true, name: true, avatar: true } },
      }
    });

    // Create game invite message in chat
    if (opponentId) {
      const gameNames = {
        TIC_TAC_TOE: 'Tic Tac Toe', ROCK_PAPER_SCISSORS: 'Rock Paper Scissors',
        CHESS: 'Chess', FLAPPY_BIRD: 'Flappy Bird', LUDO: 'Ludo', GUESS_THE_WORD: 'Guess the Word',
      };
      const inviteContent = `__GAME_INVITE__|${session.id}|${gameType}|${gameNames[gameType]}`;

      const message = await prisma.message.create({
        data: {
          senderId: req.user.id,
          receiverId: opponentId,
          content: inviteContent,
        }
      });

      // Notify via socket
      const io = req.app.get('io');
      io.to(`user:${opponentId}`).emit('newMessage', {
        ...message, isGameInvite: true, gameSession: session
      });
      io.to(`user:${req.user.id}`).emit('messageSent', {
        ...message, isGameInvite: true, gameSession: session
      });

      // Also create notification
      await prisma.notification.create({
        data: {
          userId: opponentId, senderId: req.user.id,
          type: 'GAME_INVITE', referenceId: session.id,
          content: `${req.user.username} invited you to play ${gameNames[gameType]}`,
        }
      });
      io.to(`user:${opponentId}`).emit('notification', { type: 'GAME_INVITE' });
    }

    res.status(201).json(session);
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Join game session
router.post('/:sessionId/join', auth, async (req, res) => {
  try {
    const session = await prisma.gameSession.findUnique({ where: { id: req.params.sessionId } });
    if (!session) return res.status(404).json({ error: 'Game not found.' });
    if (session.status !== 'WAITING') return res.status(400).json({ error: 'Game already started.' });
    if (session.player1Id === req.user.id) return res.status(400).json({ error: 'Cannot join your own game.' });

    const updated = await prisma.gameSession.update({
      where: { id: req.params.sessionId },
      data: { player2Id: req.user.id },
      include: {
        player1: { select: { id: true, username: true, name: true, avatar: true } },
        player2: { select: { id: true, username: true, name: true, avatar: true } },
      }
    });

    const io = req.app.get('io');
    io.to(`game:${session.id}`).emit('playerJoined', { session: updated });
    io.to(`user:${session.player1Id}`).emit('playerJoined', { session: updated });

    res.json(updated);
  } catch (error) {
    console.error('Join game error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Start game
router.post('/:sessionId/start', auth, async (req, res) => {
  try {
    const session = await prisma.gameSession.findUnique({ where: { id: req.params.sessionId } });
    if (!session) return res.status(404).json({ error: 'Game not found.' });
    if (session.player1Id !== req.user.id) return res.status(403).json({ error: 'Only host can start.' });
    if (!session.player2Id) return res.status(400).json({ error: 'Need opponent to start.' });

    // Reset state with both players known
    const state = getInitialState(session.gameType, session.player1Id);
    
    // Set specific roles for certain games
    if (session.gameType === 'GUESS_THE_WORD') {
      state.setter = session.player1Id;
      state.guesser = session.player2Id;
    }
    if (session.gameType === 'FLAPPY_BIRD') {
      state.currentPlayer = session.player1Id;
      state.phase = 'playing';
    }

    const updated = await prisma.gameSession.update({
      where: { id: req.params.sessionId },
      data: { status: 'ACTIVE', state, winnerId: null },
      include: {
        player1: { select: { id: true, username: true, name: true, avatar: true } },
        player2: { select: { id: true, username: true, name: true, avatar: true } },
      }
    });

    const io = req.app.get('io');
    io.to(`game:${session.id}`).emit('gameStarted', { session: updated });

    res.json(updated);
  } catch (error) {
    console.error('Start game error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Rematch
router.post('/:sessionId/rematch', auth, async (req, res) => {
  try {
    const session = await prisma.gameSession.findUnique({ where: { id: req.params.sessionId } });
    if (!session) return res.status(404).json({ error: 'Game not found.' });

    const state = getInitialState(session.gameType, session.player1Id);
    if (session.gameType === 'GUESS_THE_WORD') {
      // Swap roles on rematch
      state.setter = session.player2Id;
      state.guesser = session.player1Id;
    }
    if (session.gameType === 'FLAPPY_BIRD') {
      state.currentPlayer = session.player1Id;
      state.phase = 'playing';
    }

    const updated = await prisma.gameSession.update({
      where: { id: req.params.sessionId },
      data: { status: 'ACTIVE', state, winnerId: null },
      include: {
        player1: { select: { id: true, username: true, name: true, avatar: true } },
        player2: { select: { id: true, username: true, name: true, avatar: true } },
      }
    });

    const io = req.app.get('io');
    io.to(`game:${session.id}`).emit('gameStarted', { session: updated });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Change game type in room
router.post('/:sessionId/change-game', auth, async (req, res) => {
  try {
    const { gameType } = req.body;
    if (!VALID_GAMES.includes(gameType)) return res.status(400).json({ error: 'Invalid game type.' });

    const session = await prisma.gameSession.findUnique({ where: { id: req.params.sessionId } });
    if (!session) return res.status(404).json({ error: 'Game not found.' });

    const state = getInitialState(gameType, session.player1Id);
    const updated = await prisma.gameSession.update({
      where: { id: req.params.sessionId },
      data: { gameType, status: 'WAITING', state, winnerId: null },
      include: {
        player1: { select: { id: true, username: true, name: true, avatar: true } },
        player2: { select: { id: true, username: true, name: true, avatar: true } },
      }
    });

    const io = req.app.get('io');
    io.to(`game:${session.id}`).emit('gameChanged', { session: updated });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get game session
router.get('/:sessionId', auth, async (req, res) => {
  try {
    const session = await prisma.gameSession.findUnique({
      where: { id: req.params.sessionId },
      include: {
        player1: { select: { id: true, username: true, name: true, avatar: true } },
        player2: { select: { id: true, username: true, name: true, avatar: true } },
      }
    });
    if (!session) return res.status(404).json({ error: 'Game not found.' });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get user's game history
router.get('/history/me', auth, async (req, res) => {
  try {
    const games = await prisma.gameSession.findMany({
      where: { OR: [{ player1Id: req.user.id }, { player2Id: req.user.id }] },
      include: {
        player1: { select: { id: true, username: true, name: true, avatar: true } },
        player2: { select: { id: true, username: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Close / Cancel game session
router.delete('/:sessionId/close', auth, async (req, res) => {
  try {
    const session = await prisma.gameSession.findUnique({ where: { id: req.params.sessionId } });
    if (!session) return res.status(404).json({ error: 'Game not found.' });

    // Only a player in this game can close it
    if (session.player1Id !== req.user.id && session.player2Id !== req.user.id) {
      return res.status(403).json({ error: 'Not a player in this game.' });
    }

    // Delete the session
    await prisma.gameSession.delete({ where: { id: req.params.sessionId } });

    // Notify all players
    const io = req.app.get('io');
    io.to(`game:${req.params.sessionId}`).emit('gameClosed', { sessionId: req.params.sessionId, closedBy: req.user.id });

    res.json({ success: true });
  } catch (error) {
    console.error('Close game error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
