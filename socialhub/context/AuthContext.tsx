import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import apiService from '../services/api';
import { io, Socket } from 'socket.io-client';
import { useDispatch, useSelector } from 'react-redux';
import { setUser, setBiometricsEnabled, logout as reduxLogout } from '../store/authSlice';

interface User {
  id: string;
  _id?: string;
  firstName: string;
  lastName: string;
  username: string;
  email?: string;
  phoneNumber?: string;
  profilePicture?: string;
  profileCover?: string;
  bio?: string;
  address?: string;
  website?: string;
  dateOfBirth?: { day: string; month: string; year: string };
  highlights?: Array<{ _id?: string; title: string; image: string }>;
  biometricEnabled?: boolean;
  biometrics?: { fingerprint?: boolean; voice?: boolean };
  isVerified?: boolean;
  lastUsernameChange?: string;
  likesReceived?: number;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  profileTheme?: string;
  profileFrame?: string;
  streakCount?: number;
  coins?: number;
  level?: number;
  xp?: number;
  profileViews?: number;
  engagement?: number;
  todayRewardClaimed?: boolean;
  weeklyProgress?: number;
  achievements?: string[];
  emailVerified?: boolean;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  socket: Socket | null;
  login: (credentials: any) => Promise<any>;
  completeLogin: (userData: any) => Promise<any>;
  signup: (userData: any) => Promise<void>;
  socialLogin: (socialData: any) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  updateProfile: (profileData: any) => Promise<void>;
  enableBiometrics: () => Promise<void>;
  disableBiometrics: () => Promise<void>;
  isBiometricsEnabled: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auto-detect socket URL based on platform — no hardcoded IP
const getSocketUrl = (): string => {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) {
    // Strip /api suffix if present
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/api$/, '');
  }
  if (Platform.OS === 'web') return 'http://localhost:5000';
  if (Platform.OS === 'android') return 'http://10.0.2.2:5000';
  return 'http://localhost:5000';
};

const SOCKET_URL = getSocketUrl();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  const dispatch = useDispatch();
  const reduxUser = useSelector((state: any) => state.auth.user);
  const isBiometricsEnabled = useSelector((state: any) => state.auth.isBiometricsEnabled);

  // We can still expose the user from Redux state through context for backwards compatibility
  const user = reduxUser;

  const saveUserState = useCallback((userData: any) => {
    if (!userData) {
      dispatch(setUser(null));
      return;
    }
    const normalizedUser = {
      ...userData,
      id: userData.id || userData._id
    };
    const cleanUser = JSON.parse(JSON.stringify(normalizedUser));
    dispatch(setUser(cleanUser));
    return cleanUser;
  }, [dispatch]);

  useEffect(() => {
    // Only connect if we have a user and no existing socket
    if (user?.id && !socket) {
      console.log('Connecting to socket for user:', user.username);
      const newSocket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      newSocket.on('connect', () => {
        console.log('✅ Socket connected');
        newSocket.emit('join', user.id);
      });

      newSocket.on('user_updated', (updatedUser) => {
        console.log('🔄 Real-time user update');
        saveUserState(updatedUser);
      });

      newSocket.on('connect_error', (err) => {
        console.error('❌ Socket error:', err.message);
      });

      setSocket(newSocket);

      return () => {
        // Only disconnect, don't setSocket(null) here to avoid loops
        // The !socket check above handles the rest
        console.log('Cleaning up socket...');
        newSocket.disconnect();
      };
    }
  }, [user?.id, saveUserState]); // Only re-run if User ID actually changes, not on every user object update

  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getCurrentUser();

      if (response && response.user) {
        saveUserState(response.user);
      } else if (response === null) {
        // null = no token or 401 confirmed — clear state
        dispatch(setUser(null));
        await apiService.removeToken();
      }

      const biometricFlag = Platform.OS === 'web'
        ? localStorage.getItem('biometrics_enabled')
        : await SecureStore.getItemAsync('biometrics_enabled');

      dispatch(setBiometricsEnabled(biometricFlag === 'true'));
    } catch (error: any) {
      console.error('Auth Check Failed:', error);
      if (error?.status === 401) {
        dispatch(setUser(null));
        await apiService.removeToken();
      }
    } finally {
      setIsLoading(false);
    }
  }, [saveUserState, dispatch]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (credentials: any) => {
    try {
      setIsLoading(true);
      const response = await apiService.login(credentials);
      if (response && response.user) {
        // Return normalized user for the two-step login UI
        return {
          ...response.user,
          id: response.user.id || response.user._id
        };
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const completeLogin = async (userData: any) => {
    const cleanUser = saveUserState(userData);

    // Store last identifier for biometrics
    const identifier = userData.username || userData.email || userData.phoneNumber || '';
    if (identifier) {
      if (Platform.OS === 'web') {
        localStorage.setItem('last_user_identifier', identifier);
      } else {
        await SecureStore.setItemAsync('last_user_identifier', identifier);
      }
    }
    return cleanUser;
  };

  const signup = async (userData: any) => {
    try {
      setIsLoading(true);
      const response = await apiService.signup(userData);
      if (response && response.user) {
        saveUserState(response.user);
        if (userData.biometricEnabled) {
          await enableBiometrics();
        }
      }
      return response;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const socialLogin = async (socialData: any) => {
    try {
      setIsLoading(true);
      const response = await apiService.socialLogin(socialData);
      if (response && response.user) {
        saveUserState(response.user);
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(async () => {
    try {
      console.log('AuthContext: Logout initiated');
      if (socket) {
        console.log('AuthContext: Disconnecting socket');
        socket.disconnect();
        setSocket(null);
      }
      console.log('AuthContext: Removing token from storage');
      await apiService.removeToken();
      console.log('AuthContext: Clearing user state');
      dispatch(reduxLogout());
      console.log('AuthContext: Logout successful');
    } catch (error) {
      console.error('AuthContext: Logout critical failure:', error);
      dispatch(reduxLogout());
      setSocket(null);
    }
  }, [socket, dispatch]);

  const updateUser = useCallback((userData: Partial<User>) => {
    if (reduxUser) {
      // Don't overwrite a valid profilePicture/profileCover with null from a failed upload response
      const safeUpdate = { ...userData };
      if ((safeUpdate.profilePicture === null || safeUpdate.profilePicture === undefined) && reduxUser.profilePicture) {
        delete safeUpdate.profilePicture;
      }
      if ((safeUpdate.profileCover === null || safeUpdate.profileCover === undefined) && reduxUser.profileCover) {
        delete safeUpdate.profileCover;
      }
      const updated = { ...reduxUser, ...safeUpdate };
      dispatch(setUser(JSON.parse(JSON.stringify(updated))));
    }
  }, [reduxUser, dispatch]);

  const updateProfile = async (profileData: any) => {
    try {
      setIsLoading(true);
      const response = await apiService.updateProfile(profileData);
      if (response && response.success) {
        saveUserState(response.user);
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const enableBiometrics = async () => {
    if (Platform.OS !== 'web') {
      await SecureStore.setItemAsync('biometrics_enabled', 'true');
    } else {
      localStorage.setItem('biometrics_enabled', 'true');
    }
    dispatch(setBiometricsEnabled(true));
  };

  const disableBiometrics = async () => {
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync('biometrics_enabled');
    } else {
      localStorage.removeItem('biometrics_enabled');
    }
    dispatch(setBiometricsEnabled(false));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        socket,
        login,
        completeLogin,
        signup,
        socialLogin,
        logout,
        checkAuth,
        updateUser,
        updateProfile,
        enableBiometrics,
        disableBiometrics,
        isBiometricsEnabled,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
