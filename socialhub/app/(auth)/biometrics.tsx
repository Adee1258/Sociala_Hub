import React, { useState, useEffect } from 'react';
import {
  hasHardwareAsync,
  isEnrolledAsync,
  authenticateAsync,
  AuthenticationType,
  supportedAuthenticationTypesAsync,
} from 'expo-local-authentication';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text, Switch } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { setPhoneSignupData } from '@/store/authSlice';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from '@/context/AuthContext';

const PRIMARY = '#7C3AED';

export default function BiometricsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { width } = useWindowDimensions();
  const { enableBiometrics } = useAuth();

  const [fingerprintEnabled, setFingerprintEnabled] = useState(false);
  const [faceIdEnabled, setFaceIdEnabled] = useState(false);
  const [hardwareAvailable, setHardwareAvailable] = useState(false);
  const [supportedTypes, setSupportedTypes] = useState<AuthenticationType[]>([]);
  const [checking, setChecking] = useState(false);

  // Check hardware on mount
  useEffect(() => {
    (async () => {
      try {
        const available = await hasHardwareAsync();
        setHardwareAvailable(available);
        if (available) {
          const types = await supportedAuthenticationTypesAsync();
          setSupportedTypes(types);
        }
      } catch (e) {
        console.log('Biometric check error:', e);
      }
    })();
  }, []);

  const hasFaceId = supportedTypes.includes(AuthenticationType.FACIAL_RECOGNITION);
  const hasFingerprint = supportedTypes.includes(AuthenticationType.FINGERPRINT);

  const checkAndAuthenticate = async (promptMessage: string): Promise<boolean> => {
    try {
      if (!hardwareAvailable) {
        Alert.alert('Not Available', 'Biometric hardware is not available on this device.');
        return false;
      }
      const enrolled = await isEnrolledAsync();
      if (!enrolled) {
        Alert.alert(
          'Not Enrolled',
          'No biometrics are enrolled on this device.\n\nPlease go to Settings → Security → Fingerprint (or Face ID) to set it up first.'
        );
        return false;
      }
      const result = await authenticateAsync({
        promptMessage,
        disableDeviceFallback: false,
        fallbackLabel: 'Use PIN',
      });
      return result.success;
    } catch (e: any) {
      console.error('Biometric auth error:', e);
      Alert.alert('Error', 'Biometric authentication failed. Please try again.');
      return false;
    }
  };

  const handleToggleFingerprint = async (val: boolean) => {
    if (val) {
      setChecking(true);
      const success = await checkAndAuthenticate('Scan your fingerprint to enable it');
      setChecking(false);
      if (success) {
        setFingerprintEnabled(true);
        // Save to AuthContext immediately so it persists
        await enableBiometrics();
        dispatch(setPhoneSignupData({ useBiometrics: true }));
      }
    } else {
      setFingerprintEnabled(false);
      if (!faceIdEnabled) {
        dispatch(setPhoneSignupData({ useBiometrics: false }));
      }
    }
  };

  const handleToggleFaceId = async (val: boolean) => {
    if (val) {
      setChecking(true);
      const success = await checkAndAuthenticate('Verify Face ID to enable it');
      setChecking(false);
      if (success) {
        setFaceIdEnabled(true);
        await enableBiometrics();
        dispatch(setPhoneSignupData({ useBiometrics: true }));
      }
    } else {
      setFaceIdEnabled(false);
      if (!fingerprintEnabled) {
        dispatch(setPhoneSignupData({ useBiometrics: false }));
      }
    }
  };

  const handleNext = () => {
    router.push('/(auth)/review-details' as any);
  };

  const handleSkip = () => {
    dispatch(setPhoneSignupData({ useBiometrics: false }));
    router.push('/(auth)/review-details' as any);
  };

  const anyEnabled = fingerprintEnabled || faceIdEnabled;

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
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome name="chevron-left" size={16} color="#1E293B" />
          </Pressable>
        </Animated.View>

        {/* Title */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(500)}
          style={[styles.titleSection, { maxWidth: Math.min(width - 48, 400) }]}
        >
          <Text style={styles.titleText}>Secure your account</Text>
          <Text style={styles.subtitleText}>
            Use biometrics to log in quickly and securely — no password needed.
          </Text>
        </Animated.View>

        {/* Options Section */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={[styles.optionsSection, { maxWidth: Math.min(width - 48, 400) }]}
        >

          {/* Not available banner */}
          {!hardwareAvailable && (
            <View style={styles.unavailableBanner}>
              <FontAwesome name="info-circle" size={16} color="#64748B" />
              <Text style={styles.unavailableText}>
                Biometric hardware not detected on this device. You can still use password login.
              </Text>
            </View>
          )}

          {/* Fingerprint */}
          {(hardwareAvailable) && (
            <View style={[styles.optionCard, fingerprintEnabled && styles.optionCardActive]}>
              <View style={[styles.iconBox, fingerprintEnabled && styles.iconBoxActive]}>
                <MaterialCommunityIcons
                  name="fingerprint"
                  size={28}
                  color={fingerprintEnabled ? '#FFFFFF' : PRIMARY}
                />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Fingerprint</Text>
                <Text style={styles.optionSubtitle}>
                  {hasFingerprint ? 'Touch sensor available' : 'May not be supported'}
                </Text>
              </View>
              {checking ? (
                <ActivityIndicator size="small" color={PRIMARY} style={{ marginRight: 8 }} />
              ) : (
                <Switch
                  value={fingerprintEnabled}
                  onValueChange={handleToggleFingerprint}
                  color={PRIMARY}
                  disabled={checking}
                />
              )}
            </View>
          )}

          {/* Face ID */}
          {(hardwareAvailable) && (
            <View style={[styles.optionCard, { marginTop: 16 }, faceIdEnabled && styles.optionCardActive]}>
              <View style={[styles.iconBox, faceIdEnabled && styles.iconBoxActive]}>
                <MaterialCommunityIcons
                  name="face-recognition"
                  size={26}
                  color={faceIdEnabled ? '#FFFFFF' : PRIMARY}
                />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Face ID</Text>
                <Text style={styles.optionSubtitle}>
                  {hasFaceId ? 'Face recognition available' : 'May not be supported'}
                </Text>
              </View>
              {checking ? (
                <ActivityIndicator size="small" color={PRIMARY} style={{ marginRight: 8 }} />
              ) : (
                <Switch
                  value={faceIdEnabled}
                  onValueChange={handleToggleFaceId}
                  color={PRIMARY}
                  disabled={checking}
                />
              )}
            </View>
          )}

          {anyEnabled && (
            <View style={styles.successBanner}>
              <FontAwesome name="check-circle" size={16} color="#10B981" />
              <Text style={styles.successText}>
                Biometric login enabled! You'll be logged in automatically next time.
              </Text>
            </View>
          )}

          <Text style={styles.infoText}>
            You can change this anytime in your account settings.
          </Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* Action Buttons */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(600)}
          style={[styles.actionsSection, { maxWidth: Math.min(width - 48, 400) }]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
            onPress={handleNext}
          >
            <Text style={styles.continueBtnText}>
              {anyEnabled ? 'Continue' : 'Continue Without Biometrics'}
            </Text>
          </Pressable>

          {anyEnabled && (
            <Pressable onPress={handleSkip} style={styles.skipBtn}>
              <Text style={styles.skipBtnText}>Skip for now</Text>
            </Pressable>
          )}
        </Animated.View>
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
    marginBottom: 28,
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
    fontSize: 26,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.4,
  },
  subtitleText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 8,
    lineHeight: 22,
  },
  optionsSection: {
    width: '100%',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  optionCardActive: {
    backgroundColor: '#F5F3FF',
    borderColor: PRIMARY,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconBoxActive: {
    backgroundColor: PRIMARY,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  unavailableBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unavailableText: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 18,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  successText: {
    flex: 1,
    fontSize: 13,
    color: '#15803D',
    fontWeight: '600',
    lineHeight: 18,
  },
  infoText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '500',
  },
  actionsSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  continueBtn: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 16,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  skipBtn: {
    paddingVertical: 12,
  },
  skipBtnText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
  },
});
