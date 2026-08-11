import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { Text, TextInput, ProgressBar, MD3LightTheme } from 'react-native-paper';

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
import { useDispatch } from 'react-redux';
import { setEmailSignupData, setPhoneSignupData } from '@/store/authSlice';
import { passwordCreateSchema, PasswordCreateForm } from '@/constants/validation';
import { FontAwesome } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const PRIMARY = '#7C3AED';

export default function PasswordCreateScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ flow?: string }>();
  const flow = params.flow || 'email';
  const isMobileFlow = flow === 'mobile';

  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<PasswordCreateForm>({
    resolver: zodResolver(passwordCreateSchema),
    mode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  });

  const password = watch('password') || '';

  const hasMinLength = password.length >= 8;
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  let strengthScore = 0;
  if (hasMinLength) strengthScore += 0.33;
  if (hasNumber) strengthScore += 0.33;
  if (hasSpecial) strengthScore += 0.34;

  const strengthColor =
    strengthScore <= 0.34 ? '#EF4444' : strengthScore <= 0.67 ? '#F97316' : '#10B981';
  const strengthLabel =
    !password ? '' : strengthScore <= 0.34 ? 'Weak' : strengthScore <= 0.67 ? 'Medium' : 'Strong';

  const handleNext = (data: PasswordCreateForm) => {
    if (isMobileFlow) {
      dispatch(setPhoneSignupData({ password: data.password }));
    } else {
      dispatch(setEmailSignupData({ password: data.password }));
    }
    router.push('/(auth)/profile-photo' as any);
  };

  const CheckRow = ({
    done,
    label,
  }: {
    done: boolean;
    label: string;
  }) => (
    <View style={styles.checkRow}>
      <FontAwesome
        name={done ? 'check-circle' : 'circle-o'}
        size={16}
        color={done ? '#10B981' : '#CBD5E1'}
      />
      <Text style={[styles.checkText, done && styles.checkDone]}>{label}</Text>
    </View>
  );

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
          <Text style={styles.titleText}>Set your password</Text>
          <Text style={styles.subtitleText}>
            Use a strong password to keep your account safe
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={[styles.formSection, { maxWidth: Math.min(width - 48, 400) }]}
        >
          {/* Password Input */}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.fieldWrapper}>
                <TextInput
                  placeholder="Enter strong password"
                  label="Password"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  mode="outlined"
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  textColor="#1E293B"
                  outlineColor={errors.password ? '#EF4444' : '#E2E8F0'}
                  activeOutlineColor={errors.password ? '#EF4444' : PRIMARY}
                  outlineStyle={{ borderRadius: 12, borderWidth: 1.5 }}
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
              </View>
            )}
          />

          {/* Strength Bar */}
          {password.length > 0 && (
            <View style={styles.strengthWrapper}>
              <View style={styles.strengthHeader}>
                <Text style={styles.strengthLabel}>Password Strength</Text>
                <Text style={[styles.strengthValue, { color: strengthColor }]}>
                  {strengthLabel}
                </Text>
              </View>
              <ProgressBar
                progress={strengthScore}
                color={strengthColor}
                style={styles.strengthBar}
              />
            </View>
          )}

          {/* Confirm Password */}
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={[styles.fieldWrapper, { marginTop: 4 }]}>
                <Text style={styles.fieldLabel}>Confirm Password</Text>
                <TextInput
                  placeholder="Re-enter your password"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  mode="outlined"
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  textColor="#1E293B"
                  outlineColor={errors.confirmPassword ? '#EF4444' : '#E2E8F0'}
                  activeOutlineColor={errors.confirmPassword ? '#EF4444' : PRIMARY}
                  outlineStyle={{ borderRadius: 12, borderWidth: 1.5 }}
                  left={<TextInput.Icon icon="shield-check-outline" color="#94A3B8" />}
                  theme={INPUT_THEME}
                />
              </View>
            )}
          />

          {/* Checklist */}
          <View style={styles.checklist}>
            <CheckRow done={hasMinLength} label="At least 8 characters" />
            <CheckRow done={hasNumber} label="Include a number" />
            <CheckRow done={hasSpecial} label="Include a special character" />
          </View>

          {/* Continue */}
          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              {
                backgroundColor: !isValid ? '#CBD5E1' : PRIMARY,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
            onPress={handleSubmit(handleNext)}
            disabled={!isValid}
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
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '500',
    lineHeight: 20,
  },
  formSection: { width: '100%' },
  fieldWrapper: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  input: { backgroundColor: '#FFFFFF', color: '#1E293B' },
  strengthWrapper: { marginBottom: 16, paddingHorizontal: 2 },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  strengthLabel: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  strengthValue: { fontSize: 12, fontWeight: '800' },
  strengthBar: { height: 6, borderRadius: 3, backgroundColor: '#F1F5F9' },
  checklist: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    gap: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  checkDone: { color: '#1E293B', fontWeight: '700' },
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
