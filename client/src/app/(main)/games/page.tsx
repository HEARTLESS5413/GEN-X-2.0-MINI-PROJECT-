'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { gamesAPI, UPLOADS_URL } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useRouter } from 'next/navigation';
import styles from './games.module.css';

const GAME_INFO: Record<string, { name: string; icon: string; color: string; desc: string }> = {
  TIC_TAC_TOE: { name: 'Tic Tac Toe', icon: '⭕', color: '#8B5CF6', desc: 'Classic 3x3 strategy' },
  ROCK_PAPER_SCISSORS: { name: 'Rock Paper Scissors', icon: '✊', color: '#EC4899', desc: 'Best of 3 showdown' },
  CHESS: { name: 'Chess', icon: '♟️', color: '#F59E0B', desc: 'The ultimate strategy game' },
  FLAPPY_BIRD: { name: 'Flappy Bird', icon: '🐦', color: '#10B981', desc: 'Tap to fly, beat the score' },
  LUDO: { name: 'Ludo', icon: '🎲', color: '#3B82F6', desc: 'Roll dice, race to finish' },
  GUESS_THE_WORD: { name: 'Guess the Word', icon: '🔤', color: '#EF4444', desc: 'Hangman-style word game' },
};

export default function GamesPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [activeGames, setActiveGames] = useState<any[]>([]);

  useEffect(() => {
    loadHistory();
    const socket = getSocket();
    if (!socket) return;

    socket.on('gameInvite', ({ session }: any) => {
      const info = GAME_INFO[session.gameType];
      if (confirm(`${session.player1.username} invited you to play ${info?.name || session.gameType}! Join now?`)) {
        router.push(`/games/${session.id}`);
      }
    });

    return () => { socket?.off('gameInvite'); };
  }, []);

  const loadHistory = async () => {
    try {
      const { data } = await gamesAPI.getHistory();
      setActiveGames(data.filter((g: any) => g.status === 'WAITING' || g.status === 'ACTIVE'));
      setGameHistory(data.filter((g: any) => g.status === 'FINISHED'));
    } catch {}
  };

  const handleCreateGame = async (gameType: string) => {
    try {
      const { data } = await gamesAPI.create(gameType, null as any);
      router.push(`/games/${data.id}`);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to create game');
    }
  };

  return (
    <div className={styles.gamesPage}>
      <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>🎮 Games</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>
        Start a game from any chat using the 🎮 button, or rejoin active games below.
      </p>

      {/* Active Games */}
      {activeGames.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>🔴 Active Games</h2>
          <div className={styles.activeList}>
            {activeGames.map(game => {
              const info = GAME_INFO[game.gameType];
              const opponent = game.player1Id === user?.id ? game.player2 : game.player1;
              return (
                <div key={game.id} className={styles.activeItem} onClick={() => router.push(`/games/${game.id}`)}>
                  <div className={styles.activeIcon} style={{ background: `${info.color}20`, color: info.color }}>{info.icon}</div>
                  <div className={styles.activeInfo}>
                    <strong>{info.name}</strong>
                    <span>vs {opponent?.username || 'Waiting...'} · {game.status}</span>
                  </div>
                  <button className="btn btn-primary btn-sm">Resume</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Games Grid */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>🕹️ Available Games</h2>
        <div className={styles.gameGrid}>
          {Object.entries(GAME_INFO).map(([type, info]) => (
            <div key={type} className={styles.gameCard} onClick={() => handleCreateGame(type)} style={{ cursor: 'pointer' }}>
              <div className={styles.gameIcon} style={{ background: `${info.color}20`, color: info.color }}>{info.icon}</div>
              <h3>{info.name}</h3>
              <p>{info.desc}</p>
              <span className={styles.gameTip} style={{ background: info.color, color: '#fff', borderRadius: '12px', padding: '4px 8px', fontSize: 12, marginTop: 12 }}>Play Now</span>
            </div>
          ))}
        </div>
      </div>

      {/* Game History */}
      {gameHistory.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>📊 Recent Games</h2>
          {gameHistory.slice(0, 15).map(game => {
            const info = GAME_INFO[game.gameType] || { icon: '🎮', name: game.gameType };
            const opponent = game.player1Id === user?.id ? game.player2 : game.player1;
            const won = game.winnerId === user?.id;
            const draw = !game.winnerId;
            return (
              <div key={game.id} className={styles.historyItem}>
                <span className={styles.historyIcon}>{info.icon}</span>
                <div className={styles.historyInfo}>
                  <span>{info.name}</span>
                  <span className={styles.historyResult}>
                    vs {opponent?.username || '???'} — {draw ? 'Draw 🤝' : won ? 'Won 🎉' : 'Lost'}
                  </span>
                </div>
                <span className={`${styles.historyBadge} ${won ? styles.badgeWin : draw ? styles.badgeDraw : styles.badgeLoss}`}>
                  {draw ? 'Draw' : won ? 'Win' : 'Loss'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
