import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { Text, TextInput, MD3LightTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import apiService from '@/services/api';

const INPUT_THEME = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    onSurface: '#1E293B',
    onSurfaceVariant: '#94A3B8',
  },
};

const PRIMARY = '#7C3AED';

type Step = 'enter-identifier' | 'enter-otp' | 'new-password';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 400);

  const [step, setStep] = useState<Step>('enter-identifier');
  const [identifier, setIdentifier] = useState('');
  const [identifierType, setIdentifierType] = useState<'email' | 'phone'>('email');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined);
  const [resendTimer, setResendTimer] = useState(0);
  const [resendInterval, setResendIntervalRef] = useState<any>(null);

  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setResendIntervalRef(interval);
  };

  const detectType = (value: string): 'email' | 'phone' => {
    return value.includes('@') ? 'email' : 'phone';
  };

  // Step 1 — Send OTP
  const handleSendOTP = async () => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter your email or phone number.');
      return;
    }

    const type = detectType(trimmed);
    setIdentifierType(type);

    setLoading(true);
    try {
      let res;
      if (type === 'email') {
        res = await apiService.sendEmailOTP(trimmed);
      } else {
        // Normalize phone — add + if missing
        const phone = trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
        res = await apiService.sendSMSOTP(phone);
      }

      if (res.success) {
        setDevOtp(res.devOTP);
        setStep('enter-otp');
        startResendTimer();
      } else {
        Alert.alert('Error', res.message || 'Failed to send code.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — Verify OTP
  const handleVerifyOTP = async () => {
    if (otp.length < 6) {
      Alert.alert('Invalid', 'Please enter the 6-digit code.');
      return;
    }

    const trimmed = identifier.trim();
    const phone = identifierType === 'phone'
      ? (trimmed.startsWith('+') ? trimmed : `+${trimmed}`)
      : trimmed;

    setLoading(true);
    try {
      const res = await apiService.verifyOTP(phone, otp, identifierType);
      if (res.success) {
        setStep('new-password');
      } else {
        Alert.alert('Wrong Code', res.message || 'Incorrect OTP. Try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3 — Reset Password
  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    const trimmed = identifier.trim();
    const normalizedIdentifier = identifierType === 'phone'
      ? (trimmed.startsWith('+') ? trimmed : `+${trimmed}`)
      : trimmed;

    setLoading(true);
    try {
      const res = await apiService.resetPassword(normalizedIdentifier, identifierType, newPassword);
      if (res.success) {
        Alert.alert(
          'Password Reset!',
          'Your password has been updated. Please log in.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login' as any) }]
        );
      } else {
        Alert.alert('Failed', res.message || 'Could not reset password.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    const trimmed = identifier.trim();
    const type = detectType(trimmed);
    setLoading(true);
    try {
      let res;
      if (type === 'email') {
        res = await apiService.sendEmailOTP(trimmed);
      } else {
        const phone = trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
        res = await apiService.sendSMSOTP(phone);
      }
      if (res.success) {
        setDevOtp(res.devOTP);
        setOtp('');
        startResendTimer();
        Alert.alert('Sent!', 'A new code has been sent.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Resend failed.');
    } finally {
      setLoading(false);
    }
  };

  // Password strength
  const hasMinLength = newPassword.length >= 8;
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  let strengthScore = 0;
  if (hasMinLength) strengthScore++;
  if (hasNumber) strengthScore++;
  if (hasSpecial) strengthScore++;
  const strengthColor = strengthScore === 1 ? '#EF4444' : strengthScore === 2 ? '#F97316' : '#10B981';
  const strengthLabel = !newPassword ? '' : strengthScore === 1 ? 'Weak' : strengthScore === 2 ? 'Medium' : 'Strong';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.topBar}>
          <Pressable
            onPress={() => {
              if (step === 'enter-identifier') router.back();
              else if (step === 'enter-otp') setStep('enter-identifier');
              else setStep('enter-otp');
            }}
            style={styles.backBtn}
          >
            <FontAwesome name="chevron-left" size={16} color="#1E293B" />
          </Pressable>
          {/* Step indicator */}
          <View style={styles.stepRow}>
            {(['enter-identifier', 'enter-otp', 'new-password'] as Step[]).map((s, i) => (
              <View
                key={s}
                style={[
                  styles.stepDot,
                  {
                    backgroundColor:
                      step === s ? PRIMARY : i < (['enter-identifier', 'enter-otp', 'new-password'] as Step[]).indexOf(step) ? '#10B981' : '#E2E8F0',
                  },
                ]}
              />
            ))}
          </View>
        </Animated.View>

        {/* ─── STEP 1: Enter Identifier ─── */}
        {step === 'enter-identifier' && (
          <Animated.View entering={FadeInDown.duration(500)} style={{ width: '100%', alignItems: 'center' }}>
            <View style={[styles.titleSection, { maxWidth: cardWidth }]}>
              <View style={styles.iconCircle}>
                <FontAwesome name="lock" size={28} color={PRIMARY} />
              </View>
              <Text style={styles.titleText}>Forgot Password?</Text>
              <Text style={styles.subtitleText}>
                Enter your email or phone number and we'll send you a verification code.
              </Text>
            </View>

            <View style={[styles.formSection, { maxWidth: cardWidth }]}>
              <TextInput
                label="Email or Phone Number"
                value={identifier}
                onChangeText={setIdentifier}
                mode="outlined"
                style={styles.input}
                textColor="#1E293B"
                outlineColor="#E2E8F0"
                activeOutlineColor={PRIMARY}
                outlineStyle={{ borderRadius: 12, borderWidth: 1.5 }}
                autoCapitalize="none"
                keyboardType="email-address"
                left={<TextInput.Icon icon="account-search-outline" color="#94A3B8" />}
                theme={INPUT_THEME}
                placeholder="e.g. user@email.com or +923001234567"
              />

              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { opacity: pressed || loading ? 0.85 : 1 },
                ]}
                onPress={handleSendOTP}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Send Verification Code</Text>
                )}
              </Pressable>

              <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Back to Login</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* ─── STEP 2: Enter OTP ─── */}
        {step === 'enter-otp' && (
          <Animated.View entering={FadeInDown.duration(500)} style={{ width: '100%', alignItems: 'center' }}>
            <View style={[styles.titleSection, { maxWidth: cardWidth }]}>
              <View style={styles.iconCircle}>
                <FontAwesome name="mobile" size={30} color={PRIMARY} />
              </View>
              <Text style={styles.titleText}>Enter the Code</Text>
              <Text style={styles.subtitleText}>
                We sent a 6-digit code to{'\n'}
                <Text style={{ color: PRIMARY, fontWeight: '800' }}>
                  {identifier.trim()}
                </Text>
              </Text>
            </View>

            {/* Dev OTP Banner */}
            {devOtp && (
              <View style={[styles.devBanner, { maxWidth: cardWidth }]}>
                <Text style={styles.devBannerLabel}>DEV MODE CODE</Text>
                <Text style={[styles.devBannerCode, { color: PRIMARY }]}>{devOtp}</Text>
              </View>
            )}

            <View style={[styles.formSection, { maxWidth: cardWidth }]}>
              <TextInput
                label="6-Digit Code"
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
                mode="outlined"
                style={styles.input}
                textColor="#1E293B"
                outlineColor="#E2E8F0"
                activeOutlineColor={PRIMARY}
                outlineStyle={{ borderRadius: 12, borderWidth: 1.5 }}
                keyboardType="number-pad"
                maxLength={6}
                left={<TextInput.Icon icon="shield-key-outline" color="#94A3B8" />}
                theme={INPUT_THEME}
                placeholder="000000"
              />

              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { opacity: pressed || loading ? 0.85 : 1 },
                ]}
                onPress={handleVerifyOTP}
                disabled={loading || otp.length < 6}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Verify Code</Text>
                )}
              </Pressable>

              {/* Resend */}
              <View style={styles.resendRow}>
                {resendTimer > 0 ? (
                  <Text style={styles.timerText}>
                    Resend in{' '}
                    <Text style={{ fontWeight: '800', color: '#475569' }}>
                      {String(Math.floor(resendTimer / 60)).padStart(2, '0')}:
                      {String(resendTimer % 60).padStart(2, '0')}
                    </Text>
                  </Text>
                ) : (
                  <Pressable onPress={handleResend} disabled={loading}>
                    <Text style={[styles.resendLink, { color: PRIMARY }]}>Resend Code</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </Animated.View>
        )}

        {/* ─── STEP 3: New Password ─── */}
        {step === 'new-password' && (
          <Animated.View entering={FadeInDown.duration(500)} style={{ width: '100%', alignItems: 'center' }}>
            <View style={[styles.titleSection, { maxWidth: cardWidth }]}>
              <View style={styles.iconCircle}>
                <FontAwesome name="key" size={26} color={PRIMARY} />
              </View>
              <Text style={styles.titleText}>Set New Password</Text>
              <Text style={styles.subtitleText}>
                Create a strong new password for your account.
              </Text>
            </View>

            <View style={[styles.formSection, { maxWidth: cardWidth }]}>
              <TextInput
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
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
                    color="#94A3B8"
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
                theme={INPUT_THEME}
              />

              {/* Strength indicator */}
              {newPassword.length > 0 && (
                <View style={styles.strengthRow}>
                  {[1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthBar,
                        { backgroundColor: i <= strengthScore ? strengthColor : '#E2E8F0' },
                      ]}
                    />
                  ))}
                  <Text style={[styles.strengthLabel, { color: strengthColor }]}>
                    {strengthLabel}
                  </Text>
                </View>
              )}

              <TextInput
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                mode="outlined"
                style={[styles.input, { marginTop: 12 }]}
                textColor="#1E293B"
                outlineColor={confirmPassword && confirmPassword !== newPassword ? '#EF4444' : '#E2E8F0'}
                activeOutlineColor={confirmPassword && confirmPassword !== newPassword ? '#EF4444' : PRIMARY}
                outlineStyle={{ borderRadius: 12, borderWidth: 1.5 }}
                secureTextEntry={!showPassword}
                left={<TextInput.Icon icon="shield-check-outline" color="#94A3B8" />}
                theme={INPUT_THEME}
              />
              {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                <Text style={styles.errorText}>Passwords do not match</Text>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { marginTop: 20, opacity: pressed || loading ? 0.85 : 1 },
                ]}
                onPress={handleResetPassword}
                disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Reset Password</Text>
                )}
              </Pressable>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    marginBottom: 36,
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 8,
    marginRight: 42, // balance with back button
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  titleSection: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 22,
  },
  formSection: {
    width: '100%',
  },
  input: {
    backgroundColor: '#FFFFFF',
    color: '#1E293B',
    marginBottom: 8,
  },
  primaryBtn: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  cancelText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 20,
  },
  timerText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  devBanner: {
    backgroundColor: '#F5F3FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderStyle: 'dashed',
    width: '100%',
  },
  devBannerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  devBannerCode: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  strengthBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '800',
    width: 50,
    textAlign: 'right',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
    marginTop: 4,
    paddingHorizontal: 4,
  },
});
