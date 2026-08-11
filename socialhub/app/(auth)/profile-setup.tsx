import React, { useState, useEffect } from 'react';
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
import { Text, TextInput, HelperText, MD3LightTheme } from 'react-native-paper';

const INPUT_THEME = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    onSurface: '#1E293B',
    onSurfaceVariant: '#94A3B8',
  },
};
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store';
import { setEmailSignupData, setPhoneSignupData } from '@/store/authSlice';
import { profileSetupSchema, ProfileSetupForm } from '@/constants/validation';
import apiService from '@/services/api';
import { FontAwesome } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const PRIMARY = '#7C3AED';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { width } = useWindowDimensions();

  const params = useLocalSearchParams<{ flow?: string }>();
  const flow = params.flow || 'mobile';
  const isEmailFlow = flow === 'email';

  const signupData = useSelector((state: RootState) =>
    isEmailFlow ? state.auth.emailSignup : state.auth.phoneSignup
  );

  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
    trigger,
  } = useForm<ProfileSetupForm>({
    resolver: zodResolver(profileSetupSchema),
    mode: 'onChange',
    defaultValues: { fullName: '', username: '', bio: '' },
  });

  const usernameValue = watch('username');
  const fullNameValue = watch('fullName');

  // Auto-suggest username from email
  useEffect(() => {
    if (isEmailFlow && (signupData as any).email && !usernameValue) {
      const emailPrefix = (signupData as any).email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
      setValue('username', emailPrefix.toLowerCase().slice(0, 20));
      trigger('username');
    }
  }, [isEmailFlow, (signupData as any).email]);

  // Auto-suggest username from name (mobile)
  useEffect(() => {
    if (!isEmailFlow && fullNameValue && !usernameValue) {
      const sug = fullNameValue.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_]/g, '');
      if (sug.length >= 3) {
        setValue('username', sug.toLowerCase().slice(0, 20));
        trigger('username');
      }
    }
  }, [isEmailFlow, fullNameValue]);

  // Live username check
  useEffect(() => {
    if (!usernameValue || usernameValue.length < 3) { setUsernameAvailable(null); return; }
    const delay = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await apiService.checkUsername(usernameValue);
        setUsernameAvailable(res.available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 600);
    return () => clearTimeout(delay);
  }, [usernameValue]);

  const onSubmit = async (data: ProfileSetupForm) => {
    const nameParts = data.fullName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    if (isEmailFlow) {
      dispatch(setEmailSignupData({ firstName, lastName, username: data.username }));
      router.push('/(auth)/password-create' as any);
    } else {
      dispatch(setPhoneSignupData({ firstName, lastName, username: data.username }));
      router.push({ pathname: '/(auth)/password-create' as any, params: { flow: 'mobile' } });
    }
  };

  const canSubmit = isValid && !checkingUsername && usernameAvailable !== false;

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
          <View style={styles.profileIconPlaceholder}>
            <FontAwesome name="camera" size={22} color="#94A3B8" />
          </View>
          <Text style={styles.titleText}>Complete your profile</Text>
          <Text style={styles.subtitleText}>Tell us a bit about yourself</Text>
        </Animated.View>

        {/* Form */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={[styles.formSection, { maxWidth: Math.min(width - 48, 400) }]}
        >
          {/* Full Name */}
          <Controller
            control={control}
            name="fullName"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <TextInput
                  placeholder="Enter your full name"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  mode="outlined"
                  style={styles.input}
                  textColor="#1E293B"
                  outlineColor={errors.fullName ? '#EF4444' : '#E2E8F0'}
                  activeOutlineColor={errors.fullName ? '#EF4444' : PRIMARY}
                  outlineStyle={{ borderRadius: 12, borderWidth: 1.5 }}
                  left={<TextInput.Icon icon="account-outline" color="#94A3B8" />}
                  theme={INPUT_THEME}
                />
                {errors.fullName && (
                  <HelperText type="error" visible style={styles.helperText}>
                    {errors.fullName.message}
                  </HelperText>
                )}
              </View>
            )}
          />

          {/* Username */}
          <Controller
            control={control}
            name="username"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>Username</Text>
                <TextInput
                  placeholder="Choose a username"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  mode="outlined"
                  autoCapitalize="none"
                  style={styles.input}
                  textColor="#1E293B"
                  outlineColor={
                    errors.username || usernameAvailable === false ? '#EF4444' : '#E2E8F0'
                  }
                  activeOutlineColor={
                    errors.username || usernameAvailable === false ? '#EF4444' : PRIMARY
                  }
                  outlineStyle={{ borderRadius: 12, borderWidth: 1.5 }}
                  left={<TextInput.Icon icon="at" color="#94A3B8" />}
                  right={
                    checkingUsername ? (
                      <TextInput.Icon
                        icon={() => <ActivityIndicator size={18} color={PRIMARY} />}
                      />
                    ) : usernameAvailable === true ? (
                      <TextInput.Icon icon="check-circle" color="#10B981" />
                    ) : usernameAvailable === false ? (
                      <TextInput.Icon icon="close-circle" color="#EF4444" />
                    ) : null
                  }
                  theme={INPUT_THEME}
                />
                {errors.username ? (
                  <HelperText type="error" visible style={styles.helperText}>
                    {errors.username.message}
                  </HelperText>
                ) : usernameAvailable === false ? (
                  <HelperText type="error" visible style={styles.helperText}>
                    This username is already taken.
                  </HelperText>
                ) : usernameAvailable === true ? (
                  <HelperText type="info" visible style={[styles.helperText, { color: '#10B981' }]}>
                    Username is available!
                  </HelperText>
                ) : null}
              </View>
            )}
          />

          {/* Continue Button */}
          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              {
                backgroundColor: !canSubmit ? '#CBD5E1' : PRIMARY,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
            onPress={handleSubmit(onSubmit)}
            disabled={!canSubmit}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
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
    alignItems: 'center',
    marginBottom: 32,
  },
  profileIconPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  titleText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '500',
  },
  formSection: { width: '100%' },
  fieldWrapper: { marginBottom: 18 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  input: { backgroundColor: '#FFFFFF', color: '#1E293B' },
  helperText: { paddingHorizontal: 4, fontSize: 12, fontWeight: '600' },
  continueBtn: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
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
