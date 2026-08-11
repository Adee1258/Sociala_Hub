import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import apiService from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import * as SecureStore from 'expo-secure-store';
import { FontAwesome } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const PRIMARY = '#7C3AED';

export default function TermsScreen() {
  const router = useRouter();
  const { signup: performSignup } = useAuth();
  const { width } = useWindowDimensions();
  const signupData = useSelector((state: RootState) => state.auth.phoneSignup);

  // Redirect back if signup data is lost (e.g. on page refresh)
  React.useEffect(() => {
    // Only redirect if BOTH phoneNumber AND username are missing
    // (username alone missing is okay — user might not have set it yet)
    if (!signupData.phoneNumber) {
      console.warn('Signup data lost, redirecting to start');
      router.replace('/(auth)/phone-entry');
    }
  }, []);

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = agreeTerms && agreePrivacy;

  const handleAccept = async () => {
    if (!canSubmit) return;

    // Password must be set — never allow a default fallback
    if (!signupData.password) {
      Alert.alert(
        'Password Missing',
        'Something went wrong. Please go back and set your password.',
        [{ text: 'Go Back', onPress: () => router.replace('/(auth)/password-create' as any) }]
      );
      return;
    }

    setSubmitting(true);
    try {
      console.log('Final Signup Data Check:', signupData);

      const phoneNumber = signupData.phoneNumber;

      // Build signup payload — include profilePicture so it uploads in one shot
      const signupPayload: any = {
        firstName: signupData.firstName || 'User',
        lastName: signupData.lastName || '',
        username: signupData.username?.toLowerCase() || `user_${Date.now()}`,
        phoneNumber: phoneNumber || '0000000000',
        password: signupData.password,
        bio: signupData.bio || '',
        day: '01',
        month: 'January',
        year: '2000',
        gender: 'Prefer not to say',
        biometrics: {
          fingerprint: signupData.useBiometrics || false,
          voice: false,
        }
      };

      // Attach profile picture directly to signup payload
      if (signupData.profilePicture) {
        signupPayload.profilePicture = signupData.profilePicture;
      }

      console.log('Sending signup payload:', signupPayload);

      // performSignup may return undefined or a response object — guard both
      const response = (await performSignup(signupPayload)) as any;
      const responseUser = response?.user ?? null;

      // Handle account recovery — existing account found for this phone number
      if (response?.accountRecovered) {
        Alert.alert(
          'Account Restored',
          `Welcome back! Your existing account @${responseUser?.username} has been restored.`,
          [{ text: 'Continue', onPress: () => router.replace('/(tabs)' as any) }]
        );
        return;
      }

      // If they selected a photo, it was already sent with the signup payload.
      // Use the Cloudinary URL returned from backend as the saved picture.
      const savedUsername = responseUser?.username || signupPayload.username;
      const savedFirstName = responseUser?.firstName || signupPayload.firstName;
      const savedLastName = responseUser?.lastName || signupPayload.lastName;
      const savedPicture = responseUser?.profilePicture ?? null;

      const userInfo = JSON.stringify({
        username: savedUsername,
        firstName: savedFirstName,
        lastName: savedLastName,
        profilePicture: savedPicture,
        savedPassword: signupPayload.password,
      });

      if (Platform.OS === 'web') {
        localStorage.setItem('last_user_info', userInfo);
        if (signupPayload.biometrics.fingerprint) localStorage.setItem('biometrics_enabled', 'true');
      } else {
        await SecureStore.setItemAsync('last_user_info', userInfo);
        if (signupPayload.biometrics.fingerprint) await SecureStore.setItemAsync('biometrics_enabled', 'true');
      }

      router.replace('/(auth)/welcome' as any);
    } catch (err: any) {
      console.error('Signup error:', err);
      Alert.alert('Signup Error', err?.message || 'Something went wrong creating your account.');
    } finally {
      setSubmitting(false);
    }
  };

  const CheckOption = ({
    selected,
    onToggle,
    label,
  }: {
    selected: boolean;
    onToggle: () => void;
    label: string;
  }) => (
    <Pressable style={styles.checkRow} onPress={onToggle}>
      <View style={[styles.checkBox, selected && styles.checkBoxSelected]}>
        {selected && <FontAwesome name="check" size={14} color="#FFFFFF" />}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
          <Text style={styles.titleText}>Terms & Conditions</Text>
          <Text style={styles.subtitleText}>
            Please read and accept our terms to continue.
          </Text>
        </Animated.View>

        {/* Content Box */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={[styles.contentSection, { maxWidth: Math.min(width - 48, 400) }]}
        >
          <View style={styles.termsBox}>
            <Text style={styles.termsTitle}>Social Hub Terms of Service</Text>
            <Text style={styles.termsDate}>Last updated: May 20, 2024</Text>

            <Text style={styles.termsBody}>
              By creating an account, you agree to our Terms of Service and
              acknowledge that you have read our Privacy Policy.
            </Text>

            <Pressable>
              <Text style={styles.learnMoreLink}>Learn more</Text>
            </Pressable>
          </View>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* Action Bottom */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(600)}
          style={[styles.actionsSection, { maxWidth: Math.min(width - 48, 400) }]}
        >
          <View style={styles.checkboxesContainer}>
            <CheckOption
              selected={agreeTerms}
              onToggle={() => setAgreeTerms(!agreeTerms)}
              label="I agree to the Terms of Service"
            />
            <CheckOption
              selected={agreePrivacy}
              onToggle={() => setAgreePrivacy(!agreePrivacy)}
              label="I agree to the Privacy Policy"
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              {
                backgroundColor: !canSubmit || submitting ? '#CBD5E1' : PRIMARY,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
            onPress={handleAccept}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.continueBtnText}>Accept & Continue</Text>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
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
    marginBottom: 32,
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
  contentSection: {
    width: '100%',
  },
  termsBox: {
    padding: 16,
  },
  termsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  termsDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 16,
  },
  termsBody: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 16,
  },
  learnMoreLink: {
    color: PRIMARY,
    fontWeight: '700',
    fontSize: 14,
  },
  actionsSection: {
    width: '100%',
    marginTop: 32,
  },
  checkboxesContainer: {
    marginBottom: 24,
    gap: 16,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkBoxSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  checkLabel: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  continueBtn: {
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
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
