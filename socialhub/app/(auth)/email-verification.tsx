import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, Animated, useWindowDimensions } from 'react-native';

const PRIMARY = '#7C3AED';
const PRIMARY_BG = '#F5F3FF';
import { Text, Button, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import apiService from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { FontAwesome } from '@expo/vector-icons';
import AnimatedRN, { FadeInDown, FadeInUp } from 'react-native-reanimated';

export default function EmailVerificationScreen() {
  const router = useRouter();
  const { completeLogin } = useAuth();
  const { width } = useWindowDimensions();
  
  // Select transient signup data from store
  const signupData = useSelector((state: RootState) => state.auth.emailSignup);
  
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [shakeAnimation] = useState(new Animated.Value(0));
  const [hasError, setHasError] = useState(false);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Countdown timer for resending code
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Focus the first input box on load
  useEffect(() => {
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 400);
  }, []);

  // Trigger shake animation for wrong OTP code
  const triggerShake = () => {
    setHasError(true);
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      // Clear OTP on shake complete
      setCode(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    });
  };

  const handleTextChange = (text: string, index: number) => {
    setHasError(false);
    
    // Support clipboard paste (e.g. typing or pasting multiple digits)
    if (text.length > 1) {
      const digits = text.replace(/[^0-9]/g, '').slice(0, 6).split('');
      const newCode = Array(6).fill('');
      for (let i = 0; i < 6; i++) {
        newCode[i] = digits[i] || '';
      }
      setCode(newCode);
      
      // Focus appropriate box
      const nextFocus = digits.length < 6 ? digits.length : 5;
      inputRefs.current[nextFocus]?.focus();
      
      // Auto verify if complete
      if (digits.length === 6) {
        verifyCode(newCode.join(''));
      }
      return;
    }

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-advance
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify if all boxes filled
    if (newCode.every((val) => val !== '') && newCode.join('').length === 6) {
      verifyCode(newCode.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Retreat on Backspace
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
    if (!signupData.email) return;
    setLoading(true);
    try {
      // 1. Verify OTP with backend endpoint
      const verifyRes = await apiService.verifyOTP(signupData.email, otpValue, 'email');
      
      if (!verifyRes.success) {
        triggerShake();
        setLoading(false);
        return;
      }

      // 2. Perform backend Signup
      const signupPayload = {
        firstName: signupData.firstName || 'Email',
        lastName: signupData.lastName || 'User',
        username: signupData.username?.toLowerCase() || `user_${Math.floor(Math.random() * 10000)}`,
        email: signupData.email.toLowerCase(),
        dateOfBirth: { day: '01', month: 'January', year: '2000' }, // Fallback values
        gender: 'Prefer not to say', // Fallback
        password: signupData.password || 'Temporary123!',
        biometrics: { fingerprint: false, voice: false }
      };

      const signupRes = await apiService.signup(signupPayload);

      // 3. Upload avatar image if picked during setup
      if (signupData.profilePicture && signupRes.user) {
        try {
          await apiService.updateProfile({ profilePicture: signupData.profilePicture });
        } catch (imgErr) {
          console.warn('Avatar upload failed during verification step:', imgErr);
        }
      }

      // 4. Force auth state context login sync
      if (signupRes.user) {
        await completeLogin(signupRes.user);
      }

      // 5. Navigate to WelcomeConfetti screen
      router.replace({
        pathname: '/(auth)/welcome',
        params: { flow: 'email' }
      });
    } catch (err: any) {
      console.error(err);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!signupData.email || resendTimer > 0) return;
    setLoading(true);
    try {
      const res = await apiService.sendEmailOTP(signupData.email);
      if (res.success) {
        Alert.alert('Code Resent', `A new verification code has been dispatched to ${signupData.email}.`);
        setResendTimer(60);
        setCode(Array(6).fill(''));
        inputRefs.current[0]?.focus();
      } else {
        Alert.alert('Error', res.message || 'Unable to resend verification code.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Verification email resend failed.');
    } finally {
      setLoading(false);
    }
  };

  const shakeStyle = {
    transform: [{ translateX: shakeAnimation }]
  };

  const cardWidth = Math.min(width - 32, 480);
  const boxSize = Math.min(Math.floor((cardWidth - 48 - 5 * 8) / 6), 52);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back header navigation */}
        <AnimatedRN.View
          entering={FadeInUp.duration(400)}
          style={[styles.headerRow, { maxWidth: cardWidth, alignSelf: 'center', width: '100%' }]}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome name="chevron-left" size={16} color="#1E293B" />
          </Pressable>
          <Text style={styles.stepText}>Step 4 of 4</Text>
        </AnimatedRN.View>

        {/* Title branding */}
        <AnimatedRN.View entering={FadeInUp.delay(100).duration(500)} style={styles.titleContainer}>
          <Text style={styles.titleText}>Verify Email</Text>
          <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>
          <Text style={styles.emailHighlight}>{signupData.email || 'your email'}</Text>
        </AnimatedRN.View>

        {/* Verification Card with shake wrapper */}
        <AnimatedRN.View
          entering={FadeInDown.delay(200).duration(600)}
          style={[styles.cardContainer, { maxWidth: cardWidth, width: '100%' }]}
        >
          <Animated.View style={[styles.shakeCardWrapper, shakeStyle]}>
            <Surface style={styles.card} elevation={3}>
              <Text style={styles.cardHeader}>Enter Verification Code</Text>
              
              {/* 6-box input container */}
              <View style={styles.otpInputContainer}>
                {Array(6).fill(0).map((_, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[
                      styles.otpBox,
                      {
                        width: boxSize,
                        height: boxSize + 8,
                        borderColor: hasError ? '#EF4444' : code[index] !== '' ? PRIMARY : '#E2E8F0',
                        backgroundColor: hasError ? 'rgba(239,68,68,0.05)' : code[index] !== '' ? '#F5F3FF' : '#F8FAFC',
                        color: hasError ? '#EF4444' : '#0F172A',
                      }
                    ]}
                    maxLength={6} // allow pasting in any box
                    keyboardType="number-pad"
                    value={code[index]}
                    onChangeText={(text) => handleTextChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    selectTextOnFocus
                    caretHidden
                  />
                ))}
              </View>

              {/* Status or loading message */}
              {loading ? (
                <View style={styles.loadingWrapper}>
                  <ActivityIndicator size={24} color={PRIMARY} />
                  <Text style={[styles.loadingText, { color: PRIMARY }]}>Verifying your details...</Text>
                </View>
              ) : hasError ? (
                <Text style={styles.errorHintText}>Incorrect code. Please try again.</Text>
              ) : (
                <Text style={styles.hintText}>
                  Auto-verifies when all 6 digits are entered.
                </Text>
              )}

              {/* Resend actions */}
              <View style={styles.resendWrapper}>
                {resendTimer > 0 ? (
                  <Text style={styles.timerText}>
                    Resend code in <Text style={[styles.timerBold, { color: PRIMARY }]}>{resendTimer}s</Text>
                  </Text>
                ) : (
                  <Pressable onPress={handleResend} disabled={loading}>
                    <Text style={[styles.resendLink, { color: PRIMARY }]}>Resend Code</Text>
                  </Pressable>
                )}
              </View>
            </Surface>
          </Animated.View>
        </AnimatedRN.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PRIMARY_BG,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 30,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },
  emailHighlight: {
    fontSize: 15,
    color: PRIMARY,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  cardContainer: {
    alignSelf: 'center',
  },
  shakeCardWrapper: {
    width: '100%',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 28,
    padding: 24,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 15,
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 20,
  },
  otpInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    gap: 6,
  },
  otpBox: {
    borderRadius: 14,
    borderWidth: 2,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
  },
  loadingWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '700',
  },
  hintText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '600',
    marginVertical: 8,
  },
  errorHintText: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '700',
    marginVertical: 8,
  },
  resendWrapper: {
    alignItems: 'center',
    marginTop: 16,
  },
  timerText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  timerBold: {
    color: '#185FA5',
    fontWeight: '800',
  },
  resendLink: {
    fontSize: 14,
    color: '#185FA5',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
