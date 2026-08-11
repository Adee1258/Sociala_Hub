import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// API Configuration
import Constants from 'expo-constants';

const getApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Auto-detect for web or emulators to avoid "Failed to fetch"
  if (Platform.OS === 'web') return 'http://localhost:5000/api';
  if (Platform.OS === 'android') return 'http://10.0.2.2:5000/api';
  
  // iOS simulator uses localhost
  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiUrl();

// Helper to handle API responses
const handleResponse = async (response) => {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_e) {
    throw new Error('Server returned an invalid response');
  }
  
  if (!response.ok) {
    // Attach status code to the error so callers can handle 401 specifically
    const err = new Error(data.message || 'Something went wrong');
    err.status = response.status;
    throw err;
  }
  return data;
};

// API Service Object
const apiService = {
  // Store token securely
  setToken: async (token, refreshToken = null) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem('token', token);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      } else {
        await SecureStore.setItemAsync('token', token);
        if (refreshToken) await SecureStore.setItemAsync('refreshToken', refreshToken);
      }
    } catch (_e) {
      console.error('Error saving token:', _e);
    }
  },

  getToken: async () => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem('token');
      }
      return await SecureStore.getItemAsync('token');
    } catch (_e) {
      console.error('Error getting token:', _e);
      return null;
    }
  },

  getRefreshToken: async () => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem('refreshToken');
      }
      return await SecureStore.getItemAsync('refreshToken');
    } catch (_e) {
      return null;
    }
  },

  removeToken: async () => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      } else {
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('refreshToken');
      }
    } catch (_e) {
      console.error('Error removing token:', _e);
    }
  },

  // Signup
  signup: async (userData) => {
    let options = {
      method: 'POST',
    };

    if (userData.profilePicture && (userData.profilePicture.startsWith('file://') || userData.profilePicture.startsWith('content://'))) {
      const formData = new FormData();
      
      const uri = userData.profilePicture;
      const filename = uri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? ('image/' + match[1].toLowerCase()) : 'image/jpeg';
      formData.append('profilePicture', { uri: uri, name: filename, type: type });

      Object.keys(userData).forEach(key => {
        if (key !== 'profilePicture' && userData[key] !== undefined) {
          if (key === 'dateOfBirth' && typeof userData[key] === 'object') {
            formData.append('day', userData[key].day);
            formData.append('month', userData[key].month);
            formData.append('year', userData[key].year);
          } else if (typeof userData[key] === 'object') {
            formData.append(key, JSON.stringify(userData[key]));
          } else {
            formData.append(key, String(userData[key]));
          }
        }
      });

      options.body = formData;
    } else {
      options.headers = {
        'Content-Type': 'application/json',
      };
      options.body = JSON.stringify(userData);
    }

    const response = await fetch(`${API_BASE_URL}/auth/signup`, options);
    const data = await handleResponse(response);
    if (data.token) {
      await apiService.setToken(data.token, data.refreshToken);
    }
    return data;
  },

  // Login
  login: async (credentials) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    const data = await handleResponse(response);
    if (data.token) {
      await apiService.setToken(data.token, data.refreshToken);
    }
    return data;
  },

  // Quick Login (Phone + Biometric)
  quickLogin: async (phoneNumber) => {
    const response = await fetch(`${API_BASE_URL}/auth/quick-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumber, biometricSuccess: true }),
    });
    const data = await handleResponse(response);
    if (data.token) {
      await apiService.setToken(data.token, data.refreshToken);
    }
    return data;
  },

  // Get current user
  getCurrentUser: async () => {
    const token = await apiService.getToken();
    if (!token) return null;
    
    const response = await fetch(`${API_BASE_URL}/auth/me?t=${new Date().getTime()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

    // On 401 specifically, return null so AuthContext knows the token is invalid
    // without throwing — this prevents wiping a valid token on network blips
    if (response.status === 401) {
      return null;
    }

    return handleResponse(response);
  },

  // Social Login
  socialLogin: async (socialData) => {
    const { provider, ...payload } = socialData;
    const response = await fetch(`${API_BASE_URL}/auth/${provider}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await handleResponse(response);
    if (data.token) {
      await apiService.setToken(data.token, data.refreshToken);
    }
    return data;
  },

  // Check username availability
  checkUsername: async (username) => {
    const response = await fetch(`${API_BASE_URL}/auth/check-username`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    });
    return handleResponse(response);
  },

  // Check email availability
  checkEmail: async (email) => {
    const response = await fetch(`${API_BASE_URL}/auth/check-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    return handleResponse(response);
  },

  // Login via OTP
  loginOTP: async (identifier, type) => {
    const response = await fetch(`${API_BASE_URL}/auth/login-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier, type }),
    });
    const data = await handleResponse(response);
    if (data.token) {
      await apiService.setToken(data.token);
    }
    return data;
  },

  // Update profile
  updateProfile: async (profileData) => {
    const token = await apiService.getToken();
    if (!token) {
      throw new Error('You are not logged in. Please login again.');
    }
    
    // Create FormData for file upload support
    const formData = new FormData();
    
    // Check if profilePicture is a local URI (not http/https)
    if (profileData.profilePicture && !profileData.profilePicture.startsWith('http')) {
      const uri = profileData.profilePicture;
      const filename = uri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpg';
      const type = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

      if (Platform.OS === 'web') {
        const res = await fetch(uri);
        const blob = await res.blob();
        formData.append('profilePicture', blob, filename);
      } else {
        formData.append('profilePicture', { uri, name: filename, type });
      }
    }

    // Check if profileCover is a local URI (not http/https)
    if (profileData.profileCover && !profileData.profileCover.startsWith('http')) {
      const uri = profileData.profileCover;
      const filename = uri.split('/').pop() || 'cover.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpg';
      const type = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

      if (Platform.OS === 'web') {
        const res = await fetch(uri);
        const blob = await res.blob();
        formData.append('profileCover', blob, filename);
      } else {
        formData.append('profileCover', { uri, name: filename, type });
      }
    }

    // Append other fields — coerce to string for FormData compatibility
    Object.keys(profileData).forEach(key => {
      if (key !== 'profilePicture' && key !== 'profileCover' && profileData[key] !== undefined && profileData[key] !== null) {
        if (typeof profileData[key] === 'object') {
          formData.append(key, JSON.stringify(profileData[key]));
        } else {
          formData.append(key, String(profileData[key]));
        }
      }
    });

    const response = await fetch(`${API_BASE_URL}/auth/update-profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    return handleResponse(response);
  },

  // Verify email with token
  verifyEmail: async (token) => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-email?token=${token}`, {
      method: 'GET',
    });
    return handleResponse(response);
  },

  // Resend verification email
  resendVerificationEmail: async () => {
    const token = await apiService.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Check email verification status
  checkEmailVerification: async () => {
    const token = await apiService.getToken();
    if (!token) return { emailVerified: false, email: null };

    const response = await fetch(`${API_BASE_URL}/auth/check-email-verification`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Send OTP to email
  sendEmailOTP: async (email) => {
    const response = await fetch(`${API_BASE_URL}/otp/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    return handleResponse(response);
  },

  // Send OTP to phone
  sendSMSOTP: async (phoneNumber) => {
    const response = await fetch(`${API_BASE_URL}/otp/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumber }),
    });
    return handleResponse(response);
  },

  // Verify OTP
  verifyOTP: async (identifier, otp, type) => {
    const response = await fetch(`${API_BASE_URL}/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier, otp, type }),
    });
    return handleResponse(response);
  },

  // Check if identifier is verified
  checkVerified: async (identifier) => {
    const response = await fetch(`${API_BASE_URL}/otp/check-verified`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier }),
    });
    return handleResponse(response);
  },

  // Reset password (after OTP verified)
  resetPassword: async (identifier, type, newPassword) => {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier, type, newPassword }),
    });
    const data = await handleResponse(response);
    // If backend returns a fresh token, store it
    if (data.token) {
      await apiService.setToken(data.token);
    }
    return data;
  },

  // Check if user is authenticated (Async now)
  isAuthenticated: async () => {
    const token = await apiService.getToken();
    return !!token;
  },

  // Chat Services
  getConversations: async () => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/chat/conversations?t=${new Date().getTime()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
    });
    return handleResponse(response);
  },

  getMessages: async (conversationId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/chat/messages/${conversationId}?t=${new Date().getTime()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
    });
    return handleResponse(response);
  },

  sendMessage: async (messageData) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/chat/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });
    return handleResponse(response);
  },

  getOrCreateConversation: async (recipientId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/chat/conversations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipientId }),
    });
    return handleResponse(response);
  },

  getAllUsers: async () => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/auth/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  uploadVoiceMessage: async (formData) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/chat/upload-voice`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    return handleResponse(response);
  },

  // Save customized themes, frames, and claimed rewards persistence
  saveProfileSettings: async (settings) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/auth/profile-settings`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
    return handleResponse(response);
  },

  // Dynamic real-time AI Profile Coach
  askAICoach: async (prompt) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/ai/coach`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });
    return handleResponse(response);
  },

  // Create post or reel
  createPost: async (postData) => {
    const token = await apiService.getToken();
    const formData = new FormData();
    
    if (postData.media && postData.media.startsWith('file://')) {
      const uri = postData.media;
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;
      
      formData.append('media', { uri, name: filename, type });
    } else if (postData.mediaUrl) {
      formData.append('mediaUrl', postData.mediaUrl);
      if (postData.mediaType) {
        formData.append('mediaType', postData.mediaType);
      }
    }
    
    if (postData.content) {
      formData.append('content', postData.content);
    }
    if (postData.isReel !== undefined) {
      formData.append('isReel', String(postData.isReel));
    }
    
    const response = await fetch(`${API_BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    return handleResponse(response);
  },

  // Get user posts
  getUserPosts: async (userId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/posts/user/${userId}?t=${new Date().getTime()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
    });
    return handleResponse(response);
  },

  // Get feed posts (all posts, paginated)
  getFeedPosts: async (page = 1, limit = 10) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/posts/feed?page=${page}&limit=${limit}&t=${new Date().getTime()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
    });
    return handleResponse(response);
  },

  // Like a post
  likePost: async (postId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/like`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Unlike a post
  unlikePost: async (postId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/like`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Add a comment to a post
  addComment: async (postId, text) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    return handleResponse(response);
  },

  // Get comments for a post
  getComments: async (postId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments?t=${new Date().getTime()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
    });
    return handleResponse(response);
  },

  // Add a story highlight
  addHighlight: async (highlightData) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/auth/highlights`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(highlightData),
    });
    return handleResponse(response);
  },

  // Search API
  searchAll: async (query = '') => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&t=${new Date().getTime()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
    });
    return handleResponse(response);
  },

  followUser: async (targetUserId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/search/follow/${targetUserId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  unfollowUser: async (targetUserId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/search/follow/${targetUserId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Reels API
  getReels: async (page = 1, limit = 10) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/posts/reels?page=${page}&limit=${limit}&t=${new Date().getTime()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
    });
    return handleResponse(response);
  },

  // Notifications API
  getNotifications: async () => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/notifications?t=${new Date().getTime()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
    });
    return handleResponse(response);
  },

  markNotificationsRead: async (notificationIds = null) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/notifications/read`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notificationIds }),
    });
    return handleResponse(response);
  },

  // Games API
  getDailyStatus: async () => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/games/daily-status?t=${new Date().getTime()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  claimDailyReward: async () => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/games/claim-daily`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  playGameReward: async (gameName, coinsEarned = 50, xpEarned = 200) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/games/play-reward`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gameName, coinsEarned, xpEarned }),
    });
    return handleResponse(response);
  },

  getLeaderboard: async () => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/games/leaderboard?t=${new Date().getTime()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // React to a message with an emoji
  reactToMessage: async (messageId, emoji) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/chat/messages/${messageId}/react`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji }),
    });
    return handleResponse(response);
  },

  // Delete a message
  deleteMessage: async (messageId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/chat/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Upload image/video media in chat
  uploadChatMedia: async (formData) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/chat/upload-media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    return handleResponse(response);
  },

  // Pin a message in a conversation
  pinMessage: async (messageId, conversationId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/chat/messages/${messageId}/pin`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId }),
    });
    return handleResponse(response);
  },
};

export default apiService;

