import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Platform } from 'react-native';

// Helper to load persisted state
const loadPersistedSignup = () => {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('phoneSignup');
      return data ? JSON.parse(data) : {};
    }
  } catch (e) {
    console.error('Failed to load persisted signup', e);
  }
  return {};
};

interface AuthState {
  emailSignup: {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    bio?: string;
    profilePicture?: string;
  };
  phoneSignup: {
    phoneNumber?: string;
    countryCode?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    bio?: string;
    profilePicture?: string;
    password?: string;
    useBiometrics?: boolean;
  };
  user: any | null;
  isAuthenticated: boolean;
  isBiometricsEnabled: boolean;
}

const initialState: AuthState = {
  emailSignup: {},
  phoneSignup: loadPersistedSignup(),
  user: null,
  isAuthenticated: false,
  isBiometricsEnabled: false,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setEmailSignupData: (state, action: PayloadAction<Partial<AuthState['emailSignup']>>) => {
      state.emailSignup = { ...state.emailSignup, ...action.payload };
    },
    setPhoneSignupData: (state, action: PayloadAction<Partial<AuthState['phoneSignup']>>) => {
      state.phoneSignup = { ...state.phoneSignup, ...action.payload };

      // Persist to localStorage on Web to survive refreshes
      if (Platform.OS === 'web') {
        localStorage.setItem('phoneSignup', JSON.stringify(state.phoneSignup));
      }
    },
    resetSignupData: (state) => {
      state.emailSignup = {};
      state.phoneSignup = {};
      if (Platform.OS === 'web') {
        localStorage.removeItem('phoneSignup');
      }
    },
    setUser: (state, action: PayloadAction<any | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    updateUser: (state, action: PayloadAction<Partial<any>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    setBiometricsEnabled: (state, action: PayloadAction<boolean>) => {
      state.isBiometricsEnabled = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
    }
  },
});

export const {
  setEmailSignupData,
  setPhoneSignupData,
  resetSignupData,
  setUser,
  updateUser,
  setBiometricsEnabled,
  logout
} = authSlice.actions;
export default authSlice.reducer;
