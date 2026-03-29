'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { gamesAPI, UPLOADS_URL } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import styles from './gameroom.module.css';

const GAME_INFO: Record<string, { name: string; icon: string; color: string }> = {
  TIC_TAC_TOE: { name: 'Tic Tac Toe', icon: '⭕', color: '#8B5CF6' },
  ROCK_PAPER_SCISSORS: { name: 'Rock Paper Scissors', icon: '✊', color: '#EC4899' },
  CHESS: { name: 'Chess', icon: '♟️', color: '#F59E0B' },
  FLAPPY_BIRD: { name: 'Flappy Bird', icon: '🐦', color: '#10B981' },
  LUDO: { name: 'Ludo', icon: '🎲', color: '#3B82F6' },
  GUESS_THE_WORD: { name: 'Guess the Word', icon: '🔤', color: '#EF4444' },
};

const ALL_GAMES = ['TIC_TAC_TOE','ROCK_PAPER_SCISSORS','CHESS','FLAPPY_BIRD','LUDO','GUESS_THE_WORD'];

export default function GameRoomPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { user } = useAuthStore();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showGameChanger, setShowGameChanger] = useState(false);

  useEffect(() => {
    loadSession();
    const socket = getSocket();
    if (!socket) return;
    socket.emit('joinGame', { sessionId });

    socket.on('playerJoined', ({ session: s }: any) => setSession(s));
    socket.on('gameStarted', ({ session: s }: any) => setSession(s));
    socket.on('gameChanged', ({ session: s }: any) => { setSession(s); setShowGameChanger(false); });
    socket.on('gameUpdate', (data: any) => {
      setSession((prev: any) => prev ? { ...prev, state: data.state, status: data.status, winnerId: data.winnerId } : prev);
    });
    socket.on('rpsChosen', () => {});
    socket.on('rpsResult', (data: any) => {
      setSession((prev: any) => prev ? { ...prev, state: { ...prev.state, scores: data.scores, round: data.round }, status: data.status, winnerId: data.winnerId } : prev);
    });

    return () => {
      socket.off('playerJoined');
      socket.off('gameStarted');
      socket.off('gameChanged');
      socket.off('gameUpdate');
      socket.off('rpsChosen');
      socket.off('rpsResult');
    };
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const { data } = await gamesAPI.getSession(sessionId);
      setSession(data);
    } catch {} finally { setLoading(false); }
  };

  const handleJoin = async () => {
    try {
      const { data } = await gamesAPI.join(sessionId);
      setSession(data);
      const socket = getSocket();
      if (socket) socket.emit('joinGame', { sessionId });
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to join'); }
  };

  const handleStart = async () => {
    try { const { data } = await gamesAPI.start(sessionId); setSession(data); } catch {}
  };
  const handleRematch = async () => {
    try { const { data } = await gamesAPI.rematch(sessionId); setSession(data); } catch {}
  };
  const handleChangeGame = async (gameType: string) => {
    try { const { data } = await gamesAPI.changeGame(sessionId, gameType); setSession(data); setShowGameChanger(false); } catch {}
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;
  if (!session) return <div style={{ padding: 40, textAlign: 'center' }}><h2>Game not found</h2></div>;

  const isHost = session.player1Id === user?.id;
  const isPlayer = session.player1Id === user?.id || session.player2Id === user?.id;
  const opponent = isHost ? session.player2 : session.player1;
  const gameInfo = GAME_INFO[session.gameType] || { name: session.gameType, icon: '🎮', color: '#888' };

  // ============ WAITING STATE ============
  if (session.status === 'WAITING') {
    return (
      <div className={styles.roomPage}>
        <div className={styles.waitingRoom}>
          <div className={styles.waitingIcon} style={{ background: `${gameInfo.color}20`, color: gameInfo.color }}>
            {gameInfo.icon}
          </div>
          <h1 className={styles.waitingTitle}>{gameInfo.name}</h1>

          <div className={styles.playersRow}>
            <div className={styles.playerSlot}>
              {session.player1?.avatar ? (
                <img src={`${UPLOADS_URL}${session.player1.avatar}`} alt="" className={styles.playerAvatar} />
              ) : (
                <div className={styles.playerAvatarFallback}>{session.player1?.name?.[0]}</div>
              )}
              <span>{session.player1?.username}</span>
              {isHost && <span className={styles.hostBadge}>Host</span>}
            </div>

            <div className={styles.vsText}>VS</div>

            <div className={styles.playerSlot}>
              {session.player2 ? (
                <>
                  {session.player2.avatar ? (
                    <img src={`${UPLOADS_URL}${session.player2.avatar}`} alt="" className={styles.playerAvatar} />
                  ) : (
                    <div className={styles.playerAvatarFallback}>{session.player2.name?.[0]}</div>
                  )}
                  <span>{session.player2.username}</span>
                </>
              ) : (
                <>
                  <div className={styles.emptySlot}>?</div>
                  <span className={styles.waitingText}>Waiting...</span>
                </>
              )}
            </div>
          </div>

          {!isPlayer && !session.player2Id && (
            <button className="btn btn-primary" onClick={handleJoin} style={{ marginTop: 24, fontSize: 16, padding: '14px 40px' }}>
              🎮 Join Game
            </button>
          )}

          {isHost && session.player2Id && (
            <button className={styles.startBtn} onClick={handleStart}>
              ▶️ Start Game
            </button>
          )}

          {isHost && !session.player2Id && (
            <p className={styles.waitingHint}>Share this room with your friend or invite from chat!</p>
          )}

          <div className={styles.waitingActions}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowGameChanger(true)}>🔄 Change Game</button>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push('/messages')}>← Back to Chat</button>
          </div>

          {showGameChanger && (
            <div className={styles.gameChangerGrid}>
              {ALL_GAMES.map(g => (
                <button key={g} className={`${styles.gameChangerItem} ${session.gameType === g ? styles.gameChangerActive : ''}`} onClick={() => handleChangeGame(g)}>
                  <span>{GAME_INFO[g].icon}</span>
                  <span>{GAME_INFO[g].name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ FINISHED STATE ============
  if (session.status === 'FINISHED') {
    const won = session.winnerId === user?.id;
    const draw = !session.winnerId;
    return (
      <div className={styles.roomPage}>
        <div className={styles.resultScreen}>
          <div className={styles.resultEmoji}>{draw ? '🤝' : won ? '🎉' : '😔'}</div>
          <h1 className={styles.resultTitle}>{draw ? 'Draw!' : won ? 'You Won!' : 'You Lost'}</h1>
          <p className={styles.resultSub}>{gameInfo.name} vs {opponent?.username}</p>

          <div className={styles.resultActions}>
            <button className={styles.startBtn} onClick={handleRematch}>🔁 Rematch</button>
            <button className="btn btn-secondary" onClick={() => setShowGameChanger(true)}>🔄 Change Game</button>
            <button className="btn btn-secondary" onClick={() => router.push('/messages')}>← Leave</button>
          </div>

          {showGameChanger && (
            <div className={styles.gameChangerGrid}>
              {ALL_GAMES.map(g => (
                <button key={g} className={`${styles.gameChangerItem} ${session.gameType === g ? styles.gameChangerActive : ''}`} onClick={() => handleChangeGame(g)}>
                  <span>{GAME_INFO[g].icon}</span>
                  <span>{GAME_INFO[g].name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ ACTIVE STATE ============
  return (
    <div className={styles.roomPage}>
      <div className={styles.gameHeader}>
        <span className={styles.gameHeaderIcon}>{gameInfo.icon}</span>
        <h2>{gameInfo.name}</h2>
        <span className={styles.liveTag}>● LIVE</span>
      </div>

      {session.gameType === 'TIC_TAC_TOE' && <TicTacToeGame session={session} user={user} />}
      {session.gameType === 'ROCK_PAPER_SCISSORS' && <RPSGame session={session} user={user} />}
      {session.gameType === 'CHESS' && <ChessGame session={session} user={user} />}
      {session.gameType === 'FLAPPY_BIRD' && <FlappyBirdGame session={session} user={user} />}
      {session.gameType === 'LUDO' && <LudoGame session={session} user={user} />}
      {session.gameType === 'GUESS_THE_WORD' && <GuessTheWordGame session={session} user={user} />}
    </div>
  );
}

// ==================== TIC TAC TOE ====================
function TicTacToeGame({ session, user }: any) {
  const handleMove = (index: number) => {
    const socket = getSocket();
    if (socket) socket.emit('tttMove', { sessionId: session.id, index });
  };
  const myTurn = session.state.currentTurn === user?.id;
  return (
    <div className={styles.gameArea}>
      <p className={styles.turnText}>{myTurn ? "✨ Your turn!" : "⏳ Opponent's turn..."}</p>
      <div className={styles.tttBoard}>
        {session.state.board.map((cell: string | null, i: number) => (
          <button key={i} className={`${styles.tttCell} ${cell === 'X' ? styles.cellX : cell === 'O' ? styles.cellO : ''}`}
            onClick={() => handleMove(i)} disabled={!!cell || !myTurn}>
            {cell}
          </button>
        ))}
      </div>
    </div>
  );
}

// ==================== ROCK PAPER SCISSORS ====================
function RPSGame({ session, user }: any) {
  const handleChoice = (choice: string) => {
    const socket = getSocket();
    if (socket) socket.emit('rpsChoice', { sessionId: session.id, choice });
  };
  const isP1 = session.player1Id === user?.id;
  return (
    <div className={styles.gameArea}>
      <p className={styles.turnText}>
        Score: You {isP1 ? session.state.scores?.p1 : session.state.scores?.p2} - {isP1 ? session.state.scores?.p2 : session.state.scores?.p1} Opponent | Round {session.state.round}
      </p>
      <div className={styles.rpsChoices}>
        {['rock', 'paper', 'scissors'].map(c => (
          <button key={c} className={styles.rpsBtn} onClick={() => handleChoice(c)}>
            <span className={styles.rpsIcon}>{c === 'rock' ? '🪨' : c === 'paper' ? '📄' : '✂️'}</span>
            <span>{c.charAt(0).toUpperCase() + c.slice(1)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ==================== CHESS ====================
function ChessGame({ session, user }: any) {
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const isP1 = session.player1Id === user?.id;
  const myColor = isP1 ? 'w' : 'b';
  const myTurn = session.state.currentTurn === user?.id;
  const board = isP1 ? session.state.board : [...session.state.board].reverse().map((row: any[]) => [...row].reverse());

  const pieceSymbols: Record<string, string> = {
    wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
    bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
  };

  const handleClick = (row: number, col: number) => {
    if (!myTurn) return;
    const actualRow = isP1 ? row : 7 - row;
    const actualCol = isP1 ? col : 7 - col;
    const piece = session.state.board[actualRow][actualCol];

    if (selected) {
      // Move
      const socket = getSocket();
      if (socket) socket.emit('chessMove', { sessionId: session.id, from: selected, to: { row: actualRow, col: actualCol } });
      setSelected(null);
    } else if (piece && piece[0] === myColor) {
      setSelected({ row: actualRow, col: actualCol });
    }
  };

  const isSelected = (row: number, col: number) => {
    if (!selected) return false;
    const actualRow = isP1 ? row : 7 - row;
    const actualCol = isP1 ? col : 7 - col;
    return selected.row === actualRow && selected.col === actualCol;
  };

  return (
    <div className={styles.gameArea}>
      <p className={styles.turnText}>{myTurn ? "✨ Your turn!" : "⏳ Opponent's turn..."}</p>
      <div className={styles.chessBoard}>
        {board.map((row: any[], r: number) => (
          row.map((cell: string | null, c: number) => (
            <button key={`${r}-${c}`}
              className={`${styles.chessCell} ${(r + c) % 2 === 0 ? styles.chessLight : styles.chessDark} ${isSelected(r, c) ? styles.chessSelected : ''}`}
              onClick={() => handleClick(r, c)}>
              {cell && <span className={styles.chessPiece}>{pieceSymbols[cell] || ''}</span>}
            </button>
          ))
        ))}
      </div>
    </div>
  );
}

// ==================== FLAPPY BIRD ====================
function FlappyBirdGame({ session, user }: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameActive, setGameActive] = useState(false);
  const [score, setScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const isMyTurn = session.state.currentPlayer === user?.id;
  const isP1 = session.player1Id === user?.id;
  const myScore = isP1 ? session.state.player1Score : session.state.player2Score;

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setGameActive(true);
    setScore(0);
    let birdY = 200, birdVel = 0;
    const gravity = 0.4, jump = -7;
    let pipes: { x: number; gap: number; gapY: number; scored?: boolean }[] = [];
    let frame = 0, sc = 0, dead = false;

    const handleClick = () => { if (!dead) birdVel = jump; };
    const handleKey = (e: KeyboardEvent) => { if (e.code === 'Space' && !dead) { e.preventDefault(); birdVel = jump; } };
    canvas.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKey);

    const loop = () => {
      if (dead) return;
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, 400, 500);

      // Bird
      birdVel += gravity;
      birdY += birdVel;
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(80, birdY, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(95, birdY);
      ctx.lineTo(110, birdY - 5);
      ctx.lineTo(110, birdY + 5);
      ctx.fill();

      // Pipes
      if (frame % 90 === 0) {
        const gapY = 120 + Math.random() * 260;
        pipes.push({ x: 400, gap: 130, gapY });
      }

      ctx.fillStyle = '#10B981';
      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= 2.5;
        ctx.fillRect(p.x, 0, 40, p.gapY - p.gap / 2);
        ctx.fillRect(p.x, p.gapY + p.gap / 2, 40, 500);

        // Collision
        if (80 + 15 > p.x && 80 - 15 < p.x + 40) {
          if (birdY - 15 < p.gapY - p.gap / 2 || birdY + 15 > p.gapY + p.gap / 2) {
            dead = true;
          }
        }
        if (p.x + 40 < 80 && !p.scored) { sc++; p.scored = true; setScore(sc); }
        if (p.x < -40) pipes.splice(i, 1);
      }

      if (birdY > 500 || birdY < 0) dead = true;

      // Score
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px Inter';
      ctx.fillText(`Score: ${sc}`, 150, 40);

      frame++;
      if (!dead) requestAnimationFrame(loop);
      else {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, 400, 500);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 32px Inter';
        ctx.fillText('Game Over!', 120, 230);
        ctx.font = '20px Inter';
        ctx.fillText(`Score: ${sc}`, 160, 270);
        setGameActive(false);
        canvas.removeEventListener('click', handleClick);
        window.removeEventListener('keydown', handleKey);
      }
    };
    requestAnimationFrame(loop);

    return () => {
      canvas.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  const submitScore = () => {
    const socket = getSocket();
    if (socket) { socket.emit('flappyScore', { sessionId: session.id, score }); setSubmitted(true); }
  };

  if (!isMyTurn && myScore === null) {
    return <div className={styles.gameArea}><p className={styles.turnText}>⏳ Waiting for {isP1 ? session.player1?.username : session.player2?.username} to play...</p></div>;
  }

  if (myScore !== null) {
    return <div className={styles.gameArea}><p className={styles.turnText}>✅ Your score: {myScore}. Waiting for opponent...</p></div>;
  }

  return (
    <div className={styles.gameArea}>
      <p className={styles.turnText}>🐦 Your turn! Click or press Space to flap!</p>
      <canvas ref={canvasRef} width={400} height={500} className={styles.flappyCanvas} />
      {!gameActive && !submitted && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
          <button className="btn btn-primary" onClick={startGame}>{score > 0 ? `Submit Score (${score})` : '▶️ Start'}</button>
          {score > 0 && <button className="btn btn-primary" onClick={submitScore}>✅ Submit ({score})</button>}
        </div>
      )}
      {!gameActive && score > 0 && !submitted && (
        <button className="btn btn-secondary" onClick={startGame} style={{ marginTop: 8 }}>🔄 Retry</button>
      )}
    </div>
  );
}

// ==================== LUDO ====================
function LudoGame({ session, user }: any) {
  const isP1 = session.player1Id === user?.id;
  const myKey = isP1 ? 'p1' : 'p2';
  const myTurn = session.state.currentTurn === user?.id;

  const handleRoll = () => {
    const socket = getSocket();
    if (socket) socket.emit('ludoRoll', { sessionId: session.id });
  };

  const handleMove = (tokenIndex: number) => {
    const socket = getSocket();
    if (socket) socket.emit('ludoMove', { sessionId: session.id, tokenIndex });
  };

  const colors = { p1: '#8B5CF6', p2: '#EC4899' };
  const tokens = session.state.tokens;

  return (
    <div className={styles.gameArea}>
      <p className={styles.turnText}>{myTurn ? "🎲 Your turn!" : "⏳ Opponent's turn..."}</p>

      <div className={styles.ludoBoard}>
        <div className={styles.ludoInfo}>
          <div><span style={{ color: colors.p1 }}>●</span> {session.player1?.username}: {session.state.finished?.p1 || 0}/4 home</div>
          <div><span style={{ color: colors.p2 }}>●</span> {session.player2?.username}: {session.state.finished?.p2 || 0}/4 home</div>
        </div>

        {session.state.dice && (
          <div className={styles.diceResult}>🎲 {session.state.dice}</div>
        )}

        {myTurn && !session.state.rolled && (
          <button className={styles.rollBtn} onClick={handleRoll}>🎲 Roll Dice</button>
        )}

        {myTurn && session.state.rolled && (
          <div className={styles.tokenPicker}>
            <p>Pick a token to move:</p>
            <div className={styles.tokenRow}>
              {tokens[myKey].map((pos: number, i: number) => (
                <button key={i} className={styles.tokenBtn} onClick={() => handleMove(i)}
                  style={{ background: colors[myKey], opacity: pos === 57 ? 0.3 : 1 }}
                  disabled={pos === 57}>
                  {pos === 0 ? '🏠' : pos === 57 ? '🏆' : pos}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.ludoTrack}>
          <div className={styles.trackLabel}>Your tokens:</div>
          <div className={styles.tokenRow}>
            {tokens[myKey].map((pos: number, i: number) => (
              <div key={i} className={styles.tokenDisplay} style={{ background: colors[myKey] }}>
                {pos === 0 ? '🏠' : pos === 57 ? '🏆' : pos}
              </div>
            ))}
          </div>
          <div className={styles.trackLabel}>Opponent tokens:</div>
          <div className={styles.tokenRow}>
            {tokens[isP1 ? 'p2' : 'p1'].map((pos: number, i: number) => (
              <div key={i} className={styles.tokenDisplay} style={{ background: colors[isP1 ? 'p2' : 'p1'] }}>
                {pos === 0 ? '🏠' : pos === 57 ? '🏆' : pos}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== GUESS THE WORD ====================
function GuessTheWordGame({ session, user }: any) {
  const [wordInput, setWordInput] = useState('');
  const isSetter = session.state.setter === user?.id;
  const isGuesser = session.state.guesser === user?.id;

  const handleSetWord = () => {
    if (!wordInput.trim()) return;
    const socket = getSocket();
    if (socket) socket.emit('setWord', { sessionId: session.id, word: wordInput.trim() });
    setWordInput('');
  };

  const handleGuess = (letter: string) => {
    const socket = getSocket();
    if (socket) socket.emit('guessLetter', { sessionId: session.id, letter });
  };

  const guessed = session.state.guessedLetters || [];
  const wrongCount = session.state.wrongCount || 0;
  const maxWrong = session.state.maxWrong || 6;
  const wordLength = session.state.wordLength || 0;
  const word = session.state.word;

  // Setting phase
  if (session.state.phase === 'setting') {
    if (isSetter) {
      return (
        <div className={styles.gameArea}>
          <h3 className={styles.turnText}>🔤 Set a word for your opponent to guess!</h3>
          <div style={{ display: 'flex', gap: 12, maxWidth: 400, margin: '20px auto' }}>
            <input className="input" placeholder="Enter a word..." value={wordInput} onChange={e => setWordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSetWord()} style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={handleSetWord}>Set Word</button>
          </div>
        </div>
      );
    }
    return <div className={styles.gameArea}><p className={styles.turnText}>⏳ Waiting for opponent to set a word...</p></div>;
  }

  // Guessing phase
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const displayWord = word
    ? word.split('').map((l: string) => guessed.includes(l) ? l : '_').join(' ')
    : Array(wordLength).fill('_').map((_: string, i: number) => {
        return guessed.find((l: string) => {
          // We don't know the word client-side, use wordLength
          return false;
        }) || '_';
      }).join(' ');

  // Hangman stages
  const hangmanParts = ['😵','🫥','😰','😟','😐','😊'];
  const hangmanFace = hangmanParts[Math.min(wrongCount, 5)];

  return (
    <div className={styles.gameArea}>
      <p className={styles.turnText}>
        {isGuesser ? `Guess the word! (${wrongCount}/${maxWrong} wrong)` : 'Your opponent is guessing...'}
      </p>

      <div className={styles.hangmanArea}>
        <div className={styles.hangmanFace}>{hangmanFace}</div>
        <div className={styles.wrongBar}>
          {Array(maxWrong).fill(0).map((_, i) => (
            <div key={i} className={`${styles.wrongDot} ${i < wrongCount ? styles.wrongDotFilled : ''}`} />
          ))}
        </div>
      </div>

      <div className={styles.wordDisplay}>
        {(word || '').split('').map((l: string, i: number) => (
          <span key={i} className={styles.wordLetter}>
            {guessed.includes(l.toUpperCase()) ? l.toUpperCase() : '_'}
          </span>
        ))}
        {!word && Array(wordLength).fill(0).map((_, i) => (
          <span key={i} className={styles.wordLetter}>_</span>
        ))}
      </div>

      {isGuesser && (
        <div className={styles.alphabetGrid}>
          {alphabet.map(l => (
            <button key={l} className={`${styles.letterBtn} ${guessed.includes(l) ? styles.letterUsed : ''}`}
              onClick={() => handleGuess(l)} disabled={guessed.includes(l)}>
              {l}
            </button>
          ))}
        </div>
      )}

      {isSetter && word && (
        <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--text-muted)', fontSize: 14 }}>
          Your word: <strong style={{ color: 'var(--accent-primary)' }}>{word}</strong>
        </p>
      )}
    </div>
  );
}
