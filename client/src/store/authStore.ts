import { create } from 'zustand';
import { authAPI } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';

interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  gender: string;
  avatar: string | null;
  bio: string | null;
  role: string;
  accountType: string;
  theme: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; name: string; gender: string }) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('genx_token') : null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    localStorage.setItem('genx_token', data.token);
    localStorage.setItem('genx_user', JSON.stringify(data.user));
    connectSocket(data.token);
    set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
  },

  register: async (userData) => {
    const { data } = await authAPI.register(userData);
    localStorage.setItem('genx_token', data.token);
    localStorage.setItem('genx_user', JSON.stringify(data.user));
    connectSocket(data.token);
    set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('genx_token');
    localStorage.removeItem('genx_user');
    disconnectSocket();
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    window.location.href = '/login';
  },

  loadUser: async () => {
    const token = localStorage.getItem('genx_token');
    if (!token) {
      set({ isLoading: false });
      return;
    }

    try {
      const { data } = await authAPI.getMe();
      connectSocket(token);
      set({ user: data, token, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('genx_token');
      localStorage.removeItem('genx_user');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateUser: (data) => {
    const current = get().user;
    if (current) {
      const updated = { ...current, ...data };
      localStorage.setItem('genx_user', JSON.stringify(updated));
      set({ user: updated });
    }
  },
}));
