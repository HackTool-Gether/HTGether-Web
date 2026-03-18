'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { authApi, type User, type LoginResponse } from './api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  loginWithTokens: (response: LoginResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'htgether_token';
const REFRESH_TOKEN_KEY = 'htgether_refresh_token';
const USER_KEY = 'htgether_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const saveAuth = useCallback((data: LoginResponse) => {
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.accessToken);
    setUser(data.user);
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (!storedToken || !storedRefreshToken) {
        setIsLoading(false);
        return;
      }

      // Try to use existing token
      try {
        const profile = await authApi.getProfile(storedToken);
        setToken(storedToken);
        setUser(profile);
      } catch {
        // Token expired, try refresh
        try {
          const refreshed = await authApi.refresh(storedRefreshToken);
          saveAuth(refreshed);
        } catch {
          // Refresh also failed, clear everything
          clearAuth();
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, [saveAuth, clearAuth]);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    saveAuth(response);
    return response;
  };

  const loginWithTokens = (response: LoginResponse) => {
    saveAuth(response);
  };

  const logout = () => {
    clearAuth();
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, loginWithTokens, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
