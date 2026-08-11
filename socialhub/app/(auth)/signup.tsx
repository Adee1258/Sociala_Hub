import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  StatusBar,
  Alert,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { FontAwesome } from '@expo/vector-icons';
import SocialAuthButtons from '@/components/SocialAuthButtons';

const PRIMARY = '#7C3AED';

export default function SignupScreen() {
  const router = useRouter();


  const { width } = useWindowDimensions();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { minHeight: 600 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo Section */}
        <Animated.View entering={FadeInUp.duration(700)} style={styles.logoSection}>
          <View style={styles.logoBox}>
            <FontAwesome name="users" size={38} color="#FFF" />
          </View>
          <Text style={styles.appName}>Social Hub</Text>
          <Text style={styles.tagline}>Connect, Share & Grow together</Text>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={[styles.actionsContainer, { maxWidth: Math.min(width - 48, 400) }]}
        >
          {/* Sign Up Button */}
          <Pressable
            style={({ pressed }) => [
              styles.signupBtn,
              { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
            onPress={() => router.push('/(auth)/phone-entry' as any)}
          >
            <Text style={styles.signupBtnText}>Sign Up</Text>
          </Pressable>

          {/* Log In Button */}
          <Pressable
            style={({ pressed }) => [
              styles.loginBtn,
              { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.loginBtnText}>Log In</Text>
          </Pressable>

          {/* Social Buttons */}
          <SocialAuthButtons />

          {/* Terms */}
          <Text style={styles.termsText}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text>
            {' & '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
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
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoBox: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  appName: {
    fontSize: 34,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
  actionsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  signupBtn: {
    width: '100%',
    height: 56,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 6,
  },
  signupBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  loginBtn: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 28,
  },
  loginBtnText: {
    color: '#1E293B',
    fontSize: 17,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 14,
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
  },
  socialBtn: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  termsLink: {
    color: PRIMARY,
    fontWeight: '700',
  },
});
