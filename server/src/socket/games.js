function gameHandler(io, socket, prisma) {
  // Join game room
  socket.on('joinGame', ({ sessionId }) => {
    socket.join(`game:${sessionId}`);
  });

  // Leave game room
  socket.on('leaveGame', ({ sessionId }) => {
    socket.leave(`game:${sessionId}`);
  });

  // ==================== TIC TAC TOE ====================
  socket.on('tttMove', async ({ sessionId, index }) => {
    try {
      const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
      if (!session || session.status !== 'ACTIVE') return;
      const state = session.state;
      if (state.currentTurn !== socket.userId) return;
      if (state.board[index] !== null) return;

      const symbol = session.player1Id === socket.userId ? 'X' : 'O';
      state.board[index] = symbol;
      state.moves++;
      state.currentTurn = session.player1Id === socket.userId ? session.player2Id : session.player1Id;

      const winner = checkTTTWinner(state.board);
      let status = 'ACTIVE';
      let winnerId = null;

      if (winner) {
        status = 'FINISHED';
        winnerId = winner === 'X' ? session.player1Id : session.player2Id;
      } else if (state.moves === 9) {
        status = 'FINISHED';
      }

      await prisma.gameSession.update({ where: { id: sessionId }, data: { state, status, winnerId } });
      io.to(`game:${sessionId}`).emit('gameUpdate', { sessionId, state, status, winnerId, gameType: 'TIC_TAC_TOE' });
    } catch (e) { console.error('TTT error:', e); }
  });

  // ==================== ROCK PAPER SCISSORS ====================
  socket.on('rpsChoice', async ({ sessionId, choice }) => {
    try {
      const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
      if (!session || session.status !== 'ACTIVE') return;
      const state = session.state;
      const isP1 = session.player1Id === socket.userId;

      if (isP1) state.player1Choice = choice;
      else state.player2Choice = choice;

      io.to(`game:${sessionId}`).emit('rpsChosen', { sessionId, playerId: socket.userId });

      if (state.player1Choice && state.player2Choice) {
        const result = getRPSResult(state.player1Choice, state.player2Choice);
        if (result === 1) state.scores.p1++;
        else if (result === -1) state.scores.p2++;

        const roundResult = { player1Choice: state.player1Choice, player2Choice: state.player2Choice, result, scores: state.scores, round: state.round };
        state.player1Choice = null;
        state.player2Choice = null;
        state.round++;

        let status = 'ACTIVE';
        let winnerId = null;
        if (state.scores.p1 >= 2) { status = 'FINISHED'; winnerId = session.player1Id; }
        else if (state.scores.p2 >= 2) { status = 'FINISHED'; winnerId = session.player2Id; }

        await prisma.gameSession.update({ where: { id: sessionId }, data: { state, status, winnerId } });
        io.to(`game:${sessionId}`).emit('rpsResult', { sessionId, ...roundResult, status, winnerId });
      } else {
        await prisma.gameSession.update({ where: { id: sessionId }, data: { state } });
      }
    } catch (e) { console.error('RPS error:', e); }
  });

  // ==================== CHESS ====================
  socket.on('chessMove', async ({ sessionId, from, to, promotion }) => {
    try {
      const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
      if (!session || session.status !== 'ACTIVE') return;
      const state = session.state;
      if (state.currentTurn !== socket.userId) return;

      const playerColor = session.player1Id === socket.userId ? 'w' : 'b';
      const piece = state.board[from.row][from.col];
      if (!piece || piece[0] !== playerColor) return;

      // Capture
      const target = state.board[to.row][to.col];
      if (target) {
        state.capturedPieces[playerColor].push(target);
      }

      // Move piece
      state.board[to.row][to.col] = piece;
      state.board[from.row][from.col] = null;

      // Pawn promotion
      if (piece[1] === 'p' && (to.row === 0 || to.row === 7)) {
        state.board[to.row][to.col] = playerColor + (promotion || 'q');
      }

      state.moveHistory.push({ from, to, piece, captured: target });
      state.currentTurn = session.player1Id === socket.userId ? session.player2Id : session.player1Id;

      // Check if king captured = game over
      let status = 'ACTIVE';
      let winnerId = null;
      if (target && target[1] === 'k') {
        status = 'FINISHED';
        winnerId = socket.userId;
      }

      await prisma.gameSession.update({ where: { id: sessionId }, data: { state, status, winnerId } });
      io.to(`game:${sessionId}`).emit('gameUpdate', { sessionId, state, status, winnerId, gameType: 'CHESS', lastMove: { from, to } });
    } catch (e) { console.error('Chess error:', e); }
  });

  // ==================== FLAPPY BIRD ====================
  socket.on('flappyScore', async ({ sessionId, score }) => {
    try {
      const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
      if (!session || session.status !== 'ACTIVE') return;
      const state = session.state;
      const isP1 = session.player1Id === socket.userId;

      if (isP1) state.player1Score = score;
      else state.player2Score = score;

      let status = 'ACTIVE';
      let winnerId = null;

      if (state.player1Score !== null && state.player2Score !== null) {
        status = 'FINISHED';
        if (state.player1Score > state.player2Score) winnerId = session.player1Id;
        else if (state.player2Score > state.player1Score) winnerId = session.player2Id;
        // else draw
      } else {
        // Switch to next player
        state.currentPlayer = isP1 ? session.player2Id : session.player1Id;
        state.phase = 'playing';
      }

      await prisma.gameSession.update({ where: { id: sessionId }, data: { state, status, winnerId } });
      io.to(`game:${sessionId}`).emit('gameUpdate', { sessionId, state, status, winnerId, gameType: 'FLAPPY_BIRD' });
    } catch (e) { console.error('Flappy error:', e); }
  });

  // ==================== LUDO ====================
  socket.on('ludoRoll', async ({ sessionId }) => {
    try {
      const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
      if (!session || session.status !== 'ACTIVE') return;
      const state = session.state;
      if (state.currentTurn !== socket.userId) return;
      if (state.rolled) return;

      state.dice = Math.floor(Math.random() * 6) + 1;
      state.rolled = true;

      await prisma.gameSession.update({ where: { id: sessionId }, data: { state } });
      io.to(`game:${sessionId}`).emit('gameUpdate', { sessionId, state, status: 'ACTIVE', winnerId: null, gameType: 'LUDO' });
    } catch (e) { console.error('Ludo roll error:', e); }
  });

  socket.on('ludoMove', async ({ sessionId, tokenIndex }) => {
    try {
      const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
      if (!session || session.status !== 'ACTIVE') return;
      const state = session.state;
      if (state.currentTurn !== socket.userId || !state.rolled) return;

      const isP1 = session.player1Id === socket.userId;
      const playerKey = isP1 ? 'p1' : 'p2';
      const tokens = state.tokens[playerKey];
      const pos = tokens[tokenIndex];
      const dice = state.dice;

      // Token at home (0) needs a 6 to enter
      if (pos === 0 && dice !== 6) {
        state.rolled = false;
        state.dice = null;
        if (dice !== 6) {
          state.currentTurn = isP1 ? session.player2Id : session.player1Id;
        }
        await prisma.gameSession.update({ where: { id: sessionId }, data: { state } });
        io.to(`game:${sessionId}`).emit('gameUpdate', { sessionId, state, status: 'ACTIVE', winnerId: null, gameType: 'LUDO' });
        return;
      }

      let newPos;
      if (pos === 0) {
        newPos = 1; // Enter the board
      } else {
        newPos = pos + dice;
        if (newPos > 57) {
          // Can't move past finish
          state.rolled = false;
          state.currentTurn = isP1 ? session.player2Id : session.player1Id;
          await prisma.gameSession.update({ where: { id: sessionId }, data: { state } });
          io.to(`game:${sessionId}`).emit('gameUpdate', { sessionId, state, status: 'ACTIVE', winnerId: null, gameType: 'LUDO' });
          return;
        }
      }

      tokens[tokenIndex] = newPos;

      // Check if token reached finish (57)
      if (newPos === 57) {
        state.finished[playerKey]++;
      }

      // Check win (all 4 tokens finished)
      let status = 'ACTIVE';
      let winnerId = null;
      if (state.finished[playerKey] >= 4) {
        status = 'FINISHED';
        winnerId = socket.userId;
      }

      // Next turn (rolling 6 gives extra turn)
      state.rolled = false;
      state.dice = null;
      if (dice !== 6) {
        state.currentTurn = isP1 ? session.player2Id : session.player1Id;
      }

      await prisma.gameSession.update({ where: { id: sessionId }, data: { state, status, winnerId } });
      io.to(`game:${sessionId}`).emit('gameUpdate', { sessionId, state, status, winnerId, gameType: 'LUDO' });
    } catch (e) { console.error('Ludo move error:', e); }
  });

  // ==================== GUESS THE WORD ====================
  socket.on('setWord', async ({ sessionId, word }) => {
    try {
      const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
      if (!session || session.status !== 'ACTIVE') return;
      const state = session.state;
      if (state.setter !== socket.userId) return;

      state.word = word.toUpperCase();
      state.phase = 'guessing';
      state.guessedLetters = [];
      state.wrongCount = 0;

      await prisma.gameSession.update({ where: { id: sessionId }, data: { state } });
      io.to(`game:${sessionId}`).emit('gameUpdate', { sessionId, state: { ...state, word: undefined, wordLength: state.word.length }, status: 'ACTIVE', winnerId: null, gameType: 'GUESS_THE_WORD' });
      // Send word only to setter
      socket.emit('wordSet', { word: state.word });
    } catch (e) { console.error('Set word error:', e); }
  });

  socket.on('guessLetter', async ({ sessionId, letter }) => {
    try {
      const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
      if (!session || session.status !== 'ACTIVE') return;
      const state = session.state;
      if (state.guesser !== socket.userId) return;
      if (state.phase !== 'guessing') return;

      const upperLetter = letter.toUpperCase();
      if (state.guessedLetters.includes(upperLetter)) return;

      state.guessedLetters.push(upperLetter);

      if (!state.word.includes(upperLetter)) {
        state.wrongCount++;
      }

      let status = 'ACTIVE';
      let winnerId = null;

      // Check if word is fully guessed
      const wordLetters = [...new Set(state.word.split(''))];
      const guessedRight = wordLetters.every(l => state.guessedLetters.includes(l));

      if (guessedRight) {
        status = 'FINISHED';
        winnerId = state.guesser; // Guesser wins
      } else if (state.wrongCount >= state.maxWrong) {
        status = 'FINISHED';
        winnerId = state.setter; // Setter wins
      }

      await prisma.gameSession.update({ where: { id: sessionId }, data: { state, status, winnerId } });

      // Send state without word to guesser, with word to setter
      const publicState = { ...state, word: status === 'FINISHED' ? state.word : undefined, wordLength: state.word.length };
      io.to(`game:${sessionId}`).emit('gameUpdate', { sessionId, state: publicState, status, winnerId, gameType: 'GUESS_THE_WORD', revealWord: status === 'FINISHED' ? state.word : undefined });
    } catch (e) { console.error('Guess letter error:', e); }
  });
}

function checkTTTWinner(board) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function getRPSResult(p1, p2) {
  if (p1 === p2) return 0;
  if ((p1==='rock'&&p2==='scissors')||(p1==='paper'&&p2==='rock')||(p1==='scissors'&&p2==='paper')) return 1;
  return -1;
}

module.exports = gameHandler;
