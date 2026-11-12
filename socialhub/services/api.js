import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// API Configuration
import Constants from 'expo-constants';

const getApiUrl = () => {
  // If EXPO_PUBLIC_API_URL is configured (e.g. Vercel backend or custom LAN IP), respect it across all platforms!
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Android emulator fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }

  // Web browser & iOS simulator default
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
    if (response.status === 413) {
      const err = new Error('File size is too large for the server. Please select a smaller file or video.');
      err.status = 413;
      throw err;
    }
    if (response.status === 504) {
      const err = new Error('Server timeout. The server took too long to process your request.');
      err.status = 504;
      throw err;
    }
    if (response.status >= 500) {
      const err = new Error(`Server encountered an error (${response.status}). Please try again shortly.`);
      err.status = response.status;
      throw err;
    }
    if (!response.ok) {
      const err = new Error(`Request failed (${response.status}): ${text ? text.slice(0, 100) : 'Invalid server response'}`);
      err.status = response.status;
      throw err;
    }
    const err = new Error('Server returned an invalid response');
    err.status = response.status;
    throw err;
  }
  
  if (!response.ok) {
    // Attach status code to the error so callers can handle 401 specifically
    const err = new Error(data.message || 'Something went wrong');
    err.status = response.status;
    throw err;
  }
  return data;
};

// Universal helper: convert local URI to base64 data URI safely across Web & Native
const uriToBase64 = async (uri) => {
  if (!uri) return null;
  if (uri.startsWith('data:')) return uri;

  // 1. On Native: try FileSystem.readAsStringAsync (handles content:// and file://)
  if (Platform.OS !== 'web') {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (base64) {
        const ext = (uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
        const mime = ext === 'png' ? 'image/png'
          : ext === 'gif' ? 'image/gif'
          : ext === 'webp' ? 'image/webp'
          : 'image/jpeg';
        return `data:${mime};base64,${base64}`;
      }
    } catch (fsErr) {
      console.warn('[uriToBase64] FileSystem.readAsStringAsync failed, falling back to blob:', fsErr?.message);
    }
  }

  // 2. Fetch -> Blob -> FileReader fallback (universal for Web and Native)
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (blobErr) {
    console.error('[uriToBase64] Failed to convert URI to base64:', uri, blobErr);
    return null;
  }
};

// Safe FormData sender across Web & Native
// On Native: Uses XMLHttpRequest so React Native's RCTNetworking streams multipart files
// directly without triggering Expo SDK 57 / RN 0.86 WinterCG "Unsupported FormDataPart implementation"
const sendFormData = async (url, method, token, formData) => {
  if (Platform.OS === 'web') {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    return handleResponse(response);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    // Never manually set Content-Type header on FormData; XHR sets multipart/form-data with proper boundary automatically!
    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (_e) {
        if (xhr.status === 413) {
          const err = new Error('File size is too large for the server. Please select a smaller file or video.');
          err.status = 413;
          return reject(err);
        }
        if (xhr.status === 504) {
          const err = new Error('Server timeout. The upload took too long to complete.');
          err.status = 504;
          return reject(err);
        }
        if (xhr.status >= 500) {
          const err = new Error(`Server encountered an error (${xhr.status}). Please try again shortly.`);
          err.status = xhr.status;
          return reject(err);
        }
        const err = new Error(`Upload failed (${xhr.status}): Invalid server response`);
        err.status = xhr.status;
        return reject(err);
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        const err = new Error(data?.message || `Request failed with status ${xhr.status}`);
        err.status = xhr.status;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.send(formData);
  });
};

// ─── Cloudinary Direct Upload Configuration & Helpers ─────────────────────────
const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'debxfznpi';
const CLOUDINARY_API_KEY = process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY || '575363512821788';
const CLOUDINARY_API_SECRET = process.env.EXPO_PUBLIC_CLOUDINARY_API_SECRET || 'PNz1QMPNzckhEPyhM8hxPo-GrKg';

// Pure JS SHA1 hash implementation (zero external dependencies)
const computeSha1 = (str) => {
  const rotateLeft = (n, s) => (n << s) | (n >>> (32 - s));
  const cvtHex = (val) => {
    let s = '';
    for (let i = 7; i >= 0; i--) {
      s += ((val >>> (i * 4)) & 0x0f).toString(16);
    }
    return s;
  };
  const words = [];
  const len = str.length * 8;
  for (let i = 0; i < str.length; i++) {
    words[i >> 2] |= (str.charCodeAt(i) & 0xff) << ((3 - (i % 4)) * 8);
  }
  words[str.length >> 2] |= 0x80 << ((3 - (str.length % 4)) * 8);
  words[(((str.length + 8) >> 6) + 1) * 16 - 1] = len;

  let H0 = 0x67452301, H1 = 0xefcdab89, H2 = 0x98badcfe, H3 = 0x10325476, H4 = 0xc3d2e1f0;
  const W = new Array(80);

  for (let i = 0; i < words.length; i += 16) {
    let A = H0, B = H1, C = H2, D = H3, E = H4;
    for (let t = 0; t < 80; t++) {
      W[t] = t < 16 ? (words[i + t] | 0) : rotateLeft(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
      let temp = (rotateLeft(A, 5) + E + W[t]) | 0;
      if (t < 20) temp = (temp + ((B & C) | (~B & D)) + 0x5a827999) | 0;
      else if (t < 40) temp = (temp + (B ^ C ^ D) + 0x6ed9eba1) | 0;
      else if (t < 60) temp = (temp + ((B & C) | (B & D) | (C & D)) + 0x8f1bbcdc) | 0;
      else temp = (temp + (B ^ C ^ D) + 0xca62c1d6) | 0;
      E = D; D = C; C = rotateLeft(B, 30); B = A; A = temp;
    }
    H0 = (H0 + A) | 0; H1 = (H1 + B) | 0; H2 = (H2 + C) | 0; H3 = (H3 + D) | 0; H4 = (H4 + E) | 0;
  }
  return (cvtHex(H0) + cvtHex(H1) + cvtHex(H2) + cvtHex(H3) + cvtHex(H4)).toLowerCase();
};

// Retrieve signed upload parameters (backend signature preferred, instant local fallback)
const getCloudinarySignature = async () => {
  try {
    const token = await apiService.getToken();
    if (token) {
      const res = await fetch(`${API_BASE_URL}/posts/upload-signature`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.signature && data?.timestamp) return data;
      }
    }
  } catch (_e) {}

  // Instant zero-latency fallback: local signed timestamp
  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = 'socialhub/posts';
  const toSign = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = computeSha1(toSign);
  return {
    signature,
    timestamp,
    folder,
    apiKey: CLOUDINARY_API_KEY,
    cloudName: CLOUDINARY_CLOUD_NAME,
  };
};

// Direct upload to Cloudinary (Native & Web)
// Completely bypasses Vercel 4.5MB serverless limits for images and videos!
const uploadDirectToCloudinary = async (uri, isVideo) => {
  const signData = await getCloudinarySignature();
  const resourceType = isVideo ? 'video' : 'auto';
  const uploadUrl = `https://api.cloudinary.com/v1_1/${signData.cloudName}/${resourceType}/upload`;

  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    const formData = new FormData();
    formData.append('file', blob);
    formData.append('api_key', signData.apiKey);
    formData.append('timestamp', String(signData.timestamp));
    formData.append('signature', signData.signature);
    formData.append('folder', signData.folder);

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });
    const result = await uploadRes.json();
    if (result.secure_url) {
      return {
        url: result.secure_url,
        type: result.resource_type === 'video' || isVideo ? 'video' : 'image',
      };
    }
    throw new Error(result.error?.message || 'Media upload failed on web');
  }

  // Native: Use FileSystem.uploadAsync (streams file from disk without memory spikes)
  try {
    const uploadResult = await FileSystem.uploadAsync(uploadUrl, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      parameters: {
        api_key: String(signData.apiKey),
        timestamp: String(signData.timestamp),
        signature: String(signData.signature),
        folder: String(signData.folder),
      },
    });

    if (uploadResult.status >= 200 && uploadResult.status < 300) {
      const data = JSON.parse(uploadResult.body);
      if (data?.secure_url) {
        return {
          url: data.secure_url,
          type: data.resource_type === 'video' || isVideo ? 'video' : 'image',
        };
      }
    }
    let errMsg = `Upload failed with status ${uploadResult.status}`;
    try {
      const errData = JSON.parse(uploadResult.body);
      if (errData?.error?.message) errMsg = errData.error.message;
    } catch (_e) {}
    throw new Error(errMsg);
  } catch (fsErr) {
    console.warn('[uploadDirectToCloudinary] FileSystem.uploadAsync fallback to XHR:', fsErr?.message);
    // Fallback: XHR FormData
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);
      const fd = new FormData();
      const rawFilename = uri.split('/').pop() || (isVideo ? 'video.mp4' : 'photo.jpg');
      const ext = rawFilename.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
      const mime = isVideo ? `video/${ext}` : `image/${ext === 'png' ? 'png' : 'jpeg'}`;
      fd.append('file', { uri, name: rawFilename, type: mime });
      fd.append('api_key', signData.apiKey);
      fd.append('timestamp', String(signData.timestamp));
      fd.append('signature', signData.signature);
      fd.append('folder', signData.folder);

      xhr.onload = () => {
        try {
          const resp = JSON.parse(xhr.responseText);
          if (resp?.secure_url) {
            resolve({
              url: resp.secure_url,
              type: resp.resource_type === 'video' || isVideo ? 'video' : 'image',
            });
          } else {
            reject(new Error(resp?.error?.message || 'Direct upload failed'));
          }
        } catch (_e) {
          reject(new Error('Cloudinary returned invalid response'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during media upload'));
      xhr.send(fd);
    });
  }
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
    // Always send signup as JSON — profile picture is uploaded separately after account creation
    // This avoids FormData issues with React Native 0.86+
    const { profilePicture, ...rest } = userData;

    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rest),
    });
    const data = await handleResponse(response);
    if (data.token) {
      await apiService.setToken(data.token, data.refreshToken);
    }

    // If a local profile picture was provided, upload it now after account is created
    if (profilePicture && data.token && (profilePicture.startsWith('file://') || profilePicture.startsWith('content://'))) {
      try {
        await apiService.updateProfile({ profilePicture });
        // Fetch updated user so caller gets the Cloudinary URL
        const updatedResponse = await apiService.getCurrentUser();
        // getCurrentUser returns { user, posts } — extract just the user object
        if (updatedResponse?.user) data.user = updatedResponse.user;
      } catch (e) {
        console.warn('[signup] Profile picture upload failed (non-fatal):', e.message);
        // data.user stays as-is from signup — account is created, just no picture
      }
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

  // Get any user profile by ID or username with smart fallback
  getUserProfile: async (identifier) => {
    const token = await apiService.getToken();
    if (!identifier) throw new Error('User identifier required');

    const cleanId = String(identifier).replace(/^@/, '').trim();

    try {
      const response = await fetch(`${API_BASE_URL}/auth/users/${encodeURIComponent(cleanId)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await handleResponse(response);
        if (data && data.user) return data;
      }
    } catch (_err) {
      // Fall through to search fallback
    }

    // Fallback via search endpoint for high availability
    try {
      const searchRes = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(cleanId)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (searchRes.ok) {
        const data = await handleResponse(searchRes);
        const matched = (data.users || []).find(
          (u) => u.id === cleanId || u.username?.toLowerCase() === cleanId.toLowerCase()
        ) || (data.users && data.users[0]);

        if (matched) {
          return { success: true, user: matched };
        }
      }
    } catch (_err) {
      // Ignore
    }

    throw new Error('User not found');
  },

  // Get full user profile bundle (user + posts + reels in 1 single network request)
  getUserProfileBundle: async (identifier) => {
    const token = await apiService.getToken();
    if (!identifier) throw new Error('User identifier required');

    const cleanId = String(identifier).replace(/^@/, '').trim();

    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile-bundle/${encodeURIComponent(cleanId)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await handleResponse(response);
        if (data && data.user) return data;
      }
    } catch (_err) {
      // Fallback to individual requests if bundle route encounters network issue
    }

    // Fallback: fetch user profile, then posts and reels in parallel
    const profileRes = await apiService.getUserProfile(cleanId);
    const targetUserId = profileRes?.user?.id || cleanId;
    const [postsRes, reelsRes] = await Promise.allSettled([
      apiService.getUserPosts(targetUserId),
      apiService.getUserReels(targetUserId),
    ]);

    return {
      success: true,
      user: profileRes.user,
      posts: postsRes.status === 'fulfilled' ? postsRes.value?.posts || [] : [],
      reels: reelsRes.status === 'fulfilled' ? reelsRes.value?.posts || [] : [],
    };
  },

  getUserFollowers: async (identifier) => {
    const token = await apiService.getToken();
    if (!identifier) return { success: false, users: [] };
    const cleanId = String(identifier).replace(/^@/, '').trim();
    const response = await fetch(`${API_BASE_URL}/auth/users/${encodeURIComponent(cleanId)}/followers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  getUserFollowing: async (identifier) => {
    const token = await apiService.getToken();
    if (!identifier) return { success: false, users: [] };
    const cleanId = String(identifier).replace(/^@/, '').trim();
    const response = await fetch(`${API_BASE_URL}/auth/users/${encodeURIComponent(cleanId)}/following`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
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

    // Build plain JSON payload — no FormData, no multer, no MIME issues
    const payload = {};

    // Copy all non-image fields
    Object.keys(profileData).forEach(key => {
      if (key !== 'profilePicture' && key !== 'profileCover') {
        payload[key] = profileData[key];
      }
    });

    // Convert profilePicture local URI → base64
    if (profileData.profilePicture && !profileData.profilePicture.startsWith('http')) {
      try {
        payload.profilePictureBase64 = await uriToBase64(profileData.profilePicture);
      } catch (e) {
        console.warn('[updateProfile] Could not convert profilePicture to base64:', e.message);
      }
    } else if (profileData.profilePicture) {
      payload.profilePicture = profileData.profilePicture;
    }

    // Convert profileCover local URI → base64
    if (profileData.profileCover && !profileData.profileCover.startsWith('http')) {
      try {
        payload.profileCoverBase64 = await uriToBase64(profileData.profileCover);
      } catch (e) {
        console.warn('[updateProfile] Could not convert profileCover to base64:', e.message);
      }
    } else if (profileData.profileCover) {
      payload.profileCover = profileData.profileCover;
    }

    const response = await fetch(`${API_BASE_URL}/auth/update-profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
    const response = await fetch(`${API_BASE_URL}/chat/conversations`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  getMessages: async (conversationId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/chat/messages/${conversationId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
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
    return sendFormData(`${API_BASE_URL}/chat/upload-voice`, 'POST', token, formData);
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
    if (!token) {
      throw new Error('You are not logged in. Please log in again.');
    }

    const callerSaysVideo = postData.isVideo === true || postData.isReel === true;

    // 1. If text-only post without media, send clean JSON
    if (!postData.media && !postData.mediaUrl) {
      const response = await fetch(`${API_BASE_URL}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: postData.content || '',
          isReel: postData.isReel === true,
        }),
      });
      return handleResponse(response);
    }

    // 2. Direct Cloudinary Upload (Highest speed & reliability: bypasses Vercel 4.5MB serverless limit)
    if (postData.media && !postData.mediaUrl) {
      try {
        const uploaded = await uploadDirectToCloudinary(postData.media, callerSaysVideo);
        if (uploaded?.url) {
          const response = await fetch(`${API_BASE_URL}/posts`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: postData.content || '',
              mediaUrl: uploaded.url,
              mediaType: uploaded.type,
              isReel: uploaded.type === 'video' || callerSaysVideo,
            }),
          });
          return await handleResponse(response);
        }
      } catch (directErr) {
        console.warn('[createPost] Direct Cloudinary upload failed, falling back:', directErr?.message);
      }
    }

    // 3. Fallback: If mediaUrl is already provided
    if (postData.mediaUrl) {
      const response = await fetch(`${API_BASE_URL}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: postData.content || '',
          mediaUrl: postData.mediaUrl,
          mediaType: postData.mediaType || (callerSaysVideo ? 'video' : 'image'),
          isReel: callerSaysVideo,
        }),
      });
      return handleResponse(response);
    }

    // 4. Fallback: Base64 JSON (only for small images under 3MB)
    if (postData.media && !callerSaysVideo) {
      try {
        const base64 = await uriToBase64(postData.media);
        if (base64 && base64.length < 3.5 * 1024 * 1024) {
          const response = await fetch(`${API_BASE_URL}/posts`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: postData.content || '',
              isReel: false,
              mediaBase64: base64,
            }),
          });
          return await handleResponse(response);
        }
      } catch (base64Err) {
        console.warn('[createPost] Base64 image path failed, falling back to FormData:', base64Err?.message);
      }
    }

    // 5. Fallback: FormData to backend
    const formData = new FormData();

    if (postData.content !== undefined) formData.append('content', postData.content);
    if (postData.isReel !== undefined) formData.append('isReel', String(postData.isReel));

    if (postData.mediaUrl) {
      formData.append('mediaUrl', postData.mediaUrl);
      if (postData.mediaType) formData.append('mediaType', postData.mediaType);
    }

    if (postData.media) {
      const uri = postData.media;

      if (Platform.OS === 'web') {
        // Web: uri is a blob: URL — fetch it and append as a Blob
        try {
          const blobRes = await fetch(uri);
          const blob = await blobRes.blob();
          const isVideo = blob.type.startsWith('video/') || callerSaysVideo;
          const mimeType = isVideo
            ? (blob.type.startsWith('video/') ? blob.type : 'video/mp4')
            : (blob.type.startsWith('image/') ? blob.type : 'image/jpeg');
          const ext = mimeType.split('/')[1] || (isVideo ? 'mp4' : 'jpg');
          const filename = isVideo ? `video.${ext}` : `photo.${ext}`;
          const typedBlob = new Blob([blob], { type: mimeType });
          formData.append('media', typedBlob, filename);
        } catch (_e) {
          console.warn('[createPost] Could not read media blob:', _e);
        }
      } else {
        // Native (Android / iOS physical device or emulator)
        const rawFilename = uri.split('/').pop() || (callerSaysVideo ? 'video.mp4' : 'photo.jpg');
        const match = /\.(\w+)$/.exec(rawFilename);
        const ext = match ? match[1].toLowerCase() : (callerSaysVideo ? 'mp4' : 'jpg');
        const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'm4v'];
        const isVideo = callerSaysVideo || videoExts.includes(ext);

        let mimeType;
        if (isVideo) {
          const videoMimeMap = {
            mov: 'video/quicktime',
            m4v: 'video/x-m4v',
            mkv: 'video/x-matroska',
            webm: 'video/webm',
            '3gp': 'video/3gpp',
            avi: 'video/x-msvideo',
          };
          mimeType = videoMimeMap[ext] || `video/${ext || 'mp4'}`;
        } else {
          mimeType = ext === 'png' ? 'image/png'
            : ext === 'gif' ? 'image/gif'
            : ext === 'webp' ? 'image/webp'
            : 'image/jpeg';
        }

        // Guarantee filename has a valid extension so Android RCTNetworking detects it
        const safeFilename = rawFilename.includes('.')
          ? rawFilename
          : `${rawFilename || (isVideo ? 'video' : 'photo')}.${ext}`;

        formData.append('media', { uri, name: safeFilename, type: mimeType });
      }
    }

    return sendFormData(`${API_BASE_URL}/posts`, 'POST', token, formData);
  },

  // Get user posts
  getUserPosts: async (userId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/posts/user/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Get feed posts (all posts, paginated)
  getFeedPosts: async (page = 1, limit = 10) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/posts/feed?page=${page}&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
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
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`, {
      headers: {
        'Authorization': `Bearer ${token}`,
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
    const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
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
    const response = await fetch(`${API_BASE_URL}/posts/reels?page=${page}&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Notifications API
  getNotifications: async () => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      headers: {
        'Authorization': `Bearer ${token}`,
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

  deleteNotification: async (notificationId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  clearAllNotifications: async () => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
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

  playGameReward: async (gameName, coinsEarned = 50, xpEarned = 200, score = 0) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/games/play-reward`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gameName, coinsEarned, xpEarned, score }),
    });
    return handleResponse(response);
  },

  getLeaderboard: async (period = 'alltime') => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/games/leaderboard?period=${period}&t=${new Date().getTime()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  getGameHistory: async () => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/games/history?t=${new Date().getTime()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  getGameStats: async () => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/games/stats?t=${new Date().getTime()}`, {
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
    return sendFormData(`${API_BASE_URL}/chat/upload-media`, 'POST', token, formData);
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

  // ── Posts ──────────────────────────────────────────────────────────────────

  // Delete own post
  deletePost: async (postId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Save / unsave (bookmark) a post — returns { success, saved: boolean }
  savePost: async (postId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/save`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Get all saved posts for current user
  getSavedPosts: async () => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/posts/saved`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  // Report a post
  reportPost: async (postId, reason = 'inappropriate') => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/report`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });
    return handleResponse(response);
  },

  // Get user reels
  getUserReels: async (userId) => {
    const token = await apiService.getToken();
    const response = await fetch(`${API_BASE_URL}/posts/user/${userId}/reels`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

};

export default apiService;

