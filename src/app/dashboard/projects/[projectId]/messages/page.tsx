'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/lib/socket-context';
import { useShell } from '@/components/shell/shell-context';
import {
  projectsApi,
  conversationsApi,
  type ProjectDetail,
  type ProjectMember,
  type Conversation,
  type Message,
} from '@/lib/api';
import { Avatar } from '@/components/shell/avatar';
import { Loader2, Send, MessageSquare, Search, Hash, Circle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  MANAGER: { label: 'MGR', color: 'oklch(0.65 0.15 250)' },
  PENTESTER: { label: 'PEN', color: 'oklch(0.65 0.19 142)' },
  CLIENT: { label: 'CLI', color: 'oklch(0.65 0.15 50)' },
};

export default function MessagesPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { user, token } = useAuth();
  const { socket, onlineUsers, joinProject, leaveProject } = useSocket();
  const { setActiveProject } = useShell();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    joinProject(projectId);
    return () => leaveProject(projectId);
  }, [projectId, joinProject, leaveProject]);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [proj, convs] = await Promise.all([
        projectsApi.getOne(projectId, token),
        conversationsApi.getByProject(projectId, token),
      ]);
      setProject(proj);
      setConversations(convs);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (project) {
      setActiveProject({ id: project.id, slug: project.name, findingsCount: 0 });
    }
    return () => setActiveProject(null);
  }, [project, setActiveProject]);

  const loadMessages = useCallback(async (convId: string) => {
    if (!token) return;
    setLoadingMessages(true);
    try {
      const msgs = await conversationsApi.getMessages(convId, token);
      setMessages(msgs.reverse());
    } catch {
      // ignore
    } finally {
      setLoadingMessages(false);
    }
  }, [token]);

  const openConversation = (conv: Conversation) => {
    setActiveConv(conv);
    loadMessages(conv.id);
  };

  const startConversation = async (member: ProjectMember) => {
    if (!token || !user) return;
    try {
      const conv = await conversationsApi.getOrCreate(projectId, member.user.id, token);
      const fullConv: Conversation = {
        id: conv.id,
        projectId: conv.projectId,
        user1: conv.user1,
        user2: conv.user2,
        lastMessage: null,
        updatedAt: new Date().toISOString(),
      };
      setConversations((prev) => {
        if (prev.find((c) => c.id === fullConv.id)) return prev;
        return [fullConv, ...prev];
      });
      setActiveConv(fullConv);
      loadMessages(fullConv.id);
    } catch {
      // ignore
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeConv || !socket) return;
    const content = input.trim();
    setInput('');
    setSending(true);

    socket.emit('send-message', {
      conversationId: activeConv.id,
      content,
    });

    socket.emit('stop-typing', {
      conversationId: activeConv.id,
      projectId,
    });

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    setSending(false);
  };

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === msg.conversationId
            ? { ...c, lastMessage: msg, updatedAt: msg.createdAt }
            : c,
        ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      );
    };

    const handleTyping = (data: { userId: string; conversationId: string; user: { firstName: string; lastName: string } }) => {
      if (data.userId === user?.id) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(data.userId, `${data.user.firstName}`);
        return next;
      });
    };

    const handleStopTyping = (data: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });
    };

    socket.on('new-message', handleNewMessage);
    socket.on('user-typing', handleTyping);
    socket.on('user-stop-typing', handleStopTyping);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('user-typing', handleTyping);
      socket.off('user-stop-typing', handleStopTyping);
    };
  }, [socket, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (socket && activeConv) {
      socket.emit('typing', { conversationId: activeConv.id, projectId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop-typing', { conversationId: activeConv.id, projectId });
      }, 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getOtherUser = (conv: Conversation) => {
    if (!user) return conv.user1;
    return conv.user1.id === user.id ? conv.user2 : conv.user1;
  };

  const getMemberRole = (userId: string): string | null => {
    const member = project?.members?.find((m) => m.user.id === userId);
    return member?.role || null;
  };

  const members = project?.members || [];
  const membersWithoutConvo = members.filter(
    (m) =>
      m.user.id !== user?.id &&
      !conversations.find(
        (c) => c.user1.id === m.user.id || c.user2.id === m.user.id,
      ),
  );

  const filteredConversations = conversations.filter((c) => {
    if (!searchFilter) return true;
    const other = getOtherUser(c);
    const name = `${other.firstName} ${other.lastName}`.toLowerCase();
    return name.includes(searchFilter.toLowerCase());
  });

  const filteredNewMembers = membersWithoutConvo.filter((m) => {
    if (!searchFilter) return true;
    const name = `${m.user.firstName} ${m.user.lastName}`.toLowerCase();
    return name.includes(searchFilter.toLowerCase());
  });

  const onlineCount = members.filter((m) => m.user.id !== user?.id && onlineUsers.has(m.user.id)).length;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const otherUser = activeConv ? getOtherUser(activeConv) : null;
  const otherRole = otherUser ? getMemberRole(otherUser.id) : null;
  const otherOnline = otherUser ? onlineUsers.has(otherUser.id) : false;

  return (
    <div className="flex flex-1 overflow-hidden" style={{ height: '100%' }}>
      {/* ── Panel gauche : conversations ── */}
      <div
        className="flex flex-col"
        style={{
          width: 300,
          flexShrink: 0,
          borderRight: '1px solid var(--border-subtle)',
          background: 'var(--bg)',
        }}
      >
        {/* Panel header */}
        <div style={{ padding: '16px 16px 12px' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>
              Messages
            </h2>
            {onlineCount > 0 && (
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  color: 'oklch(0.72 0.19 142)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Circle size={6} fill="currentColor" />
                {onlineCount} en ligne
              </span>
            )}
          </div>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: 10,
                color: 'var(--fg-subtle)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Rechercher…"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 30px',
                fontSize: 12.5,
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                color: 'var(--fg)',
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </div>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filteredConversations.map((conv) => {
            const other = getOtherUser(conv);
            const isOnline = onlineUsers.has(other.id);
            const isActive = activeConv?.id === conv.id;
            const role = getMemberRole(other.id);
            const badge = role ? ROLE_BADGE[role] : null;

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => openConversation(conv)}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  width: '100%',
                  padding: '10px 16px',
                  background: isActive
                    ? 'linear-gradient(90deg, oklch(from var(--accent) l c h / 0.08), transparent)'
                    : 'transparent',
                  border: 'none',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--bg-subtle)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar user={{ id: other.id, name: `${other.firstName} ${other.lastName}` }} size="lg" />
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: isOnline ? 'oklch(0.72 0.19 142)' : 'var(--fg-subtle)',
                      opacity: isOnline ? 1 : 0.3,
                      border: '2px solid var(--bg)',
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {other.firstName} {other.lastName}
                    </span>
                    {badge && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          padding: '1px 4px',
                          borderRadius: 'var(--r-sm)',
                          background: badge.color,
                          color: 'white',
                          fontWeight: 600,
                          lineHeight: 1.4,
                          flexShrink: 0,
                        }}
                      >
                        {badge.label}
                      </span>
                    )}
                    <span
                      className="mono"
                      style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-subtle)', flexShrink: 0 }}
                    >
                      {conv.lastMessage ? formatTime(conv.lastMessage.createdAt) : ''}
                    </span>
                  </div>
                  <p style={{
                    fontSize: 12,
                    color: 'var(--fg-muted)',
                    margin: '2px 0 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {conv.lastMessage ? (
                      <>
                        {conv.lastMessage.sender.id === user?.id && (
                          <span style={{ color: 'var(--fg-subtle)' }}>Vous : </span>
                        )}
                        {conv.lastMessage.content}
                      </>
                    ) : (
                      <span style={{ opacity: 0.4 }}>Pas encore de messages</span>
                    )}
                  </p>
                </div>
              </button>
            );
          })}

          {/* New conversations */}
          {filteredNewMembers.length > 0 && (
            <>
              <div
                className="cap mono"
                style={{
                  padding: '14px 16px 6px',
                  fontSize: 10,
                  color: 'var(--fg-subtle)',
                  letterSpacing: '0.06em',
                }}
              >
                Nouveau
              </div>
              {filteredNewMembers.map((m) => {
                const isOnline = onlineUsers.has(m.user.id);
                const badge = ROLE_BADGE[m.role];
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => startConversation(m)}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      width: '100%',
                      padding: '8px 16px',
                      background: 'transparent',
                      border: 'none',
                      borderLeft: '2px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'background 0.12s',
                      opacity: 0.7,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-subtle)';
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.opacity = '0.7';
                    }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar user={{ id: m.user.id, name: `${m.user.firstName} ${m.user.lastName}` }} />
                      {isOnline && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: -1,
                            right: -1,
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: 'oklch(0.72 0.19 142)',
                            border: '2px solid var(--bg)',
                          }}
                        />
                      )}
                    </div>
                    <span style={{ fontSize: 12.5, color: 'var(--fg)', fontWeight: 400 }}>
                      {m.user.firstName} {m.user.lastName}
                    </span>
                    {badge && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          padding: '1px 4px',
                          borderRadius: 'var(--r-sm)',
                          background: badge.color,
                          color: 'white',
                          fontWeight: 600,
                          lineHeight: 1.4,
                        }}
                      >
                        {badge.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {filteredConversations.length === 0 && filteredNewMembers.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', color: 'var(--fg-subtle)' }}>
              <Search size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
              <span style={{ fontSize: 12.5 }}>Aucun résultat</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Zone de chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-subtle)' }}>
        {activeConv && otherUser ? (
          <>
            {/* Chat header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 20px',
                background: 'var(--bg)',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ position: 'relative' }}>
                <Avatar user={{ id: otherUser.id, name: `${otherUser.firstName} ${otherUser.lastName}` }} size="lg" />
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: otherOnline ? 'oklch(0.72 0.19 142)' : 'var(--fg-subtle)',
                    opacity: otherOnline ? 1 : 0.3,
                    border: '2px solid var(--bg)',
                  }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>
                    {otherUser.firstName} {otherUser.lastName}
                  </span>
                  {otherRole && ROLE_BADGE[otherRole] && (
                    <span
                      className="mono"
                      style={{
                        fontSize: 9,
                        padding: '1px 5px',
                        borderRadius: 'var(--r-sm)',
                        background: ROLE_BADGE[otherRole].color,
                        color: 'white',
                        fontWeight: 600,
                      }}
                    >
                      {ROLE_BADGE[otherRole].label}
                    </span>
                  )}
                </div>
                <span className="mono" style={{ fontSize: 11, color: otherOnline ? 'oklch(0.72 0.19 142)' : 'var(--fg-subtle)' }}>
                  {otherOnline ? 'En ligne' : 'Hors ligne'}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
              {loadingMessages ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--fg-subtle)' }} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fg-subtle)' }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 'var(--r-lg)',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <Hash size={24} style={{ opacity: 0.4 }} />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg-muted)', marginBottom: 4 }}>
                    Début de la conversation
                  </p>
                  <p style={{ fontSize: 12, opacity: 0.5 }}>
                    avec {otherUser.firstName} {otherUser.lastName}
                  </p>
                </div>
              ) : (
                <div>
                  {messages.map((msg, i) => {
                    const isMe = msg.senderId === user?.id;
                    const prev = i > 0 ? messages[i - 1] : null;
                    const showAvatar = !prev || prev.senderId !== msg.senderId;
                    const showTime = !prev || new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 300000;
                    const isGroupStart = !prev || prev.senderId !== msg.senderId || showTime;

                    return (
                      <div key={msg.id}>
                        {showTime && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            margin: i === 0 ? '0 0 16px' : '24px 0 16px',
                          }}>
                            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                            <span className="mono" style={{ fontSize: 10, color: 'var(--fg-subtle)', flexShrink: 0 }}>
                              {formatFullTime(msg.createdAt)}
                            </span>
                            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                          </div>
                        )}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: isMe ? 'flex-end' : 'flex-start',
                            marginTop: isGroupStart && !showTime ? 12 : 2,
                          }}
                        >
                          {/* Avatar slot */}
                          {!isMe && (
                            <div style={{ width: 30, marginRight: 8, flexShrink: 0 }}>
                              {showAvatar && (
                                <Avatar user={{ id: msg.sender.id, name: `${msg.sender.firstName} ${msg.sender.lastName}` }} />
                              )}
                            </div>
                          )}

                          <div style={{ maxWidth: '65%' }}>
                            {/* Sender name */}
                            {!isMe && showAvatar && (
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 3 }}>
                                {msg.sender.firstName} {msg.sender.lastName}
                                <span className="mono" style={{ fontSize: 10, color: 'var(--fg-subtle)', fontWeight: 400, marginLeft: 6 }}>
                                  {formatHour(msg.createdAt)}
                                </span>
                              </div>
                            )}

                            {/* Bubble */}
                            <div
                              style={{
                                padding: '8px 14px',
                                borderRadius: isMe
                                  ? isGroupStart ? '14px 14px 4px 14px' : '14px 4px 4px 14px'
                                  : isGroupStart ? '14px 14px 14px 4px' : '4px 14px 14px 4px',
                                background: isMe
                                  ? 'var(--accent)'
                                  : 'var(--bg)',
                                color: isMe ? 'white' : 'var(--fg)',
                                fontSize: 13,
                                lineHeight: 1.55,
                                wordBreak: 'break-word',
                                boxShadow: isMe
                                  ? 'none'
                                  : '0 1px 2px oklch(0 0 0 / 0.04)',
                                border: isMe ? 'none' : '1px solid var(--border-subtle)',
                              }}
                            >
                              {msg.content}
                            </div>

                            {/* Timestamp for own messages on group start */}
                            {isMe && showAvatar && (
                              <div style={{ textAlign: 'right', marginTop: 2 }}>
                                <span className="mono" style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>
                                  {formatHour(msg.createdAt)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {/* Typing indicator */}
              {typingUsers.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingLeft: 38 }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', opacity: 0.6, animation: 'bounce 1.2s infinite' }} />
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', opacity: 0.6, animation: 'bounce 1.2s infinite 0.15s' }} />
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', opacity: 0.6, animation: 'bounce 1.2s infinite 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                    {Array.from(typingUsers.values()).join(', ')} écrit…
                  </span>
                </div>
              )}
            </div>

            {/* Input */}
            <div
              style={{
                padding: '12px 20px 16px',
                background: 'var(--bg)',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 10,
                  padding: '6px 6px 6px 14px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-lg)',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-ring)';
                }}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Écrire un message…"
                  rows={1}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--fg)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    resize: 'none',
                    outline: 'none',
                    padding: '4px 0',
                    maxHeight: 120,
                    minHeight: 24,
                    fontFamily: 'inherit',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--r-md)',
                    border: 'none',
                    background: input.trim() ? 'var(--accent)' : 'var(--bg-subtle)',
                    color: input.trim() ? 'white' : 'var(--fg-subtle)',
                    cursor: input.trim() ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'background 0.15s, color 0.15s, transform 0.1s',
                  }}
                  onMouseDown={(e) => {
                    if (input.trim()) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)';
                  }}
                  onMouseUp={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                  }}
                >
                  <Send size={15} />
                </button>
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--fg-subtle)', marginTop: 6, paddingLeft: 2, opacity: 0.5 }}>
                Entrée pour envoyer &middot; Shift+Entrée pour un retour à la ligne
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--fg-subtle)',
            gap: 8,
          }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 'var(--r-xl)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
              }}
            >
              <MessageSquare size={28} style={{ opacity: 0.3 }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg-muted)' }}>
              Sélectionnez une conversation
            </p>
            <p style={{ fontSize: 12, opacity: 0.5 }}>
              ou démarrez-en une depuis la liste
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) {
    return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function formatHour(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatFullTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday) {
    return `Aujourd'hui, ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Hier, ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
