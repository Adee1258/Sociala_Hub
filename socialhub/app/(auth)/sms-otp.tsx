import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import apiService from '@/services/api';
import { FontAwesome } from '@expo/vector-icons';
import AnimatedRN, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from '@/context/AuthContext';

const PRIMARY = '#7C3AED';

export default function SmsOtpScreen() {
  const router = useRouter();
  const { devOTP } = useLocalSearchParams<{ devOTP?: string }>();
  const { width } = useWindowDimensions();
  const signupData = useSelector((state: RootState) => state.auth.phoneSignup);
  const { completeLogin } = useAuth();

  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [shakeAnimation] = useState(new Animated.Value(0));
  const [hasError, setHasError] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const cardWidth = Math.min(width - 48, 400);
  const boxSize = Math.min(Math.floor((cardWidth - 5 * 10) / 6), 50);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((p) => p - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    const t = setTimeout(() => inputRefs.current[0]?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  const triggerShake = () => {
    setHasError(true);
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      setCode(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    });
  };

  const handleTextChange = (text: string, index: number) => {
    setHasError(false);
    if (text.length > 1) {
      const digits = text.replace(/[^0-9]/g, '').slice(0, 6).split('');
      const newCode = Array(6).fill('');
      for (let i = 0; i < 6; i++) newCode[i] = digits[i] || '';
      setCode(newCode);
      const nextFocus = digits.length < 6 ? digits.length : 5;
      inputRefs.current[nextFocus]?.focus();
      if (digits.length === 6) verifyCode(newCode.join(''));
      return;
    }
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    if (text && index < 5) inputRefs.current[index + 1]?.focus();
    if (newCode.every((v) => v !== '') && newCode.join('').length === 6) verifyCode(newCode.join(''));
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      setHasError(false);
      if (!code[index] && index > 0) {
        const newCode = [...code];
        newCode[index - 1] = '';
        setCode(newCode);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const verifyCode = async (otpValue: string) => {
    const fullNumber = signupData.countryCode
      ? signupData.countryCode + signupData.phoneNumber
      : signupData.phoneNumber;
    if (!fullNumber) return;
    setLoading(true);
    try {
      // Step 1: Verify the OTP itself
      const verifyRes = await apiService.verifyOTP(fullNumber, otpValue, 'phone');
      if (!verifyRes.success) { triggerShake(); setLoading(false); return; }

      // Step 2: Check if an account already exists with this number
      const loginRes = await apiService.loginOTP(fullNumber, 'phone');

      if (loginRes.exists && loginRes.token && loginRes.user) {
        // Existing account found — log them in directly
        await apiService.setToken(loginRes.token);
        await completeLogin(loginRes.user);
        Alert.alert(
          'Welcome Back!',
          `Your existing account @${loginRes.user.username} has been restored.`,
          [{ text: 'Continue', onPress: () => router.replace('/(tabs)' as any) }]
        );
      } else {
        // No account — proceed to profile creation
        router.replace('/(auth)/profile-setup' as any);
      }
    } catch {
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    const fullNumber = signupData.countryCode
      ? signupData.countryCode + signupData.phoneNumber
      : signupData.phoneNumber;
    if (!fullNumber) return;
    setLoading(true);
    try {
      const res = await apiService.sendSMSOTP(fullNumber);
      if (res.success) {
        const msg = res.devOTP
          ? `New code sent! (Dev Mode: ${res.devOTP})`
          : `New code sent to ${signupData.countryCode} ${signupData.phoneNumber}.`;

        Alert.alert('Code Resent', msg);
        setResendTimer(60);
        setCode(Array(6).fill(''));
        inputRefs.current[0]?.focus();
      } else {
        Alert.alert('Error', res.message || 'Unable to resend code.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Resend failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const isComplete = code.every((v) => v !== '');
  const formattedTime = `${Math.floor(resendTimer / 60).toString().padStart(2, '0')}:${(resendTimer % 60).toString().padStart(2, '0')}`;

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
        <AnimatedRN.View entering={FadeInUp.duration(400)} style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome name="chevron-left" size={16} color="#1E293B" />
          </Pressable>
        </AnimatedRN.View>

        {/* Title */}
        <AnimatedRN.View
          entering={FadeInUp.delay(100).duration(500)}
          style={[styles.titleSection, { maxWidth: Math.min(width - 48, 400) }]}
        >
          <Text style={styles.titleText}>Verify your number</Text>
          <Text style={styles.subtitleText}>
            We've sent a 6-digit code to
          </Text>
          <Text style={[styles.phoneHighlight, { color: PRIMARY }]}>
            {signupData.countryCode} {signupData.phoneNumber || 'your phone'}
          </Text>
        </AnimatedRN.View>

        {/* Development Mode OTP Display */}
        {devOTP && (
          <AnimatedRN.View
            entering={FadeInUp.delay(150)}
            style={styles.devOtpContainer}
          >
            <Text style={styles.devOtpLabel}>Development Code:</Text>
            <Text style={[styles.devOtpText, { color: PRIMARY }]}>{devOTP}</Text>
          </AnimatedRN.View>
        )}

        {/* OTP Input */}
        <AnimatedRN.View
          entering={FadeInDown.delay(200).duration(600)}
          style={[styles.otpSection, { maxWidth: Math.min(width - 48, 400) }]}
        >
          <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
            <View style={styles.otpRow}>
              {Array(6).fill(0).map((_, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputRefs.current[index] = ref; }}
                  style={[
                    styles.otpBox,
                    {
                      width: boxSize,
                      height: boxSize + 6,
                      borderColor: hasError
                        ? '#EF4444'
                        : code[index] !== ''
                          ? PRIMARY
                          : '#E2E8F0',
                      backgroundColor: hasError
                        ? 'rgba(239,68,68,0.05)'
                        : code[index] !== ''
                          ? '#F5F3FF'
                          : '#F8FAFC',
                      color: hasError ? '#EF4444' : '#1E293B',
                    },
                  ]}
                  maxLength={6}
                  keyboardType="number-pad"
                  value={code[index]}
                  onChangeText={(text) => handleTextChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  selectTextOnFocus
                  caretHidden
                />
              ))}
            </View>
          </Animated.View>

          {/* Status */}
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size={20} color={PRIMARY} />
              <Text style={[styles.hintText, { color: PRIMARY }]}>Verifying...</Text>
            </View>
          ) : hasError ? (
            <Text style={styles.errorHint}>Incorrect code. Please try again.</Text>
          ) : (
            <Text style={styles.hintText}>Auto-verifies when all 6 digits are entered.</Text>
          )}

          {/* Resend */}
          <View style={styles.resendRow}>
            {resendTimer > 0 ? (
              <Text style={styles.timerText}>
                Didn't receive code?{' '}
                <Text style={styles.timerBold}>Resend in {formattedTime}</Text>
              </Text>
            ) : (
              <Pressable onPress={handleResend} disabled={loading}>
                <Text style={[styles.resendLink, { color: PRIMARY }]}>Resend Code</Text>
              </Pressable>
            )}
          </View>

          {/* Verify Button — shows when complete */}
          {isComplete && !loading && (
            <Pressable
              style={({ pressed }) => [
                styles.verifyBtn,
                { backgroundColor: hasError ? '#EF4444' : PRIMARY, opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={() => verifyCode(code.join(''))}
            >
              <Text style={styles.verifyBtnText}>
                {hasError ? 'Try Again' : 'Verify'}
              </Text>
            </Pressable>
          )}
        </AnimatedRN.View>
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
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleSection: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 40,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 8,
    fontWeight: '500',
  },
  phoneHighlight: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  devOtpContainer: {
    backgroundColor: '#F5F3FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderStyle: 'dashed',
    width: '100%',
  },
  devOtpLabel: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  devOtpText: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
  },
  otpSection: {
    marginTop: 40,
    width: '100%',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  otpBox: {
    borderRadius: 12,
    borderWidth: 2,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
  },
  loadingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  hintText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 20,
  },
  errorHint: {
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 20,
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: 24,
  },
  timerText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  timerBold: {
    fontWeight: '800',
    color: '#475569',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  verifyBtn: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  verifyBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
