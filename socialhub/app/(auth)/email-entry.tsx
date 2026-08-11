import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Pressable, ScrollView, useWindowDimensions } from 'react-native';

const PRIMARY = '#7C3AED';
const PRIMARY_BG = '#F5F3FF';
import { Text, TextInput, Button, Surface, HelperText, MD3LightTheme } from 'react-native-paper';

const INPUT_THEME = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    onSurface: '#1E293B',
    onSurfaceVariant: '#94A3B8',
  },
};
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch } from 'react-redux';
import { setEmailSignupData } from '@/store/authSlice';
import { emailEntrySchema, EmailEntryForm } from '@/constants/validation';
import apiService from '@/services/api';
import { FontAwesome } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

export default function EmailEntryScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { width } = useWindowDimensions();
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    trigger,
  } = useForm<EmailEntryForm>({
    resolver: zodResolver(emailEntrySchema),
    mode: 'onChange',
    defaultValues: { email: '' },
  });

  const emailValue = watch('email');

  // Trigger schema check and clear db error on change
  useEffect(() => {
    if (emailValue) {
      setDbError(null);
      trigger('email');
    }
  }, [emailValue, trigger]);

  const handleNext = async (data: EmailEntryForm) => {
    setCheckingEmail(true);
    setDbError(null);
    try {
      // Check if email already exists
      const response = await apiService.checkEmail(data.email);
      if (response.exists) {
        setDbError('This email is already registered. Please log in instead.');
        setCheckingEmail(false);
        return;
      }
      
      // Dispatch email to Redux store
      dispatch(setEmailSignupData({ email: data.email }));
      
      // Navigate to Screen 2: Password Create
      router.push('/(auth)/password-create');
    } catch (err: any) {
      setDbError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setCheckingEmail(false);
    }
  };

  const showSuccessCheck = isValid && !checkingEmail && !dbError && emailValue.length > 3;

  const cardWidth = Math.min(width - 32, 480);

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
        {/* Back Button */}
        <Animated.View
          entering={FadeInUp.duration(400)}
          style={[styles.headerRow, { maxWidth: cardWidth, alignSelf: 'center', width: '100%' }]}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome name="chevron-left" size={16} color="#1E293B" />
          </Pressable>
          <Text style={styles.stepText}>Step 1 of 4</Text>
        </Animated.View>

        {/* Brand Header */}
        <Animated.View entering={FadeInUp.delay(100).duration(500)} style={styles.brandContainer}>
          <Text style={styles.logoText}>SocialHub</Text>
          <Text style={[styles.subtitle, { color: PRIMARY }]}>Connect with the world</Text>
        </Animated.View>

        {/* Card Form */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={[styles.cardContainer, { maxWidth: cardWidth, width: '100%' }]}
        >
          <Surface style={styles.card} elevation={3}>
            <Text style={styles.cardHeader}>Let's start with your email</Text>
            <Text style={styles.cardDesc}>We will send a verification code to this email to secure your identity.</Text>

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputWrapper}>
                  <TextInput
                    placeholder="example@domain.com"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                    textColor="#1E293B"
                    outlineColor={(errors.email || dbError) ? '#EF4444' : '#E2E8F0'}
                    activeOutlineColor={errors.email || dbError ? '#EF4444' : PRIMARY}
                    outlineStyle={{ borderRadius: 16, borderWidth: 1.5 }}
                    left={<TextInput.Icon icon="email" color="#64748B" />}
                    right={
                      checkingEmail ? (
                        <TextInput.Icon icon={() => <ActivityIndicator size={20} color={PRIMARY} />} />
                      ) : showSuccessCheck ? (
                        <TextInput.Icon icon="check-circle" color="#10B981" />
                      ) : null
                    }
                    theme={INPUT_THEME}
                  />
                  {(errors.email || dbError) && (
                    <HelperText type="error" visible style={styles.errorText}>
                      {errors.email?.message || dbError}
                    </HelperText>
                  )}
                </View>
              )}
            />

            <Button
              mode="contained"
              onPress={handleSubmit(handleNext)}
              disabled={!isValid || checkingEmail}
              loading={checkingEmail}
              style={[
                styles.nextBtn,
                { backgroundColor: (!isValid || checkingEmail) ? '#CBD5E1' : PRIMARY }
              ]}
              contentStyle={styles.btnContent}
              labelStyle={styles.btnLabel}
            >
              Next Step
            </Button>
          </Surface>
        </Animated.View>
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
    marginBottom: 40,
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
  brandContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  cardContainer: {
    alignSelf: 'center',
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
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#FFF',
    color: '#1E293B',
  },
  errorText: {
    paddingHorizontal: 4,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  nextBtn: {
    borderRadius: 16,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    marginTop: 8,
  },
  btnContent: {
    height: 56,
  },
  btnLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
});
