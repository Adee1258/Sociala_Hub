import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Platform, Alert, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';

import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as AppleAuthentication from 'expo-apple-authentication';

WebBrowser.maybeCompleteAuthSession();

const SocialAuthButtons = () => {
  const router = useRouter();
  const { socialLogin, completeLogin } = useAuth();
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  // Google Setup
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'dummy-google-client-id',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  // Facebook Setup
  const [facebookRequest, facebookResponse, facebookPromptAsync] = Facebook.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || 'dummy-facebook-app-id',
  });

  const trackEvent = (event: string) => {
    // In a real app, this would call your analytics provider
    console.log(`[Analytics Event] ${event}`);
  };

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      trackEvent('google_login_success');
      const { authentication } = googleResponse;
      if (authentication?.idToken) {
        handleBackendLogin('google', { idToken: authentication.idToken });
      } else {
        setActiveProvider(null);
        Alert.alert('Error', 'Failed to retrieve Google token.');
      }
    } else if (googleResponse?.type === 'cancel' || googleResponse?.type === 'dismiss') {
      setActiveProvider(null);
    } else if (googleResponse?.type === 'error') {
      trackEvent('google_login_failed');
      setActiveProvider(null);
      Alert.alert('Login failed', 'Please try again later.');
    }
  }, [googleResponse]);

  useEffect(() => {
    if (facebookResponse?.type === 'success') {
      trackEvent('facebook_login_success');
      const { authentication } = facebookResponse;
      if (authentication?.accessToken) {
        handleBackendLogin('facebook', { accessToken: authentication.accessToken });
      } else {
        setActiveProvider(null);
        Alert.alert('Error', 'Failed to retrieve Facebook token.');
      }
    } else if (facebookResponse?.type === 'cancel' || facebookResponse?.type === 'dismiss') {
      setActiveProvider(null);
    } else if (facebookResponse?.type === 'error') {
      trackEvent('facebook_login_failed');
      setActiveProvider(null);
      Alert.alert('Login failed', 'Please try again later.');
    }
  }, [facebookResponse]);

  const handleBackendLogin = async (provider: string, payload: any) => {
    try {
      const result = await socialLogin({ provider, ...payload });
      // navigate on success
      router.replace('/(tabs)');
    } catch (error: any) {
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('network') || msg.includes('fetch')) {
        Alert.alert('Error', 'No internet connection');
      } else {
        Alert.alert('Login Failed', 'Invalid token or server error. Please try again.');
      }
    } finally {
      setActiveProvider(null);
    }
  };

  const handleGoogle = async () => {
    try {
      setActiveProvider('google');
      trackEvent('google_login_started');
      await googlePromptAsync();
    } catch (e) {
      trackEvent('google_login_failed');
      setActiveProvider(null);
    }
  };

  const handleFacebook = async () => {
    try {
      setActiveProvider('facebook');
      trackEvent('facebook_login_started');
      await facebookPromptAsync();
    } catch (e) {
      trackEvent('facebook_login_failed');
      setActiveProvider(null);
    }
  };

  const handleApple = async () => {
    try {
      setActiveProvider('apple');
      trackEvent('apple_login_started');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      trackEvent('apple_login_success');
      const payload = {
        identityToken: credential.identityToken,
        fullName: credential.fullName
      };
      
      handleBackendLogin('apple', payload);
    } catch (e: any) {
      trackEvent('apple_login_failed');
      setActiveProvider(null);
      if (e.code === 'ERR_REQUEST_CANCELED') {
        // user canceled, do nothing
      } else {
        Alert.alert('Login Failed', 'Apple Sign-In failed.');
      }
    }
  };

  const disabled = activeProvider !== null;

  return (
    <View style={styles.container}>
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.buttonsContainer}>
        {/* Google Button */}
        <Pressable
          style={({ pressed }) => [
            styles.socialBtn,
            styles.googleBtn,
            pressed && styles.pressed,
            disabled && styles.disabledBtn
          ]}
          onPress={handleGoogle}
          disabled={disabled || !googleRequest}
        >
          {activeProvider === 'google' ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <FontAwesome name="google" size={20} color="#EA4335" />
              <Text style={[styles.btnText, styles.googleText]}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        {/* Facebook Button */}
        <Pressable
          style={({ pressed }) => [
            styles.socialBtn,
            styles.facebookBtn,
            pressed && styles.pressed,
            disabled && styles.disabledBtn
          ]}
          onPress={handleFacebook}
          disabled={disabled || !facebookRequest}
        >
          {activeProvider === 'facebook' ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <FontAwesome name="facebook" size={20} color="#FFFFFF" />
              <Text style={[styles.btnText, styles.facebookText]}>Continue with Facebook</Text>
            </>
          )}
        </Pressable>

        {/* Apple Button (iOS Only) */}
        {Platform.OS === 'ios' && (
          <Pressable
            style={({ pressed }) => [
              styles.socialBtn,
              styles.appleBtn,
              pressed && styles.pressed,
              disabled && styles.disabledBtn
            ]}
            onPress={handleApple}
            disabled={disabled}
          >
            {activeProvider === 'apple' ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <FontAwesome name="apple" size={22} color="#FFFFFF" />
                <Text style={[styles.btnText, styles.appleText]}>Continue with Apple</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 20,
    marginBottom: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
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
  buttonsContainer: {
    gap: 12,
  },
  socialBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    gap: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  googleBtn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  facebookBtn: {
    backgroundColor: '#1877F2',
    borderColor: '#1877F2',
  },
  appleBtn: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  googleText: {
    color: '#1E293B',
  },
  facebookText: {
    color: '#FFFFFF',
  },
  appleText: {
    color: '#FFFFFF',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  disabledBtn: {
    opacity: 0.6,
  },
});

export default SocialAuthButtons;
