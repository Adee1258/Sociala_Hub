import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  Image,
  Animated,
  StatusBar,
} from 'react-native';
import { Text, TextInput, MD3LightTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import {
  hasHardwareAsync,
  isEnrolledAsync,
  authenticateAsync,
} from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import AnimatedRN, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import SocialAuthButtons from '@/components/SocialAuthButtons';

const INPUT_THEME = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    onSurface: '#1E293B',
    onSurfaceVariant: '#94A3B8',
  },
};

const PRIMARY = '#7C3AED';
const PRIMARY_LIGHT = '#F3E8FF';
const PRIMARY_MID = '#EDE9FE';

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { login, completeLogin } = useAuth();
  const cardWidth = Math.min(width - 48, 400);

  // Form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Quick login / biometrics state
  const [lastUser, setLastUser] = useState<any>(null);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [showQuickLogin, setShowQuickLogin] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  
  // New state for purely phone+biometric login
  const [isQuickLoginMode, setIsQuickLoginMode] = useState(false);
  const [quickLoginPhone, setQuickLoginPhone] = useState('');

  // Pulse animation for fingerprint button
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initLogin();
  }, []);

  // Pulse loop for fingerprint button
  useEffect(() => {
    if (showQuickLogin && biometricsAvailable && biometricsEnabled) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [showQuickLogin, biometricsAvailable, biometricsEnabled]);

  const initLogin = async () => {
    try {
      // Check hardware — only on native, web doesn't support biometrics
      let hw = false;
      let enrolled = false;
      if (Platform.OS !== 'web') {
        hw = await hasHardwareAsync();
        enrolled = hw ? await isEnrolledAsync() : false;
      }
      setBiometricsAvailable(hw && enrolled);

      // Load saved user
      const savedStr = Platform.OS === 'web'
        ? localStorage.getItem('last_user_info')
        : await SecureStore.getItemAsync('last_user_info');

      if (!savedStr) return;

      const saved = JSON.parse(savedStr);
      setLastUser(saved);

      // Check if biometrics enabled by user
      const bioFlag = Platform.OS === 'web'
        ? localStorage.getItem('biometrics_enabled')
        : await SecureStore.getItemAsync('biometrics_enabled');

      const bioOn = bioFlag === 'true';
      setBiometricsEnabled(bioOn);
      setShowQuickLogin(true);

      // Auto-trigger biometric prompt — only if all conditions met
      if (bioOn && hw && enrolled && saved.savedPassword) {
        setTimeout(() => triggerBiometricLogin(saved), 700);
      }
    } catch (e) {
      console.error('initLogin error:', e);
    }
  };

  const saveUserCredentials = async (user: any, pw: string) => {
    const info = JSON.stringify({
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePicture: user.profilePicture || null,
      savedPassword: pw,
    });
    Platform.OS === 'web'
      ? localStorage.setItem('last_user_info', info)
      : await SecureStore.setItemAsync('last_user_info', info);
  };

  const triggerBiometricLogin = async (targetUser: any) => {
    if (!targetUser?.savedPassword) {
      switchToPasswordForm(targetUser?.username);
      return;
    }
    try {
      const result = await authenticateAsync({
        promptMessage: `Log in as @${targetUser.username}`,
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        setBiometricLoading(true);
        try {
          const user = await login({ username: targetUser.username, password: targetUser.savedPassword });
          if (user) {
            await completeLogin(user);
            router.replace('/(tabs)');
          }
        } catch (e: any) {
          const msg = e?.message?.toLowerCase() || '';
          if (msg.includes('network') || msg.includes('fetch') || msg.includes('connect')) {
            Alert.alert('Server Offline', 'Biometric verified but server is unreachable.', [
              { text: 'Use Password', onPress: () => switchToPasswordForm(targetUser.username) },
            ]);
          } else {
            Alert.alert('Session Changed', 'Please enter your password.', [
              { text: 'OK', onPress: () => switchToPasswordForm(targetUser.username) },
            ]);
          }
        } finally {
          setBiometricLoading(false);
        }
      }
      // cancelled or failed — do nothing, user stays on quick login screen
    } catch (e) {
      console.error('Biometric error:', e);
      setBiometricLoading(false);
    }
  };

  const switchToPasswordForm = (prefillUsername?: string) => {
    setShowQuickLogin(false);
    if (prefillUsername) setIdentifier(prefillUsername);
  };

  // Quick login — uses lastUser.username with typed password
  const handleQuickLogin = async () => {
    if (!lastUser?.username) return;
    if (!password.trim()) {
      Alert.alert('Enter Password', 'Please type your password to continue.');
      return;
    }
    try {
      setIsLoading(true);
      const user = await login({ username: lastUser.username, password: password.trim() });
      if (user) {
        // Update stored credentials with the newly confirmed password
        await saveUserCredentials(user, password.trim());
        await completeLogin(user);
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.error('Quick login error:', error);
      Alert.alert('Login Failed', error.message || 'Wrong password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter your username/email/phone and password.');
      return;
    }
    try {
      setIsLoading(true);
      const user = await login({ username: identifier.trim(), password });
      if (user) {
        await saveUserCredentials(user, password);
        await completeLogin(user);
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneQuickLogin = async () => {
    if (!quickLoginPhone.trim()) {
      Alert.alert('Missing Phone', 'Please enter your phone number to login quickly.');
      return;
    }
    
    // Check hardware
    const hw = await hasHardwareAsync();
    const enrolled = await isEnrolledAsync();
    if (!hw || !enrolled) {
      Alert.alert('Not Supported', 'Biometrics (FaceID/Fingerprint) is not set up on this device.');
      return;
    }

    try {
      setBiometricLoading(true);
      const result = await authenticateAsync({
        promptMessage: `Log in with Phone: ${quickLoginPhone}`,
        fallbackLabel: 'Use Password Instead',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        // Call new backend route
        setIsLoading(true);
        const { default: apiService } = require('@/services/api');
        const response = await apiService.quickLogin(quickLoginPhone.trim());
        if (response && response.user) {
          await completeLogin(response.user);
          router.replace('/(tabs)');
        }
      }
    } catch (e: any) {
      Alert.alert('Quick Login Failed', e.message || 'Could not verify biometrics.');
    } finally {
      setBiometricLoading(false);
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER — Quick Login screen (when returning user detected)
  // ─────────────────────────────────────────────────────────────
  if (showQuickLogin && lastUser) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <AnimatedRN.View entering={FadeInDown.duration(600)} style={styles.header}>
            <View style={styles.logoCircle}>
              <FontAwesome name="users" size={32} color={PRIMARY} />
            </View>
            <Text style={styles.appName}>Social Hub</Text>
          </AnimatedRN.View>

          {/* Welcome card */}
          <AnimatedRN.View
            entering={FadeInUp.delay(100).duration(600)}
            style={[styles.quickCard, { width: cardWidth }]}
          >
            {/* Avatar */}
            <View style={styles.avatarWrapper}>
              {lastUser.profilePicture ? (
                <Image source={{ uri: lastUser.profilePicture }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>
                    {(lastUser.firstName || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              {/* Online indicator dot */}
              <View style={styles.avatarDot} />
            </View>

            <Text style={styles.quickWelcome}>Welcome back,</Text>
            <Text style={styles.quickName}>{lastUser.firstName} {lastUser.lastName || ''}</Text>
            <Text style={styles.quickHandle}>@{lastUser.username}</Text>

            {/* ── ALWAYS show both: fingerprint (if available) + password ── */}
            <AnimatedRN.View entering={FadeIn.delay(200)} style={styles.authSection}>

              {/* Fingerprint button — show if hardware available, regardless of password */}
              {biometricsAvailable && (
                <View style={styles.bioRow}>
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.fingerprintBtn,
                        pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] },
                        biometricLoading && { opacity: 0.7 },
                      ]}
                      onPress={() => triggerBiometricLogin(lastUser)}
                      disabled={biometricLoading}
                    >
                      {biometricLoading ? (
                        <ActivityIndicator color="#FFFFFF" size={28} />
                      ) : (
                        <MaterialCommunityIcons name="fingerprint" size={36} color="#FFFFFF" />
                      )}
                    </Pressable>
                  </Animated.View>
                  <View style={styles.bioLabelCol}>
                    <Text style={styles.bioTitle}>Quick Login</Text>
                    <Text style={styles.bioHint}>
                      {biometricLoading ? 'Verifying...' : 'Tap fingerprint to sign in instantly'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Divider */}
              {biometricsAvailable && (
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or use password</Text>
                  <View style={styles.dividerLine} />
                </View>
              )}

              {/* Password field — always visible */}
              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                style={styles.input}
                textColor="#1E293B"
                outlineColor="#E2E8F0"
                activeOutlineColor={PRIMARY}
                outlineStyle={{ borderRadius: 12, borderWidth: 1.5 }}
                secureTextEntry={!showPassword}
                left={<TextInput.Icon icon="lock-outline" color="#94A3B8" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(!showPassword)}
                    color="#94A3B8"
                  />
                }
                theme={INPUT_THEME}
                onSubmitEditing={handleQuickLogin}
                returnKeyType="go"
              />

              <View style={styles.forgotRow}>
                <Pressable onPress={() => router.push('/(auth)/forgot-password' as any)}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </Pressable>
              </View>

              {/* Log In button */}
              <Pressable
                style={({ pressed }) => [
                  styles.loginBtn,
                  (isLoading || !password) && styles.loginBtnDisabled,
                  pressed && !isLoading && { transform: [{ scale: 0.98 }] },
                ]}
                onPress={handleQuickLogin}
                disabled={isLoading || !password}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnLabel}>Log In</Text>
                )}
              </Pressable>
            </AnimatedRN.View>
          </AnimatedRN.View>

          {/* Switch account */}
          <AnimatedRN.View entering={FadeIn.delay(300)} style={[styles.bottomLinks, { width: cardWidth }]}>
            <Pressable
              style={styles.switchAccountBtn}
              onPress={() => { setShowQuickLogin(false); setIdentifier(''); setPassword(''); }}
            >
              <MaterialCommunityIcons name="account-switch-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
              <Text style={styles.switchAccountText}>Use a different account</Text>
            </Pressable>

            <View style={styles.signupRow}>
              <Text style={styles.promptText}>New here? </Text>
              <Pressable onPress={() => router.push('/(auth)/signup' as any)}>
                <Text style={styles.signupLink}>Create Account</Text>
              </Pressable>
            </View>
          </AnimatedRN.View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER — Standard Login form (new user or switched account)
  // ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <AnimatedRN.View entering={FadeInDown.duration(700)} style={styles.header}>
          <View style={styles.logoCircle}>
            <FontAwesome name="users" size={32} color={PRIMARY} />
          </View>
          <Text style={styles.appName}>Social Hub</Text>
          <Text style={styles.tagline}>Connect, Share & Grow together</Text>
        </AnimatedRN.View>

        {/* Form card */}
        <AnimatedRN.View
          entering={FadeInUp.delay(150).duration(600)}
          style={[styles.formCard, { width: cardWidth }]}
        >
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>Enter your details below</Text>

          {/* Toggle between standard and quick login */}
          {!isQuickLoginMode ? (
            <>
              {/* Identifier */}
              <TextInput
                label="Username, Email or Phone"
                value={identifier}
                onChangeText={setIdentifier}
                mode="outlined"
                style={styles.input}
                textColor="#1E293B"
                outlineColor="#E2E8F0"
                activeOutlineColor={PRIMARY}
                outlineStyle={{ borderRadius: 12, borderWidth: 1.5 }}
                autoCapitalize="none"
                keyboardType="default"
                left={<TextInput.Icon icon="account-outline" color="#94A3B8" />}
                theme={INPUT_THEME}
                returnKeyType="next"
              />

              {/* Password */}
              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                style={styles.input}
                textColor="#1E293B"
                outlineColor="#E2E8F0"
                activeOutlineColor={PRIMARY}
                outlineStyle={{ borderRadius: 12, borderWidth: 1.5 }}
                secureTextEntry={!showPassword}
                left={<TextInput.Icon icon="lock-outline" color="#94A3B8" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(!showPassword)}
                    color="#94A3B8"
                  />
                }
                theme={INPUT_THEME}
                onSubmitEditing={handleLogin}
                returnKeyType="go"
              />

              {/* Action row */}
              <View style={styles.actionRow}>
                {/* Biometrics shortcut — only show if returning user + hardware available */}
                {lastUser?.username && biometricsAvailable && biometricsEnabled && (
                  <Pressable
                    style={styles.biometricChip}
                    onPress={() => {
                      setShowQuickLogin(true);
                      setTimeout(() => triggerBiometricLogin(lastUser), 300);
                    }}
                  >
                    <MaterialCommunityIcons name="fingerprint" size={18} color={PRIMARY} />
                    <Text style={styles.biometricChipText}>Biometrics</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => router.push('/(auth)/forgot-password' as any)}
                  style={{ marginLeft: 'auto' }}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </Pressable>
              </View>

              {/* Login button */}
              <Pressable
                style={({ pressed }) => [
                  styles.loginBtn,
                  (isLoading || !identifier || !password) && styles.loginBtnDisabled,
                  pressed && !isLoading && { transform: [{ scale: 0.98 }] },
                ]}
                onPress={handleLogin}
                disabled={isLoading || !identifier || !password}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnLabel}>Log In</Text>
                )}
              </Pressable>
              
              <Pressable style={{ alignItems: 'center', marginTop: 12, marginBottom: 8 }} onPress={() => setIsQuickLoginMode(true)}>
                <Text style={{ color: PRIMARY, fontWeight: '700' }}>Try Quick Login (FaceID / Fingerprint) ✨</Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* Phone Quick Login View */}
              <Text style={{ textAlign: 'center', color: '#64748B', marginBottom: 20 }}>
                Enter your registered phone number and scan your fingerprint or face to login instantly without a password.
              </Text>
              
              <TextInput
                label="Phone Number"
                value={quickLoginPhone}
                onChangeText={setQuickLoginPhone}
                mode="outlined"
                style={styles.input}
                textColor="#1E293B"
                outlineColor="#E2E8F0"
                activeOutlineColor={PRIMARY}
                outlineStyle={{ borderRadius: 12, borderWidth: 1.5 }}
                keyboardType="phone-pad"
                left={<TextInput.Icon icon="phone-outline" color="#94A3B8" />}
                theme={INPUT_THEME}
                returnKeyType="go"
              />
              
              <Pressable
                style={({ pressed }) => [
                  styles.loginBtn,
                  (isLoading || biometricLoading || !quickLoginPhone) && styles.loginBtnDisabled,
                  pressed && !isLoading && !biometricLoading && { transform: [{ scale: 0.98 }] },
                ]}
                onPress={handlePhoneQuickLogin}
                disabled={isLoading || biometricLoading || !quickLoginPhone}
              >
                {isLoading || biometricLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="fingerprint" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.btnLabel}>Scan & Log In</Text>
                  </View>
                )}
              </Pressable>
              
              <Pressable style={{ alignItems: 'center', marginTop: 16 }} onPress={() => setIsQuickLoginMode(false)}>
                <Text style={{ color: '#64748B', fontWeight: '600' }}>Use standard Password login</Text>
              </Pressable>
            </>
          )}

          {/* Social auth */}
          <SocialAuthButtons />
        </AnimatedRN.View>

        {/* Sign up link */}
        <AnimatedRN.View entering={FadeIn.delay(400)} style={styles.signupRow}>
          <Text style={styles.promptText}>Don't have an account? </Text>
          <Pressable onPress={() => router.push('/(auth)/signup' as any)}>
            <Text style={styles.signupLink}>Sign Up</Text>
          </Pressable>
        </AnimatedRN.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Header ──
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: PRIMARY_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  appName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },

  // ── Standard form card ──
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 24,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  biometricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY_LIGHT,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  biometricChipText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '700',
  },
  forgotText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '700',
  },
  loginBtn: {
    backgroundColor: PRIMARY,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 4,
  },
  loginBtnDisabled: {
    opacity: 0.55,
  },
  btnLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // ── Quick login card ──
  quickCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: PRIMARY,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: PRIMARY_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: PRIMARY,
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '900',
    color: PRIMARY,
  },
  avatarDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  quickWelcome: {
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 2,
  },
  quickName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  quickHandle: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 28,
  },

  // ── Auth section (fingerprint + password combined) ──
  authSection: {
    width: '100%',
  },
  bioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_LIGHT,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    gap: 16,
  },
  bioLabelCol: {
    flex: 1,
  },
  bioTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 2,
  },
  fingerprintBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  bioHint: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: 16,
    marginTop: -4,
  },

  // ── Bottom links ──
  bottomLinks: {
    alignItems: 'center',
    gap: 12,
  },
  switchAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  switchAccountText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  promptText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  signupLink: {
    color: PRIMARY,
    fontWeight: '800',
    fontSize: 14,
  },
});
