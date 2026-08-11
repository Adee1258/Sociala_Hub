import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  useWindowDimensions,
  StatusBar,
  Alert,
} from 'react-native';
import { Text, TextInput, MD3LightTheme } from 'react-native-paper';

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
import { setPhoneSignupData } from '@/store/authSlice';
import { phoneEntrySchema } from '@/constants/validation';
import apiService from '@/services/api';
import { COUNTRIES } from '@/components/signup/OTPSteps';
import { FontAwesome } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const PRIMARY = '#7C3AED';

export default function PhoneEntryScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { width } = useWindowDimensions();

  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    trigger,
  } = useForm({
    resolver: zodResolver(phoneEntrySchema),
    mode: 'onChange',
    defaultValues: { phoneNumber: '' },
  });

  const phoneNumberValue = watch('phoneNumber');

  const filteredCountries = useMemo(() => {
    if (!searchQuery) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.includes(searchQuery)
    );
  }, [searchQuery]);

  const handlePhoneChange = (text: string, onChange: (val: string) => void) => {
    setPhoneError(null);
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 15);
    onChange(cleaned);
    trigger('phoneNumber');
  };

  const handleNext = async (data: any) => {
    setSendingOTP(true);
    setPhoneError(null);
    const rawNumber = data.phoneNumber.replace(/[^0-9]/g, '');
    const fullNumber = selectedCountry.code + rawNumber;

    try {
      const response = await apiService.sendSMSOTP(fullNumber);

      if (response.success) {
        dispatch(setPhoneSignupData({ phoneNumber: rawNumber, countryCode: selectedCountry.code }));
        
        // Navigate directly to OTP screen
        router.push({
          pathname: '/(auth)/sms-otp',
          params: { devOTP: response.devOTP }
        } as any);
      } else {
        setPhoneError(response.message || 'Failed to send OTP. Please try again.');
      }
    } catch (err: any) {
      setPhoneError(err.message || 'Error occurred. Please try again.');
    } finally {
      setSendingOTP(false);
    }
  };

  const isPhoneValid = isValid && phoneNumberValue.replace(/[^0-9]/g, '').length >= 7;

  const handleSocial = useCallback((provider: string) => {
    Alert.alert('Coming Soon', `${provider} login will be available soon.`);
  }, []);

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
        {/* Back Button */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome name="chevron-left" size={16} color="#1E293B" />
          </Pressable>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInUp.delay(100).duration(500)} style={styles.titleSection}>
          <Text style={styles.titleText}>Create your account</Text>
          <Text style={styles.subtitleText}>Let's get started!</Text>
        </Animated.View>

        {/* Form */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={[styles.formSection, { maxWidth: Math.min(width - 48, 400) }]}
        >
          <Text style={styles.inputLabel}>Sign up with mobile</Text>

          {/* Country Picker + Phone Number Row */}
          <View style={styles.phoneRow}>
            <Pressable
              onPress={() => setModalVisible(true)}
              style={styles.countryPickerBtn}
            >
              <Text style={styles.flagText}>{selectedCountry.flag}</Text>
              <Text style={styles.codeText}>{selectedCountry.code}</Text>
              <FontAwesome name="caret-down" size={12} color="#64748B" />
            </Pressable>

            <Controller
              control={control}
              name="phoneNumber"
              render={({ field: { onChange, onBlur, value } }: { field: any }) => (
                <TextInput
                  label="Phone Number"
                  onBlur={onBlur}
                  onChangeText={(text) => handlePhoneChange(text, onChange)}
                  value={value}
                  mode="outlined"
                  keyboardType="phone-pad"
                  style={styles.phoneInput}
                  textColor="#1E293B"
                  outlineColor={errors.phoneNumber || phoneError ? '#EF4444' : '#E2E8F0'}
                  activeOutlineColor={errors.phoneNumber || phoneError ? '#EF4444' : PRIMARY}
                  outlineStyle={{ borderRadius: 12, borderWidth: 1.5 }}
                  right={
                    sendingOTP ? (
                      <TextInput.Icon icon={() => <ActivityIndicator size={18} color={PRIMARY} />} />
                    ) : isPhoneValid ? (
                      <TextInput.Icon icon="check-circle" color="#10B981" />
                    ) : null
                  }
                  theme={INPUT_THEME}
                />
              )}
            />
          </View>

          {(errors.phoneNumber || phoneError) && (
            <Text style={styles.errorText}>
              {(errors.phoneNumber as any)?.message || phoneError}
            </Text>
          )}

          {/* Continue Button */}
          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              {
                backgroundColor: !isPhoneValid || sendingOTP ? '#CBD5E1' : PRIMARY,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
            onPress={handleSubmit(handleNext)}
            disabled={!isPhoneValid || sendingOTP}
          >
            {sendingOTP ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.continueBtnText}>Continue</Text>
            )}
          </Pressable>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Row */}
          <View style={styles.socialRow}>
            <Pressable
              style={({ pressed }) => [styles.socialBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => handleSocial('Google')}
            >
              <FontAwesome name="google" size={20} color="#EA4335" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.socialBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => handleSocial('Facebook')}
            >
              <FontAwesome name="facebook" size={20} color="#1877F2" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.socialBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => handleSocial('Apple')}
            >
              <FontAwesome name="apple" size={20} color="#000000" />
            </Pressable>
          </View>

          {/* Terms */}
          <Text style={styles.termsText}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text>
            {' & '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Country Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: Math.min(width, 600) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Country Code</Text>
              <Pressable
                onPress={() => { setModalVisible(false); setSearchQuery(''); }}
                style={styles.modalCloseBtn}
              >
                <FontAwesome name="times" size={16} color="#64748B" />
              </Pressable>
            </View>

            <TextInput
              placeholder="Search country or code..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              mode="outlined"
              style={styles.searchBar}
              textColor="#1E293B"
              outlineColor="#E2E8F0"
              activeOutlineColor={PRIMARY}
              outlineStyle={{ borderRadius: 12 }}
              left={<TextInput.Icon icon="magnify" color="#64748B" />}
              theme={INPUT_THEME}
            />

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code + item.name}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setSelectedCountry(item); setModalVisible(false); setSearchQuery(''); }}
                  style={({ pressed }) => [styles.countryItem, { backgroundColor: pressed ? '#F5F3FF' : 'transparent' }]}
                >
                  <Text style={styles.countryFlagText}>{item.flag}</Text>
                  <Text style={styles.countryNameText}>{item.name}</Text>
                  <Text style={[styles.countryCodeText, { color: PRIMARY }]}>{item.code}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
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
    maxWidth: Math.min(400, 400),
    marginBottom: 32,
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
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: 400,
    marginBottom: 32,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '500',
  },
  formSection: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 10,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
    alignItems: 'center',
  },
  countryPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  flagText: { fontSize: 20 },
  codeText: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  phoneInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    color: '#1E293B',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  continueBtn: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 28,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { marginHorizontal: 14, color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  socialRow: { flexDirection: 'row', gap: 16, marginBottom: 24, justifyContent: 'center' },
  socialBtn: {
    width: 58,
    height: 58,
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
  },
  termsLink: { color: PRIMARY, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '75%',
    padding: 24,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: { backgroundColor: '#FFF', marginBottom: 12, color: '#1E293B' },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  countryFlagText: { fontSize: 22 },
  countryNameText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1E293B' },
  countryCodeText: { fontSize: 14, fontWeight: '700' },
});
