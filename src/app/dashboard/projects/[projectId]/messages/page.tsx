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
import { Loader2, Send, MessageSquare, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 sm:px-8 pt-4 sm:pt-6 pb-4 border-b border-border">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-muted-foreground mb-1"
            onClick={() => router.push(`/dashboard/projects/${projectId}`)}
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            {project?.name || '…'}
          </Button>
          <h1 className="text-2xl font-bold">Messages</h1>
        </div>
      </div>

      {/* Main content: sidebar + chat */}
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <div
          className="flex flex-col border-r border-border"
          style={{ width: 320, flexShrink: 0 }}
        >
          {/* Search */}
          <div className="p-3">
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={14}
              />
              <input
                type="text"
                placeholder="Rechercher un membre…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.map((conv) => {
              const other = getOtherUser(conv);
              const isOnline = onlineUsers.has(other.id);
              const isActive = activeConv?.id === conv.id;

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => openConversation(conv)}
                  className="w-full text-left transition-colors"
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    background: isActive ? 'var(--bg-subtle)' : 'transparent',
                    borderTop: 'none',
                    borderRight: 'none',
                    borderBottom: '1px solid var(--border-subtle)',
                    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--bg-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div className="relative shrink-0">
                    <Avatar
                      user={{
                        id: other.id,
                        name: `${other.firstName} ${other.lastName}`,
                      }}
                    />
                    {isOnline && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: -1,
                          right: -1,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'oklch(0.72 0.19 142)',
                          border: '2px solid var(--bg)',
                        }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-sm font-medium truncate"
                        style={{ color: 'var(--fg)' }}
                      >
                        {other.firstName} {other.lastName}
                      </span>
                      {conv.lastMessage && (
                        <span
                          className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2"
                        >
                          {formatTime(conv.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage ? (
                      <p
                        className="text-xs text-muted-foreground truncate mt-0.5"
                        style={{ maxWidth: 200 }}
                      >
                        {conv.lastMessage.sender.id === user?.id ? 'Vous : ' : ''}
                        {conv.lastMessage.content}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 mt-0.5">
                        Aucun message
                      </p>
                    )}
                  </div>
                </button>
              );
            })}

            {/* New conversation starters */}
            {filteredNewMembers.length > 0 && (
              <>
                <div
                  className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-4 pb-2"
                >
                  Démarrer une conversation
                </div>
                {filteredNewMembers.map((m) => {
                  const isOnline = onlineUsers.has(m.user.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => startConversation(m)}
                      className="w-full text-left transition-colors"
                      style={{
                        padding: '8px 12px',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        background: 'transparent',
                        cursor: 'pointer',
                        borderTop: 'none',
                        borderRight: 'none',
                        borderLeft: 'none',
                        borderBottom: '1px solid var(--border-subtle)',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-subtle)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div className="relative shrink-0">
                        <Avatar
                          user={{
                            id: m.user.id,
                            name: `${m.user.firstName} ${m.user.lastName}`,
                          }}
                        />
                        {isOnline && (
                          <span
                            style={{
                              position: 'absolute',
                              bottom: -1,
                              right: -1,
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: 'oklch(0.72 0.19 142)',
                              border: '2px solid var(--bg)',
                            }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span
                          className="text-sm font-medium truncate"
                          style={{ color: 'var(--fg)' }}
                        >
                          {m.user.firstName} {m.user.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {m.role === 'MANAGER'
                            ? 'Manager'
                            : m.role === 'PENTESTER'
                              ? 'Pentester'
                              : 'Client'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </>
            )}

            {filteredConversations.length === 0 && filteredNewMembers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare size={32} className="mb-2 opacity-40" />
                <span className="text-sm">Aucun résultat</span>
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex flex-col flex-1 min-w-0">
          {activeConv ? (
            <>
              {/* Chat header */}
              <div
                className="flex items-center gap-3 px-4 py-3 border-b border-border"
                style={{ background: 'var(--bg)' }}
              >
                <div className="relative">
                  <Avatar
                    user={{
                      id: getOtherUser(activeConv).id,
                      name: `${getOtherUser(activeConv).firstName} ${getOtherUser(activeConv).lastName}`,
                    }}
                    size="lg"
                  />
                  {onlineUsers.has(getOtherUser(activeConv).id) && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: 'oklch(0.72 0.19 142)',
                        border: '2px solid var(--bg)',
                      }}
                    />
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    {getOtherUser(activeConv).firstName}{' '}
                    {getOtherUser(activeConv).lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {onlineUsers.has(getOtherUser(activeConv).id)
                      ? 'En ligne'
                      : 'Hors ligne'}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquare size={40} className="mb-3 opacity-30" />
                    <p className="text-sm">Aucun message pour le moment</p>
                    <p className="text-xs mt-1 opacity-60">
                      Envoyez le premier message !
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {messages.map((msg, i) => {
                      const isMe = msg.senderId === user?.id;
                      const prev = i > 0 ? messages[i - 1] : null;
                      const showAvatar = !prev || prev.senderId !== msg.senderId;
                      const showTime =
                        !prev ||
                        new Date(msg.createdAt).getTime() -
                          new Date(prev.createdAt).getTime() >
                          300000;
                      const isGrouped = prev && prev.senderId === msg.senderId && !showTime;

                      return (
                        <div key={msg.id}>
                          {showTime && (
                            <div className="flex justify-center my-4">
                              <span className="text-[10px] font-mono text-muted-foreground/60 bg-background px-2">
                                {formatFullTime(msg.createdAt)}
                              </span>
                            </div>
                          )}
                          <div
                            className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isGrouped ? '' : 'mt-3'}`}
                          >
                            {!isMe && showAvatar && (
                              <div className="mr-2 mt-1 shrink-0">
                                <Avatar
                                  user={{
                                    id: msg.sender.id,
                                    name: `${msg.sender.firstName} ${msg.sender.lastName}`,
                                  }}
                                />
                              </div>
                            )}
                            {!isMe && !showAvatar && <div className="w-[28px] mr-2 shrink-0" />}
                            <div
                              style={{
                                maxWidth: '70%',
                                padding: '8px 12px',
                                borderRadius: isMe
                                  ? '12px 12px 4px 12px'
                                  : '12px 12px 12px 4px',
                                background: isMe
                                  ? 'var(--accent)'
                                  : 'var(--bg-subtle)',
                                color: isMe ? 'white' : 'var(--fg)',
                                fontSize: 13,
                                lineHeight: 1.5,
                                wordBreak: 'break-word',
                              }}
                            >
                              {!isMe && showAvatar && (
                                <div
                                  className="text-xs font-semibold mb-0.5"
                                  style={{ color: isMe ? 'rgba(255,255,255,0.8)' : 'var(--fg-muted)' }}
                                >
                                  {msg.sender.firstName}
                                </div>
                              )}
                              {msg.content}
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
                  <div className="flex items-center gap-2 mt-2 px-1">
                    <div className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {Array.from(typingUsers.values()).join(', ')} est en train d&apos;écrire…
                    </span>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-border p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Écrire un message…"
                    rows={1}
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    style={{ maxHeight: 120, minHeight: 36 }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                    }}
                  />
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                  >
                    <Send size={16} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-medium">Sélectionnez une conversation</p>
              <p className="text-xs mt-1 opacity-60">
                Choisissez un membre pour commencer à discuter
              </p>
            </div>
          )}
        </div>
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

function formatFullTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday) {
    return `Aujourd'hui à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
