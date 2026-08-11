import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import apiService from '../services/api';

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (token) {
      verifyEmail(token as string);
    } else {
      setStatus('error');
      setMessage('Invalid verification link. No token provided.');
    }
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    try {
      const response = await apiService.verifyEmail(verificationToken);
      
      if (response.success) {
        setStatus('success');
        setMessage('Your email has been verified successfully!');
      } else {
        setStatus('error');
        setMessage(response.message || 'Failed to verify email.');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'An error occurred while verifying your email.');
    }
  };

  const handleContinue = () => {
    router.replace('/(tabs)/profile');
  };

  const handleResend = () => {
    router.replace('/(tabs)/profile');
  };

  return (
    <View style={styles.container}>
      <View style={styles.background} />
      
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <IconSymbol 
              size={48} 
              name={status === 'success' ? 'checkmark.shield.fill' : status === 'error' ? 'xmark.shield.fill' : 'envelope.fill'} 
              color="#FFFFFF" 
            />
          </View>
          <Text style={styles.appName}>
            {status === 'success' ? 'Email Verified!' : status === 'error' ? 'Verification Failed' : 'Verifying...'}
          </Text>
        </View>

        <Surface style={styles.formContainer} elevation={2}>
          <View style={styles.iconContainer}>
            {status === 'loading' ? (
              <ActivityIndicator size="large" color="#7C3AED" />
            ) : (
              <View style={[styles.statusCircle, status === 'success' ? styles.successCircle : styles.errorCircle]}>
                <IconSymbol 
                  size={50} 
                  name={status === 'success' ? 'checkmark' : 'xmark'} 
                  color="#FFFFFF" 
                />
              </View>
            )}
          </View>

          <Text style={styles.statusTitle}>
            {status === 'loading' ? 'Verifying Email' : status === 'success' ? 'Success!' : 'Oops!'}
          </Text>

          <Text style={styles.statusMessage}>{message}</Text>

          {status !== 'loading' && (
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                buttonColor={status === 'success' ? '#10B981' : '#7C3AED'}
                textColor="#FFFFFF"
                style={styles.primaryBtn}
                contentStyle={styles.primaryBtnContent}
                labelStyle={styles.primaryBtnLabel}
                onPress={handleContinue}
              >
                {status === 'success' ? 'Go to Profile' : 'Go to Profile'}
              </Button>

              {status === 'error' && (
                <Button
                  mode="outlined"
                  textColor="#64748B"
                  style={[styles.primaryBtn, { borderColor: '#E2E8F0', marginTop: 12 }]}
                  contentStyle={styles.primaryBtnContent}
                  labelStyle={styles.primaryBtnLabel}
                  onPress={handleResend}
                >
                  Resend Verification Email
                </Button>
              )}
            </View>
          )}
        </Surface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
    backgroundColor: '#7C3AED',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  statusCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCircle: {
    backgroundColor: '#10B981',
  },
  errorCircle: {
    backgroundColor: '#EF4444',
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  statusMessage: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    borderRadius: 16,
    elevation: 2,
  },
  primaryBtnContent: {
    paddingVertical: 8,
    height: 56,
  },
  primaryBtnLabel: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
