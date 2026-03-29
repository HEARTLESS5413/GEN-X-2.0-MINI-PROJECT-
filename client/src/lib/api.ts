import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
export const UPLOADS_URL = process.env.NEXT_PUBLIC_UPLOADS_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('genx_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('genx_token');
        localStorage.removeItem('genx_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data: { username: string; email: string; password: string; name: string; gender: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Users
export const usersAPI = {
  getProfile: (username: string) => api.get(`/users/profile/${username}`),
  updateProfile: (data: any) => api.put('/users/profile', data),
  uploadAvatar: (formData: FormData) => api.post('/users/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  follow: (userId: string) => api.post(`/users/follow/${userId}`),
  handleFollowRequest: (followId: string, action: string) =>
    api.post(`/users/follow-request/${followId}/${action}`),
  getFollowers: (userId: string) => api.get(`/users/${userId}/followers`),
  getFollowing: (userId: string) => api.get(`/users/${userId}/following`),
  search: (q: string) => api.get(`/users/search?q=${q}`),
  getSuggestions: () => api.get('/users/suggestions'),
  updateTheme: (theme: string) => api.put('/users/theme', { theme }),
  getAll: () => api.get('/users/all'),
};

// Posts
export const postsAPI = {
  create: (formData: FormData) => api.post('/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getFeed: (page = 1) => api.get(`/posts/feed?page=${page}`),
  getExplore: () => api.get('/posts/explore'),
  getUserPosts: (userId: string) => api.get(`/posts/user/${userId}`),
  getPost: (postId: string) => api.get(`/posts/${postId}`),
  like: (postId: string) => api.post(`/posts/${postId}/like`),
  comment: (postId: string, text: string) => api.post(`/posts/${postId}/comment`, { text }),
  save: (postId: string) => api.post(`/posts/${postId}/save`),
  getSaved: () => api.get('/posts/saved/all'),
  delete: (postId: string) => api.delete(`/posts/${postId}`),
};

// Messages
export const messagesAPI = {
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (userId: string, page = 1) => api.get(`/messages/${userId}?page=${page}`),
  sendMedia: (userId: string, formData: FormData) => api.post(`/messages/${userId}/media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// Notifications
export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAllRead: () => api.put('/notifications/read'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
};

// Games
export const gamesAPI = {
  create: (gameType: string, opponentId: string) => api.post('/games/create', { gameType, opponentId }),
  getSession: (sessionId: string) => api.get(`/games/${sessionId}`),
  getHistory: () => api.get('/games/history/me'),
  join: (sessionId: string) => api.post(`/games/${sessionId}/join`),
  start: (sessionId: string) => api.post(`/games/${sessionId}/start`),
  rematch: (sessionId: string) => api.post(`/games/${sessionId}/rematch`),
  changeGame: (sessionId: string, gameType: string) => api.post(`/games/${sessionId}/change-game`, { gameType }),
};

// Watch
export const watchAPI = {
  createRoom: (videoUrl: string, videoType?: string) => api.post('/watch/create', { videoUrl, videoType }),
  getRoom: (roomId: string) => api.get(`/watch/${roomId}`),
  joinRoom: (roomId: string) => api.post(`/watch/${roomId}/join`),
  leaveRoom: (roomId: string) => api.post(`/watch/${roomId}/leave`),
};

// Explore
export const exploreAPI = {
  updateLocation: (latitude: number, longitude: number) => api.post('/explore/location', { latitude, longitude }),
  getNearby: () => api.get('/explore/nearby'),
  match: (userId: string) => api.post(`/explore/match/${userId}`),
  reveal: (sessionId: string) => api.post(`/explore/reveal/${sessionId}`),
  endSession: (sessionId: string) => api.post(`/explore/end/${sessionId}`),
};

// Admin
export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (page = 1) => api.get(`/admin/users?page=${page}`),
  deleteUser: (userId: string) => api.delete(`/admin/users/${userId}`),
  deletePost: (postId: string) => api.delete(`/admin/posts/${postId}`),
};

// Stories
export const storiesAPI = {
  getFeed: () => api.get('/stories/feed'),
  create: (formData: FormData) => api.post('/stories', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  view: (storyId: string) => api.post(`/stories/${storyId}/view`),
  getViewers: (storyId: string) => api.get(`/stories/${storyId}/viewers`),
  delete: (storyId: string) => api.delete(`/stories/${storyId}`),
};

export default api;
