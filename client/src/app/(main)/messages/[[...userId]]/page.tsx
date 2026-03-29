'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { messagesAPI, usersAPI, gamesAPI, UPLOADS_URL } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import Link from 'next/link';
import styles from './messages.module.css';

interface Conversation {
  user: { id: string; username: string; name: string; avatar: string | null; isOnline: boolean };
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  seen: boolean;
  vanishing: boolean;
  createdAt: string;
}

export default function MessagesPage() {
  const params = useParams();
  const router = useRouter();
  const rawUserId = params?.userId;
  const chatUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pendingConversations, setPendingConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatUser, setChatUser] = useState<any>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [vanishing, setVanishing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [chatIsAccepted, setChatIsAccepted] = useState(true);
  const [showRequests, setShowRequests] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<any>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (chatUserId) loadChat(chatUserId);
  }, [chatUserId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('newMessage', (msg: Message) => {
      if (chatUserId && (msg.senderId === chatUserId || msg.receiverId === chatUserId)) {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
        socket.emit('markSeen', { senderId: msg.senderId });
      }
      loadConversations();
    });

    socket.on('messageSent', (msg: Message) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      scrollToBottom();
      loadConversations();
    });

    socket.on('userTyping', ({ userId, isTyping: typing }: any) => {
      if (userId === chatUserId) setIsTyping(typing);
    });

    socket.on('messagesSeen', ({ by }: any) => {
      if (by === chatUserId) {
        setMessages(prev => prev.map(m => m.receiverId === by ? { ...m, seen: true } : m));
      }
    });

    socket.on('messagesVanished', ({ messageIds }: any) => {
      setMessages(prev => prev.filter(m => !messageIds.includes(m.id)));
    });

    return () => {
      socket.off('newMessage');
      socket.off('messageSent');
      socket.off('userTyping');
      socket.off('messagesSeen');
      socket.off('messagesVanished');
    };
  }, [chatUserId]);

  const loadConversations = async () => {
    try {
      const { data } = await messagesAPI.getConversations();
      // Handle new format with conversations + pendingConversations
      if (data.conversations) {
        setConversations(data.conversations);
        setPendingConversations(data.pendingConversations || []);
      } else {
        // Fallback for old format (array)
        setConversations(Array.isArray(data) ? data : []);
      }
    } catch {}
    finally { setLoading(false); }
  };

  const loadChat = async (userId: string) => {
    try {
      const [{ data: msgData }, { data: allUsers }] = await Promise.all([
        messagesAPI.getMessages(userId),
        usersAPI.getAll()
      ]);
      const chatUserData = allUsers.find((u: any) => u.id === userId);
      setChatUser(chatUserData);
      // Handle new format with messages + isAccepted
      if (msgData.messages) {
        setMessages(msgData.messages);
        setChatIsAccepted(msgData.isAccepted !== false);
      } else {
        // Fallback for old format (array)
        setMessages(Array.isArray(msgData) ? msgData : []);
        setChatIsAccepted(true);
      }
      setTimeout(scrollToBottom, 100);
      const socket = getSocket();
      if (socket) socket.emit('markSeen', { senderId: userId });
    } catch {}
  };

  const handleAcceptMessageRequest = async () => {
    if (!chatUserId) return;
    try {
      await messagesAPI.acceptRequest(chatUserId);
      setChatIsAccepted(true);
      loadConversations();
    } catch {}
  };

  const handleDeclineMessageRequest = async () => {
    if (!chatUserId) return;
    try {
      await messagesAPI.declineRequest(chatUserId);
      setMessages([]);
      setChatUser(null);
      loadConversations();
      router.push('/messages');
    } catch {}
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = () => {
    if (!input.trim() || !chatUserId) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('sendMessage', {
      receiverId: chatUserId,
      content: input.trim(),
      vanishing,
    });

    setInput('');
    socket.emit('typing', { receiverId: chatUserId, isTyping: false });
  };

  const handleMediaSend = async (file: File) => {
    if (!chatUserId) return;
    const formData = new FormData();
    formData.append('media', file);
    try {
      const { data } = await messagesAPI.sendMedia(chatUserId, formData);
      setMessages(prev => [...prev, data]);
      scrollToBottom();
      loadConversations();
    } catch (err) { console.error(err); }
  };

  const handleCallFromChat = (type: 'AUDIO' | 'VIDEO') => {
    if (!chatUser) return;
    const provider = (window as any).__callProvider;
    if (provider) {
      provider.initiateCall({
        id: chatUser.id,
        username: chatUser.username,
        name: chatUser.name,
        avatar: chatUser.avatar,
      }, type);
    }
  };

  const handleTyping = () => {
    const socket = getSocket();
    if (!socket || !chatUserId) return;

    socket.emit('typing', { receiverId: chatUserId, isTyping: true });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing', { receiverId: chatUserId, isTyping: false });
    }, 2000);
  };

  const gameOptions = [
    { type: 'TIC_TAC_TOE', name: 'Tic Tac Toe', icon: '⭕' },
    { type: 'ROCK_PAPER_SCISSORS', name: 'Rock Paper Scissors', icon: '✊' },
    { type: 'CHESS', name: 'Chess', icon: '♟️' },
    { type: 'FLAPPY_BIRD', name: 'Flappy Bird', icon: '🐦' },
    { type: 'LUDO', name: 'Ludo', icon: '🎲' },
    { type: 'GUESS_THE_WORD', name: 'Guess the Word', icon: '🔤' },
  ];

  const handleGameInvite = async (gameType: string) => {
    if (!chatUserId) return;
    setShowGamePicker(false);
    try {
      const { data } = await gamesAPI.create(gameType, chatUserId);
      router.push(`/games/${data.id}`);
    } catch (err) { console.error(err); }
  };

  const isGameInvite = (content: string | null) => content?.startsWith('__GAME_INVITE__');

  const parseGameInvite = (content: string) => {
    const parts = content.split('|');
    return { sessionId: parts[1], gameType: parts[2], gameName: parts[3] };
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      const { data } = await usersAPI.search(q);
      setSearchResults(data);
    } catch {}
  };

  const timeAgo = (date: string) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  };

  return (
    <div className={styles.messagesPage}>
      {/* Conversations List */}
      <div className={`${styles.convList} ${chatUserId ? styles.hideOnMobile : ''}`}>
        <div className={styles.convHeader}>
          <h2 className="gradient-text" style={{ fontSize: 22, fontWeight: 800 }}>Messages</h2>
        </div>

        <div className={styles.searchBox}>
          <input
            className="input"
            placeholder="🔍 Search users..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ fontSize: 13 }}
          />
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className={styles.searchResults}>
            {searchResults.map(u => (
              <Link key={u.id} href={`/messages/${u.id}`} className={styles.convItem} onClick={() => { setSearchQuery(''); setSearchResults([]); }}>
                {u.avatar ? (
                  <img src={`${UPLOADS_URL}${u.avatar}`} alt="" className="avatar avatar-md" />
                ) : (
                  <div className={styles.avatarFallback}>{u.name[0]}</div>
                )}
                <div className={styles.convInfo}>
                  <span className={styles.convName}>{u.username}</span>
                  <span className={styles.convPreview}>{u.name}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Conversations */}
        <div className={styles.convItems}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
          ) : (
            <>
              {/* Message Requests Toggle */}
              {pendingConversations.length > 0 && (
                <button className={styles.requestsToggle} onClick={() => setShowRequests(!showRequests)}>
                  <span>📩 Message Requests</span>
                  <span className={styles.requestsBadge}>{pendingConversations.length}</span>
                  <span className={styles.requestsArrow}>{showRequests ? '▼' : '▶'}</span>
                </button>
              )}

              {/* Pending Conversations */}
              {showRequests && pendingConversations.map(conv => (
                <Link key={conv.user.id} href={`/messages/${conv.user.id}`} className={`${styles.convItem} ${styles.convPending} ${chatUserId === conv.user.id ? styles.convActive : ''}`} onClick={() => setShowRequests(false)}>
                  <div className={styles.avatarContainer}>
                    {conv.user.avatar ? (
                      <img src={`${UPLOADS_URL}${conv.user.avatar}`} alt="" className="avatar avatar-md" />
                    ) : (
                      <div className={styles.avatarFallback}>{conv.user.name[0]}</div>
                    )}
                  </div>
                  <div className={styles.convInfo}>
                    <div className={styles.convTop}>
                      <span className={styles.convName}>{conv.user.username}</span>
                      {conv.lastMessage && <span className={styles.convTime}>{timeAgo(conv.lastMessage.createdAt)}</span>}
                    </div>
                    <span className={styles.convPreview} style={{ color: 'var(--accent-primary)', fontStyle: 'italic' }}>
                      📩 Message request
                    </span>
                  </div>
                </Link>
              ))}

              {/* Accepted Conversations */}
              {conversations.length === 0 && pendingConversations.length === 0 ? (
                <div className={styles.emptyConv}>
                  <p>No conversations yet</p>
                  <span>Search for users to start chatting!</span>
                </div>
              ) : (
                conversations.map(conv => (
                  <Link key={conv.user.id} href={`/messages/${conv.user.id}`} className={`${styles.convItem} ${chatUserId === conv.user.id ? styles.convActive : ''}`}>
                    <div className={styles.avatarContainer}>
                      {conv.user.avatar ? (
                        <img src={`${UPLOADS_URL}${conv.user.avatar}`} alt="" className="avatar avatar-md" />
                      ) : (
                        <div className={styles.avatarFallback}>{conv.user.name[0]}</div>
                      )}
                      {conv.user.isOnline && <div className={styles.onlineDot}></div>}
                    </div>
                    <div className={styles.convInfo}>
                      <div className={styles.convTop}>
                        <span className={styles.convName}>{conv.user.username}</span>
                        {conv.lastMessage && <span className={styles.convTime}>{timeAgo(conv.lastMessage.createdAt)}</span>}
                      </div>
                      <span className={styles.convPreview}>
                        {conv.lastMessage ? (() => {
                          const c = conv.lastMessage.content;
                          const prefix = conv.lastMessage.senderId === user?.id ? 'You: ' : '';
                          if (c?.startsWith('__GAME_INVITE__')) {
                            const gameName = c.split('|')[3] || 'Game';
                            return `${prefix}🎮 ${gameName} invite`;
                          }
                          return prefix + (c || '📷 Media');
                        })() : 'Start a conversation'}
                      </span>
                    </div>
                    {conv.unreadCount > 0 && <span className="badge badge-primary">{conv.unreadCount}</span>}
                  </Link>
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`${styles.chatArea} ${!chatUserId ? styles.hideOnMobile : ''}`}>
        {!chatUserId ? (
          <div className={styles.noChatSelected}>
            <div style={{ fontSize: 56 }}>💬</div>
            <h3>Select a conversation</h3>
            <p>Choose a chat from the sidebar to start messaging</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className={styles.chatHeader}>
              <button className={styles.backBtn} onClick={() => router.push('/messages')}>←</button>
              {chatUser && (
                <Link href={`/profile/${chatUser.username}`} className={styles.chatUserInfo}>
                  {chatUser.avatar ? (
                    <img src={`${UPLOADS_URL}${chatUser.avatar}`} alt="" className="avatar avatar-sm" />
                  ) : (
                    <div className={styles.avatarFallbackSm}>{chatUser.name?.[0]}</div>
                  )}
                  <div>
                    <span className={styles.chatUsername}>{chatUser.username}</span>
                    <span className={styles.chatStatus}>
                      {isTyping ? 'typing...' : chatUser.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </Link>
              )}
              <div className={styles.chatActions}>
                <button className="btn btn-ghost btn-icon" title="Audio Call" onClick={() => handleCallFromChat('AUDIO')}>📞</button>
                <button className="btn btn-ghost btn-icon" title="Video Call" onClick={() => handleCallFromChat('VIDEO')}>📹</button>
              </div>
            </div>

            {/* Messages */}
            <div className={styles.messagesArea}>
              {/* Pending Message Request Banner */}
              {!chatIsAccepted && (
                <div className={styles.pendingBanner}>
                  <div className={styles.pendingBannerIcon}>📩</div>
                  <p><strong>{chatUser?.username}</strong> wants to send you a message</p>
                  <div className={styles.pendingBannerActions}>
                    <button className={styles.pendingAccept} onClick={handleAcceptMessageRequest}>Accept</button>
                    <button className={styles.pendingDecline} onClick={handleDeclineMessageRequest}>Decline</button>
                  </div>
                </div>
              )}
            {messages.map(msg => {
              if (isGameInvite(msg.content)) {
                const invite = parseGameInvite(msg.content!);
                return (
                  <div key={msg.id} className={`${styles.message} ${msg.senderId === user?.id ? styles.sent : styles.received}`}>
                    <div className={styles.gameInviteCard}>
                      <div className={styles.gameInviteIcon}>
                        {invite.gameType === 'TIC_TAC_TOE' ? '⭕' : invite.gameType === 'CHESS' ? '♟️' : invite.gameType === 'FLAPPY_BIRD' ? '🐦' : invite.gameType === 'LUDO' ? '🎲' : invite.gameType === 'GUESS_THE_WORD' ? '🔤' : '✊'}
                      </div>
                      <div className={styles.gameInviteText}>
                        <strong>🎮 Game Invite</strong>
                        <span>{invite.gameName}</span>
                      </div>
                      {msg.senderId !== user?.id && (
                        <button className={styles.joinGameBtn} onClick={() => router.push(`/games/${invite.sessionId}`)}>Join Now</button>
                      )}
                      {msg.senderId === user?.id && (
                        <button className={styles.joinGameBtn} onClick={() => router.push(`/games/${invite.sessionId}`)}>Open</button>
                      )}
                    </div>
                    <div className={styles.msgMeta}>
                      <span className={styles.msgTime}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              }
              return (
                <div key={msg.id} className={`${styles.message} ${msg.senderId === user?.id ? styles.sent : styles.received} ${msg.vanishing ? styles.vanishingMsg : ''}`}>
                  {msg.mediaUrl && (
                    msg.mediaType === 'VIDEO' ? (
                      <video src={`${UPLOADS_URL}${msg.mediaUrl}`} controls className={styles.msgMedia} />
                    ) : (
                      <img src={`${UPLOADS_URL}${msg.mediaUrl}`} alt="" className={styles.msgMedia} />
                    )
                  )}
                  {msg.content && <p className={styles.msgText}>{msg.content}</p>}
                  <div className={styles.msgMeta}>
                    <span className={styles.msgTime}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.senderId === user?.id && <span className={styles.msgStatus}>{msg.seen ? '✓✓' : '✓'}</span>}
                    {msg.vanishing && <span className={styles.vanishIcon}>👻</span>}
                  </div>
                </div>
              );
            })}
              {isTyping && <div className={styles.typingIndicator}><span></span><span></span><span></span></div>}
              <div ref={messagesEndRef}></div>
            </div>

            {/* Message Input */}
            <div className={styles.messageInput}>
              <button className={`${styles.vanishToggle} ${vanishing ? styles.vanishActive : ''}`} onClick={() => setVanishing(!vanishing)} title="Vanishing messages">👻</button>
              <button className="btn btn-ghost btn-icon" onClick={() => mediaInputRef.current?.click()} title="Attach media" style={{ fontSize: 16 }}>📎</button>
              <input ref={mediaInputRef} type="file" accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMediaSend(f); e.target.value = ''; }} />
              <div style={{ position: 'relative' }}>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowGamePicker(!showGamePicker)} title="Play a game" style={{ fontSize: 16 }}>🎮</button>
                {showGamePicker && (
                  <div className={styles.gamePickerDropdown}>
                    <div className={styles.gamePickerHeader}>Play a Game</div>
                    {gameOptions.map(g => (
                      <button key={g.type} className={styles.gamePickerItem} onClick={() => handleGameInvite(g.type)}>
                        <span>{g.icon}</span>
                        <span>{g.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                className="input"
                placeholder={vanishing ? '👻 Vanishing message...' : 'Type a message...'}
                value={input}
                onChange={(e) => { setInput(e.target.value); handleTyping(); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                style={{ flex: 1, borderRadius: 'var(--radius-full)' }}
              />
              <button className="btn btn-primary btn-icon" onClick={handleSend} disabled={!input.trim()} style={{ borderRadius: '50%' }}>
                ➤
              </button>
            </div>

            {/* Call UI is now handled globally by CallProvider */}
          </>
        )}
      </div>
    </div>
  );
}
