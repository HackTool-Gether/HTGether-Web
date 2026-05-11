'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './auth-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const WS_URL = API_BASE.replace('/api', '');

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  onlineUsers: new Set(),
  joinProject: () => {},
  leaveProject: () => {},
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const joinedProjectsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        setOnlineUsers(new Set());
      }
      return;
    }

    const socket = io(`${WS_URL}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => {
      setIsConnected(false);
      setOnlineUsers(new Set());
    });

    socket.on('online-users', (data: { userIds: string[] }) => {
      setOnlineUsers(new Set(data.userIds));
    });

    socket.on('user-online', (data: { userId: string }) => {
      setOnlineUsers((prev) => new Set([...prev, data.userId]));
    });

    socket.on('user-offline', (data: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      joinedProjectsRef.current.clear();
    };
  }, [token]);

  const joinProject = useCallback((projectId: string) => {
    if (socketRef.current && !joinedProjectsRef.current.has(projectId)) {
      socketRef.current.emit('join-project', { projectId });
      joinedProjectsRef.current.add(projectId);
    }
  }, []);

  const leaveProject = useCallback((projectId: string) => {
    if (socketRef.current && joinedProjectsRef.current.has(projectId)) {
      socketRef.current.emit('leave-project', { projectId });
      joinedProjectsRef.current.delete(projectId);
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        onlineUsers,
        joinProject,
        leaveProject,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
