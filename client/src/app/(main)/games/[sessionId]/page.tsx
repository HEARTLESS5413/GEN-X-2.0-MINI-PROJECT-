'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { gamesAPI, usersAPI, UPLOADS_URL } from '@/lib/api';
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
  const [isQueueing, setIsQueueing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);

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
      if (data.status === 'ACTIVE') setIsQueueing(false);
    });
    socket.on('matchFound', (data: any) => {
      setIsQueueing(false);
      if (data.sessionId === sessionId) {
        // P1: we're already on this page, just update the full session
        if (data.session) setSession(data.session);
      } else {
        // P2: redirect to P1's session
        router.push(`/games/${data.sessionId}`);
      }
    });
    socket.on('queueStatus', (data: { isQueueing: boolean }) => {
      setIsQueueing(data.isQueueing);
    });
    socket.on('receiveGameChat', (msg: any) => {
      setChatMessages(prev => [...prev, msg]);
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
      socket.off('matchFound');
      socket.off('queueStatus');
      socket.off('receiveGameChat');
      socket.off('rpsChosen');
      socket.off('rpsResult');
    };
  }, [sessionId, router]);

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

  const handleJoinQueue = () => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('joinRandomQueue', { sessionId, gameType: session.gameType });
  };

  const handleLeaveQueue = () => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('leaveRandomQueue', { gameType: session.gameType });
    setIsQueueing(false);
  };

  const sendChatMsg = (e: any) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const socket = getSocket();
    if (socket) socket.emit('sendGameChat', { sessionId, content: chatInput });
    setChatInput('');
  };

  const fetchFriends = async () => {
    if (!user?.id) return;
    try {
      const [{ data: followersData }, { data: followingData }] = await Promise.all([
        usersAPI.getFollowers(user.id),
        usersAPI.getFollowing(user.id)
      ]);
      const followersList = followersData?.users || followersData || [];
      const followingList = followingData?.users || followingData || [];
      const uniqueFriends = Array.from(new Map([...followersList, ...followingList].map((item: any) => [item.id, item])).values());
      setFriendsList(uniqueFriends);
    } catch (e) {
      console.error('Failed to fetch friends', e);
    }
  };

  const handleOpenInvite = () => {
    setShowInviteModal(true);
    fetchFriends();
  };

  const handleInviteFriend = async (friendId: string) => {
    setInvitingId(friendId);
    try {
      // The fastest way to send a game invite is actually just using the chat API
      // Wait, there is no generic chat API in client. We can emit it via socket!
      const socket = getSocket();
      if (socket) {
        socket.emit('sendMessage', {
          receiverId: friendId,
          content: `__GAME_INVITE__|${sessionId}|${session.gameType}|${GAME_INFO[session.gameType]?.name || session.gameType}`
        });
        alert('Invite sent!');
        setShowInviteModal(false);
      }
    } catch (e) {
      alert('Failed to send invite');
    } finally {
      setInvitingId(null);
    }
  };

  const handleOpenProfile = async () => {
    if (!opponent?.username) return;
    try {
      const { data } = await usersAPI.getProfile(opponent.username);
      setProfileData(data);
      setShowProfile(true);
    } catch {}
  };

  const handleFollowOpponent = async () => {
    if (!profileData?.id) return;
    try {
      const { data } = await usersAPI.follow(profileData.id);
      if (data.action === 'requested') {
        setProfileData((prev: any) => ({ ...prev, isPending: true }));
      } else if (data.action === 'unfollowed') {
        setProfileData((prev: any) => ({ ...prev, isFollowing: false, isPending: false, _count: { ...prev._count, followers: Math.max(0, prev._count.followers - 1) } }));
      }
    } catch {}
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;
  if (!session) return <div style={{ padding: 40, textAlign: 'center' }}><h2>Game not found</h2></div>;

  const isHost = session.player1Id === user?.id;
  const isPlayer = session.player1Id === user?.id || session.player2Id === user?.id;
  const opponent = isHost ? session.player2 : session.player1;
  const gameInfo = GAME_INFO[session.gameType] || { name: session.gameType, icon: '🎮', color: '#888' };
  const isRandomMatch = session.state?.isRandomMatch;
  const oppMaskedUsername = isRandomMatch && session.status === 'ACTIVE' ? 'Random Challenger' : opponent?.username || 'Opponent';
  const oppMaskedAvatar = isRandomMatch && session.status === 'ACTIVE' ? null : opponent?.avatar;

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
                  {oppMaskedAvatar ? (
                    <img src={`${UPLOADS_URL}${oppMaskedAvatar}`} alt="" className={styles.playerAvatar} />
                  ) : (
                    <div className={styles.playerAvatarFallback}>{oppMaskedUsername[0].toUpperCase()}</div>
                  )}
                  <span>{oppMaskedUsername}</span>
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

          {isHost && !session.player2Id && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 32, width: '100%', maxWidth: 300 }}>
              {isQueueing ? (
                <button className="btn btn-secondary" onClick={handleLeaveQueue}>
                  <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  Waiting for random player... (Cancel)
                </button>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={handleOpenInvite}>
                    👋 Invite Friends
                  </button>
                  <button className="btn btn-secondary" onClick={handleJoinQueue}>
                    🎲 Play with Random
                  </button>
                </>
              )}
            </div>
          )}

          {isHost && session.player2Id && (
            <button className={styles.startBtn} onClick={handleStart} style={{ marginTop: 24 }}>
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
          {/* Invite Modal */}
          {showInviteModal && (
            <div className={styles.modalOverlay} onClick={() => setShowInviteModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 16, width: '90%', maxWidth: 400, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0 }}>Invite Friends</h3>
                  <button onClick={() => setShowInviteModal(false)} style={{ background:'none', border:'none', fontSize:24, cursor:'pointer', color: 'var(--text-muted)' }}>×</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto' }}>
                  {friendsList.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No friends found.</p>
                  ) : friendsList.map(friend => (
                    <div key={friend.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {friend.avatar ? (
                          <img src={`${UPLOADS_URL}${friend.avatar}`} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {friend.username[0].toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontWeight: 600 }}>{friend.username}</span>
                      </div>
                      <button 
                        className="btn btn-primary btn-sm" 
                        onClick={() => handleInviteFriend(friend.id)}
                        disabled={invitingId === friend.id}
                      >
                        {invitingId === friend.id ? 'Sending...' : 'Invite'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
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
          <p className={styles.resultSub} style={{ marginBottom: 4 }}>{gameInfo.name} vs</p>
          <div 
            onClick={handleOpenProfile}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--bg-secondary)', padding: '8px 16px', borderRadius: 20, cursor: 'pointer', marginBottom: 24, transition: '0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {opponent?.avatar ? (
              <img src={`${UPLOADS_URL}${opponent.avatar}`} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {opponent?.username?.[0]?.toUpperCase()}
              </div>
            )}
            <span style={{ fontWeight: 600, fontSize: 18 }}>{opponent?.username}</span>
          </div>

          <div className={styles.resultActions}>
            <button className={styles.startBtn} onClick={handleRematch}>🔁 Rematch</button>
            <button className="btn btn-secondary" onClick={() => setShowGameChanger(true)}>🔄 Change Game</button>
            <button className="btn btn-secondary" onClick={() => router.push('/messages')}>← Leave</button>
          </div>

          {/* Floating Profile Modal inside FINISHED explicitly */}
          {showProfile && profileData && (
            <div className={styles.modalOverlay} onClick={() => setShowProfile(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', padding: '24px 32px', borderRadius: 24, width: '90%', maxWidth: 350, boxShadow: '0 10px 40px rgba(0,0,0,0.6)', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowProfile(false)} style={{ background:'none', border:'none', fontSize:24, cursor:'pointer', color: 'var(--text-muted)' }}>×</button>
                </div>
                {profileData.avatar ? (
                  <img src={`${UPLOADS_URL}${profileData.avatar}`} alt="" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 16px', border: '4px solid var(--primary-color)' }} />
                ) : (
                  <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 'bold', margin: '0 auto 16px' }}>
                    {profileData.username[0].toUpperCase()}
                  </div>
                )}
                <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>{profileData.name}</h2>
                <p style={{ margin: '0 0 16px', color: 'var(--text-muted)' }}>@{profileData.username}</p>
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 24 }}>
                  <div><div style={{ fontWeight: 700, fontSize: 18 }}>{profileData._count?.followers || 0}</div><div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Followers</div></div>
                  <div><div style={{ fontWeight: 700, fontSize: 18 }}>{profileData._count?.following || 0}</div><div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Following</div></div>
                </div>

                {!profileData.isFollowing && !profileData.isPending && user?.id !== profileData.id && (
                  <button className="btn btn-primary" onClick={handleFollowOpponent} style={{ width: '100%', padding: '12px', borderRadius: 24, fontWeight: 600 }}>
                    Follow
                  </button>
                )}
                {profileData.isPending && (
                  <button className="btn btn-secondary" disabled style={{ width: '100%', padding: '12px', borderRadius: 24 }}>
                    Requested
                  </button>
                )}
                {profileData.isFollowing && (
                  <button className="btn btn-secondary" disabled style={{ width: '100%', padding: '12px', borderRadius: 24 }}>
                    Following ✓
                  </button>
                )}
              </div>
            </div>
          )}

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
      {/* Game Chat Overlay */}
      <div className={styles.chatOverlayWrapper} style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 999 }}>
        {showChat ? (
          <div style={{ width: 300, height: 400, background: 'var(--bg-card)', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: 12, background: 'var(--primary-color)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Game Chat</span>
              <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 16 }}>▼</button>
            </div>
            <div style={{ flex: 1, padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chatMessages.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: 12, marginTop: 'auto', marginBottom: 'auto' }}>Say hi to your opponent!</p>}
              {chatMessages.map((msg, i) => {
                const isMe = msg.senderId === user?.id;
                return (
                  <div key={i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', background: isMe ? 'var(--primary-color)' : 'var(--bg-secondary)', color: isMe ? 'white' : 'var(--text-primary)', padding: '6px 12px', borderRadius: 16, maxWidth: '85%', fontSize: 14 }}>
                    {msg.content}
                  </div>
                );
              })}
            </div>
            <form onSubmit={sendChatMsg} style={{ padding: 8, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8 }}>
              <input 
                type="text" 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)} 
                placeholder="Message..." 
                style={{ flex: 1, padding: '8px 12px', borderRadius: 20, border: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }} 
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', borderRadius: 20 }}>Send</button>
            </form>
          </div>
        ) : (
          <button onClick={() => setShowChat(true)} className="btn btn-primary" style={{ padding: '12px 20px', borderRadius: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            💬 Chat {chatMessages.length > 0 && `(${chatMessages.length})`}
          </button>
        )}
      </div>

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
  
  const [isRolling, setIsRolling] = useState(false);
  const [displayDice, setDisplayDice] = useState<number | null>(session.state.dice);

  useEffect(() => {
    if (session.state.dice) {
      setDisplayDice(session.state.dice);
    }
  }, [session.state.dice]);

  const handleRoll = () => {
    if (!myTurn || session.state.rolled || isRolling) return;
    setIsRolling(true);
    let spins = 0;
    const interval = setInterval(() => {
      setDisplayDice(Math.floor(Math.random() * 6) + 1);
      spins++;
      // Spin animation for 500ms
      if (spins > 10) {
        clearInterval(interval);
        const finalDice = Math.floor(Math.random() * 6) + 1;
        setDisplayDice(finalDice);
        setIsRolling(false);
        
        const socket = getSocket();
        if (socket) socket.emit('ludoRoll', { sessionId: session.id, selectedDice: finalDice });
      }
    }, 50);
  };

  const handleMove = (tokenIndex: number) => {
    if (!myTurn || !session.state.rolled || isRolling) return;
    const socket = getSocket();
    if (socket) socket.emit('ludoMove', { sessionId: session.id, tokenIndex });
  };

  // Absolute Ludo 52-tile Path Mapping
  const LUDO_PATH = [
    {r:6,c:1}, {r:6,c:2}, {r:6,c:3}, {r:6,c:4}, {r:6,c:5}, // red exit
    {r:5,c:6}, {r:4,c:6}, {r:3,c:6}, {r:2,c:6}, {r:1,c:6}, {r:0,c:6},
    {r:0,c:7}, {r:0,c:8}, // blue area turn
    {r:1,c:8}, {r:2,c:8}, {r:3,c:8}, {r:4,c:8}, {r:5,c:8},
    {r:6,c:9}, {r:6,c:10}, {r:6,c:11}, {r:6,c:12}, {r:6,c:13}, {r:6,c:14}, // yellow start
    {r:7,c:14}, {r:8,c:14}, // yellow turn
    {r:8,c:13}, {r:8,c:12}, {r:8,c:11}, {r:8,c:10}, {r:8,c:9},
    {r:9,c:8}, {r:10,c:8}, {r:11,c:8}, {r:12,c:8}, {r:13,c:8}, {r:14,c:8}, // green start
    {r:14,c:7}, {r:14,c:6}, // green turn
    {r:13,c:6}, {r:12,c:6}, {r:11,c:6}, {r:10,c:6}, {r:9,c:6},
    {r:8,c:5}, {r:8,c:4}, {r:8,c:3}, {r:8,c:2}, {r:8,c:1}, {r:8,c:0}, // red start
    {r:7,c:0}, {r:6,c:0} // final turn into home paths
  ];

  const HOME_PATHS: any = {
    p1: [{r:7,c:1}, {r:7,c:2}, {r:7,c:3}, {r:7,c:4}, {r:7,c:5}, {r:7,c:6}, {r:7,c:7}],
    p2: [{r:7,c:13}, {r:7,c:12}, {r:7,c:11}, {r:7,c:10}, {r:7,c:9}, {r:7,c:8}, {r:7,c:7}],
  };

  const BASE_YARDS: any = {
    p1: [{r:1.5,c:1.5}, {r:1.5,c:3.5}, {r:3.5,c:1.5}, {r:3.5,c:3.5}],
    p2: [{r:10.5,c:10.5}, {r:10.5,c:12.5}, {r:12.5,c:10.5}, {r:12.5,c:12.5}],
  };

  const SAFE_TILES = [0, 8, 13, 21, 26, 34, 39, 47];

  const getTokenCoords = (playerKey: string, pos: number, tokenIndex: number) => {
    if (pos === -1) return BASE_YARDS[playerKey][tokenIndex];
    if (pos >= 0 && pos <= 50) {
      const startIdx = playerKey === 'p1' ? 0 : 26;
      const absIdx = (startIdx + pos) % 52;
      return LUDO_PATH[absIdx];
    }
    if (pos >= 51 && pos <= 57) {
      return HOME_PATHS[playerKey][pos - 51];
    }
    return {r:7,c:7}; // Center fallback
  };

  const canMove = (pos: number) => {
    if (!myTurn || !session.state.rolled || isRolling || !session.state.dice) return false;
    if (pos === -1) return session.state.dice === 6;
    return pos + session.state.dice <= 57;
  };

  const renderDiceFaces = (num: number) => {
    const dots: any = {
      1: ['center'],
      2: ['topLeft', 'bottomRight'],
      3: ['topLeft', 'center', 'bottomRight'],
      4: ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'],
      5: ['topLeft', 'topRight', 'center', 'bottomLeft', 'bottomRight'],
      6: ['topLeft', 'topRight', 'middleLeft', 'middleRight', 'bottomLeft', 'bottomRight']
    };
    return (
      <div className={styles.diceFace}>
        {dots[num]?.map((pos: string) => (
          <div key={pos} className={`${styles.diceDot} ${styles[pos]}`} />
        ))}
      </div>
    );
  };

  const renderBoardGrid = () => {
    const cells = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        // Render 4 corner Bases as block containers
        if (r < 6 && c < 6 && r===0 && c===0) {
          cells.push(<div key={`baseR`} className={styles.ludoBase} style={{ gridArea: '1/1/7/7', background: '#ef4444' }}><div className={styles.ludoBaseInner}><div className={styles.ludoBaseHole}/><div className={styles.ludoBaseHole}/><div className={styles.ludoBaseHole}/><div className={styles.ludoBaseHole}/></div></div>);
        } else if (r < 6 && c > 8 && r===0 && c===9) {
          cells.push(<div key={`baseB`} className={styles.ludoBase} style={{ gridArea: '1/10/7/16', background: '#3b82f6' }}><div className={styles.ludoBaseInner}><div className={styles.ludoBaseHole}/><div className={styles.ludoBaseHole}/><div className={styles.ludoBaseHole}/><div className={styles.ludoBaseHole}/></div></div>);
        } else if (r > 8 && c < 6 && r===9 && c===0) {
          cells.push(<div key={`baseG`} className={styles.ludoBase} style={{ gridArea: '10/1/16/7', background: '#22c55e' }}><div className={styles.ludoBaseInner}><div className={styles.ludoBaseHole}/><div className={styles.ludoBaseHole}/><div className={styles.ludoBaseHole}/><div className={styles.ludoBaseHole}/></div></div>);
        } else if (r > 8 && c > 8 && r===9 && c===9) {
          cells.push(<div key={`baseY`} className={styles.ludoBase} style={{ gridArea: '10/10/16/16', background: '#eab308' }}><div className={styles.ludoBaseInner}><div className={styles.ludoBaseHole}/><div className={styles.ludoBaseHole}/><div className={styles.ludoBaseHole}/><div className={styles.ludoBaseHole}/></div></div>);
        } else if (r >= 6 && r <= 8 && c >= 6 && c <= 8 && r===6 && c===6) {
          cells.push(<div key={`center`} className={styles.ludoCenter} style={{ gridArea: '7/7/10/10' }}></div>);
        }
        
        // Skip rendering small cells inside large mapped blocks
        if ((r<6&&c<6) || (r<6&&c>8) || (r>8&&c<6) || (r>8&&c>8) || (r>=6&&r<=8&&c>=6&&c<=8)) continue;

        // Path styling
        let bg = 'transparent';
        const absIdx = LUDO_PATH.findIndex(p => p.r === r && p.c === c);
        const hasStar = SAFE_TILES.includes(absIdx);
        
        // Home stretches
        if (r === 7 && c >= 1 && c <= 5) bg = '#fca5a5';
        if (r === 7 && c >= 9 && c <= 13) bg = '#fef08a';
        if (c === 7 && r >= 1 && r <= 5) bg = '#93c5fd';
        if (c === 7 && r >= 9 && r <= 13) bg = '#86efac';
        // Star squares
        if (r===6 && c===1) bg = '#fca5a5';
        if (r===1 && c===8) bg = '#93c5fd';
        if (r===8 && c===13) bg = '#fef08a';
        if (r===13 && c===6) bg = '#86efac';

        cells.push(
          <div key={`cell-${r}-${c}`} className={styles.ludoCell} style={{ gridArea: `${r+1}/${c+1}/${r+2}/${c+2}`, background: bg }}>
            {hasStar ? <span className={styles.ludoStar}>⭐</span> : null}
          </div>
        );
      }
    }
    return cells;
  };

  return (
    <div className={styles.gameArea}>
      <div className={styles.ludoHeader}>
        <div className={styles.p1Tag}>{session.player1?.username} {session.state.finished?.p1 >= 4 && '🏆'}</div>
        <div className={styles.turnText} style={{ margin: 0, fontSize: 18 }}>
          {myTurn ? "🎲 Your turn!" : "⏳ Opponent's turn"}
        </div>
        <div className={styles.p2Tag}>{session.player2?.username} {session.state.finished?.p2 >= 4 && '🏆'}</div>
      </div>

      <div className={styles.ludoWrapper}>
        <div className={styles.ludoGrid}>{renderBoardGrid()}</div>
        
        {/* Render Tokens dynamically on top of grid absolute */}
        {['p1', 'p2'].map((key) => {
          return session.state.tokens[key].map((pos: number, i: number) => {
            const coords = getTokenCoords(key, pos, i);
            const moveAllowed = myTurn && key === myKey && canMove(pos);
            const tokenClass = key === 'p1' ? styles.tokenP1 : styles.tokenP2;
            const isFinished = pos === 57;
            
            return (
              <div 
                key={`${key}-${i}`} 
                className={`${styles.ludoToken} ${tokenClass} ${moveAllowed ? styles.tokenCanMove : ''}`}
                style={{ 
                  top: `${(coords.r + 0.5) * 100 / 15}%`, 
                  left: `${(coords.c + 0.5) * 100 / 15}%`,
                  display: isFinished ? 'none' : 'block'
                }}
                onClick={() => moveAllowed && handleMove(i)}
                title={isFinished ? 'Finished!' : `Pos: ${pos}`}
              />
            );
          });
        })}
      </div>

      <div className={styles.diceContainer}>
        {session.state.consecutiveSixes > 0 && <span style={{fontSize: 14, color: '#ef4444', fontWeight:800}}>🔥 Rolling streak: {session.state.consecutiveSixes} !</span>}
        <button 
          className={`${styles.diceCube} ${isRolling ? styles.diceSpinning : ''}`} 
          onClick={handleRoll}
          disabled={!myTurn || session.state.rolled || isRolling}
        >
          {displayDice ? renderDiceFaces(displayDice) : '🎲'}
        </button>
        <span style={{fontSize: 13, color: 'var(--text-muted)'}}>
          {!myTurn ? 'Waiting for opponent...' : !session.state.rolled ? 'Click dice to roll' : 'Pick a glowing token to move'}
        </span>
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
