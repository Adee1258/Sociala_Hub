import React, { useState, useRef, memo } from 'react';
import { View, TextInput, Pressable, StyleSheet, Text, ScrollView, Modal } from 'react-native';
import { Button } from 'react-native-paper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StepHeader, signupStyles } from './SignupSteps';

// Complete Countries List
export const COUNTRIES = [
  { code: '+92', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+1', flag: '🇺🇸', name: 'United States' },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
  { code: '+971', flag: '🇦🇪', name: 'United Arab Emirates' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+90', flag: '🇹🇷', name: 'Turkey' },
  { code: '+93', flag: '🇦🇫', name: 'Afghanistan' },
  { code: '+355', flag: '🇦🇱', name: 'Albania' },
  { code: '+213', flag: '🇩🇿', name: 'Algeria' },
  { code: '+376', flag: '🇦🇩', name: 'Andorra' },
  { code: '+244', flag: '🇦🇴', name: 'Angola' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+374', flag: '🇦🇲', name: 'Armenia' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+43', flag: '🇦🇹', name: 'Austria' },
  { code: '+994', flag: '🇦🇿', name: 'Azerbaijan' },
  { code: '+973', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+375', flag: '🇧🇾', name: 'Belarus' },
  { code: '+32', flag: '🇧🇪', name: 'Belgium' },
  { code: '+501', flag: '🇧🇿', name: 'Belize' },
  { code: '+229', flag: '🇧🇯', name: 'Benin' },
  { code: '+975', flag: '🇧🇹', name: 'Bhutan' },
  { code: '+591', flag: '🇧🇴', name: 'Bolivia' },
  { code: '+387', flag: '🇧🇦', name: 'Bosnia and Herzegovina' },
  { code: '+267', flag: '🇧🇼', name: 'Botswana' },
  { code: '+55', flag: '🇧🇷', name: 'Brazil' },
  { code: '+673', flag: '🇧🇳', name: 'Brunei' },
  { code: '+359', flag: '🇧🇬', name: 'Bulgaria' },
  { code: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
  { code: '+257', flag: '🇧🇮', name: 'Burundi' },
  { code: '+855', flag: '🇰🇭', name: 'Cambodia' },
  { code: '+237', flag: '🇨🇲', name: 'Cameroon' },
  { code: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: '+238', flag: '🇨🇻', name: 'Cape Verde' },
  { code: '+236', flag: '🇨🇫', name: 'Central African Republic' },
  { code: '+235', flag: '🇹🇩', name: 'Chad' },
  { code: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+269', flag: '🇰🇲', name: 'Comoros' },
  { code: '+506', flag: '🇨🇷', name: 'Costa Rica' },
  { code: '+385', flag: '🇭🇷', name: 'Croatia' },
  { code: '+53', flag: '🇨🇺', name: 'Cuba' },
  { code: '+357', flag: '🇨🇾', name: 'Cyprus' },
  { code: '+420', flag: '🇨🇿', name: 'Czech Republic' },
  { code: '+45', flag: '🇩🇰', name: 'Denmark' },
  { code: '+253', flag: '🇩🇯', name: 'Djibouti' },
  { code: '+1', flag: '🇩🇲', name: 'Dominica' },
  { code: '+1', flag: '🇩🇴', name: 'Dominican Republic' },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+20', flag: '🇪🇬', name: 'Egypt' },
  { code: '+503', flag: '🇸🇻', name: 'El Salvador' },
  { code: '+240', flag: '🇬🇶', name: 'Equatorial Guinea' },
  { code: '+291', flag: '🇪🇷', name: 'Eritrea' },
  { code: '+372', flag: '🇪🇪', name: 'Estonia' },
  { code: '+251', flag: '🇪🇹', name: 'Ethiopia' },
  { code: '+679', flag: '🇫🇯', name: 'Fiji' },
  { code: '+358', flag: '🇫🇮', name: 'Finland' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+241', flag: '🇬🇦', name: 'Gabon' },
  { code: '+220', flag: '🇬🇲', name: 'Gambia' },
  { code: '+995', flag: '🇬🇪', name: 'Georgia' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: '+30', flag: '🇬🇷', name: 'Greece' },
  { code: '+1', flag: '🇬🇩', name: 'Grenada' },
  { code: '+502', flag: '🇬🇹', name: 'Guatemala' },
  { code: '+224', flag: '🇬🇳', name: 'Guinea' },
  { code: '+245', flag: '🇬🇼', name: 'Guinea-Bissau' },
  { code: '+592', flag: '🇬🇾', name: 'Guyana' },
  { code: '+509', flag: '🇭🇹', name: 'Haiti' },
  { code: '+504', flag: '🇭🇳', name: 'Honduras' },
  { code: '+36', flag: '🇭🇺', name: 'Hungary' },
  { code: '+354', flag: '🇮🇸', name: 'Iceland' },
  { code: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+98', flag: '🇮🇷', name: 'Iran' },
  { code: '+964', flag: '🇮🇶', name: 'Iraq' },
  { code: '+353', flag: '🇮🇪', name: 'Ireland' },
  { code: '+972', flag: '🇮🇱', name: 'Israel' },
  { code: '+39', flag: '🇮🇹', name: 'Italy' },
  { code: '+1', flag: '🇯🇲', name: 'Jamaica' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: '+962', flag: '🇯🇴', name: 'Jordan' },
  { code: '+7', flag: '🇰🇿', name: 'Kazakhstan' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+686', flag: '🇰🇮', name: 'Kiribati' },
  { code: '+965', flag: '🇰🇼', name: 'Kuwait' },
  { code: '+996', flag: '🇰🇬', name: 'Kyrgyzstan' },
  { code: '+856', flag: '🇱🇦', name: 'Laos' },
  { code: '+371', flag: '🇱🇻', name: 'Latvia' },
  { code: '+961', flag: '🇱🇧', name: 'Lebanon' },
  { code: '+266', flag: '🇱🇸', name: 'Lesotho' },
  { code: '+231', flag: '🇱🇷', name: 'Liberia' },
  { code: '+218', flag: '🇱🇾', name: 'Libya' },
  { code: '+423', flag: '🇱🇮', name: 'Liechtenstein' },
  { code: '+370', flag: '🇱🇹', name: 'Lithuania' },
  { code: '+352', flag: '🇱🇺', name: 'Luxembourg' },
  { code: '+389', flag: '🇲🇰', name: 'Macedonia' },
  { code: '+261', flag: '🇲🇬', name: 'Madagascar' },
  { code: '+265', flag: '🇲🇼', name: 'Malawi' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+960', flag: '🇲🇻', name: 'Maldives' },
  { code: '+223', flag: '🇲🇱', name: 'Mali' },
  { code: '+356', flag: '🇲🇹', name: 'Malta' },
  { code: '+692', flag: '🇲🇭', name: 'Marshall Islands' },
  { code: '+222', flag: '🇲🇷', name: 'Mauritania' },
  { code: '+230', flag: '🇲🇺', name: 'Mauritius' },
  { code: '+52', flag: '🇲🇽', name: 'Mexico' },
  { code: '+691', flag: '🇫🇲', name: 'Micronesia' },
  { code: '+373', flag: '🇲🇩', name: 'Moldova' },
  { code: '+377', flag: '🇲🇨', name: 'Monaco' },
  { code: '+976', flag: '🇲🇳', name: 'Mongolia' },
  { code: '+382', flag: '🇲🇪', name: 'Montenegro' },
  { code: '+212', flag: '🇲🇦', name: 'Morocco' },
  { code: '+258', flag: '🇲🇿', name: 'Mozambique' },
  { code: '+95', flag: '🇲🇲', name: 'Myanmar' },
  { code: '+264', flag: '🇳🇦', name: 'Namibia' },
  { code: '+674', flag: '🇳🇷', name: 'Nauru' },
  { code: '+977', flag: '🇳🇵', name: 'Nepal' },
  { code: '+31', flag: '🇳🇱', name: 'Netherlands' },
  { code: '+64', flag: '🇳🇿', name: 'New Zealand' },
  { code: '+505', flag: '🇳🇮', name: 'Nicaragua' },
  { code: '+227', flag: '🇳🇪', name: 'Niger' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+850', flag: '🇰🇵', name: 'North Korea' },
  { code: '+47', flag: '🇳🇴', name: 'Norway' },
  { code: '+968', flag: '🇴🇲', name: 'Oman' },
  { code: '+680', flag: '🇵🇼', name: 'Palau' },
  { code: '+970', flag: '🇵🇸', name: 'Palestine' },
  { code: '+507', flag: '🇵🇦', name: 'Panama' },
  { code: '+675', flag: '🇵🇬', name: 'Papua New Guinea' },
  { code: '+595', flag: '🇵🇾', name: 'Paraguay' },
  { code: '+51', flag: '🇵🇪', name: 'Peru' },
  { code: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: '+48', flag: '🇵🇱', name: 'Poland' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: '+40', flag: '🇷🇴', name: 'Romania' },
  { code: '+7', flag: '🇷🇺', name: 'Russia' },
  { code: '+250', flag: '🇷🇼', name: 'Rwanda' },
  { code: '+378', flag: '🇸🇲', name: 'San Marino' },
  { code: '+239', flag: '🇸🇹', name: 'Sao Tome and Principe' },
  { code: '+221', flag: '🇸🇳', name: 'Senegal' },
  { code: '+381', flag: '🇷🇸', name: 'Serbia' },
  { code: '+248', flag: '🇸🇨', name: 'Seychelles' },
  { code: '+232', flag: '🇸🇱', name: 'Sierra Leone' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+421', flag: '🇸🇰', name: 'Slovakia' },
  { code: '+386', flag: '🇸🇮', name: 'Slovenia' },
  { code: '+677', flag: '🇸🇧', name: 'Solomon Islands' },
  { code: '+252', flag: '🇸🇴', name: 'Somalia' },
  { code: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: '+82', flag: '🇰🇷', name: 'South Korea' },
  { code: '+211', flag: '🇸🇸', name: 'South Sudan' },
  { code: '+34', flag: '🇪🇸', name: 'Spain' },
  { code: '+94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+249', flag: '🇸🇩', name: 'Sudan' },
  { code: '+597', flag: '🇸🇷', name: 'Suriname' },
  { code: '+268', flag: '🇸🇿', name: 'Swaziland' },
  { code: '+46', flag: '🇸🇪', name: 'Sweden' },
  { code: '+41', flag: '🇨🇭', name: 'Switzerland' },
  { code: '+963', flag: '🇸🇾', name: 'Syria' },
  { code: '+886', flag: '🇹🇼', name: 'Taiwan' },
  { code: '+992', flag: '🇹🇯', name: 'Tajikistan' },
  { code: '+255', flag: '🇹🇿', name: 'Tanzania' },
  { code: '+66', flag: '🇹🇭', name: 'Thailand' },
  { code: '+228', flag: '🇹🇬', name: 'Togo' },
  { code: '+676', flag: '🇹🇴', name: 'Tonga' },
  { code: '+1', flag: '🇹🇹', name: 'Trinidad and Tobago' },
  { code: '+216', flag: '🇹🇳', name: 'Tunisia' },
  { code: '+993', flag: '🇹🇲', name: 'Turkmenistan' },
  { code: '+688', flag: '🇹🇻', name: 'Tuvalu' },
  { code: '+256', flag: '🇺🇬', name: 'Uganda' },
  { code: '+380', flag: '🇺🇦', name: 'Ukraine' },
  { code: '+598', flag: '🇺🇾', name: 'Uruguay' },
  { code: '+998', flag: '🇺🇿', name: 'Uzbekistan' },
  { code: '+678', flag: '🇻🇺', name: 'Vanuatu' },
  { code: '+379', flag: '🇻🇦', name: 'Vatican City' },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+84', flag: '🇻🇳', name: 'Vietnam' },
  { code: '+967', flag: '🇾🇪', name: 'Yemen' },
  { code: '+260', flag: '🇿🇲', name: 'Zambia' },
  { code: '+263', flag: '🇿🇼', name: 'Zimbabwe' },
];

// OTP Input Component
interface OTPInputProps {
  code: string;
  setCode: (code: string) => void;
  length?: number;
}

const OTPInput = memo(function OTPInput({ code, setCode, length = 6 }: OTPInputProps) {
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleChange = (text: string, index: number) => {
    const newCode = code.split('');
    newCode[index] = text;
    setCode(newCode.join(''));

    if (text && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    }
  };

  return (
    <View style={otpStyles.container}>
      {Array.from({ length }).map((_, index) => (
        <TextInput
          key={index}
          ref={(ref) => (inputRefs.current[index] = ref)}
          style={[
            otpStyles.input,
            focusedIndex === index && otpStyles.inputFocused,
            code[index] && otpStyles.inputFilled,
          ]}
          maxLength={1}
          keyboardType="number-pad"
          value={code[index] || ''}
          onChangeText={(text) => handleChange(text.replace(/[^0-9]/g, ''), index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          onFocus={() => setFocusedIndex(index)}
          selectTextOnFocus
          caretHidden
        />
      ))}
    </View>
  );
});

const otpStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 24,
  },
  input: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
  },
  inputFocused: {
    borderColor: '#7C3AED',
    backgroundColor: '#FFFFFF',
  },
  inputFilled: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
    color: '#059669',
  },
});

// Country Picker Modal
interface CountryPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (country: typeof COUNTRIES[0]) => void;
  selectedCode: string;
}

const CountryPickerModal = memo(function CountryPickerModal({
  visible,
  onClose,
  onSelect,
  selectedCode,
}: CountryPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Select Country</Text>
            <Pressable onPress={onClose} style={modalStyles.closeBtn}>
              <IconSymbol size={24} name="xmark" color="#64748B" />
            </Pressable>
          </View>
          <ScrollView style={modalStyles.list} showsVerticalScrollIndicator={false}>
            {COUNTRIES.map((country) => (
              <Pressable
                key={`${country.code}-${country.name}`}
                style={[modalStyles.item, selectedCode === country.code && modalStyles.itemActive]}
                onPress={() => {
                  onSelect(country);
                  onClose();
                }}
              >
                <Text style={modalStyles.flag}>{country.flag}</Text>
                <View style={modalStyles.info}>
                  <Text style={modalStyles.name}>{country.name}</Text>
                  <Text style={modalStyles.code}>{country.code}</Text>
                </View>
                {selectedCode === country.code && <IconSymbol size={20} name="checkmark" color="#7C3AED" />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 4,
    gap: 12,
  },
  itemActive: {
    backgroundColor: '#EDE9FE',
  },
  flag: {
    fontSize: 28,
    width: 40,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E293B',
  },
  code: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
});

// Email Input Step
export const StepEmailInput = memo(function StepEmailInput({
  email,
  setEmail,
  onSendOTP,
  isLoading,
}: {
  email: string;
  setEmail: (email: string) => void;
  onSendOTP: () => void;
  isLoading: boolean;
}) {
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <View style={styles.container}>
      <StepHeader title="What's your email?" subtitle="We'll send you a verification code" onBack={() => {}} showBack={false} />
      
      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <IconSymbol size={40} name="envelope.fill" color="#7C3AED" />
        </View>
      </View>

      <Text style={styles.title}>Enter your email address</Text>
      <Text style={styles.subtitle}>We&apos;ll send a 6-digit verification code to verify it&apos;s really you</Text>

      <View style={styles.inputContainer}>
        <TextInput
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          style={styles.input}
          outlineColor="#E2E8F0"
          activeOutlineColor="#7C3AED"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="example@mail.com"
          left={<TextInput.Icon icon="email" color="#64748B" />}
          editable={!isLoading}
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          buttonColor="#7C3AED"
          textColor="#FFFFFF"
          style={[styles.button, (!isValid || isLoading) && styles.buttonDisabled]}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          onPress={onSendOTP}
          disabled={!isValid || isLoading}
          loading={isLoading}
        >
          Send Verification Code
        </Button>
      </View>

      <View style={styles.securityNote}>
        <IconSymbol size={16} name="lock.shield" color="#64748B" />
        <Text style={styles.securityText}>Your information is secure and encrypted</Text>
      </View>
    </View>
  );
});

// Phone Input Step
export const StepPhoneInput = memo(function StepPhoneInput({
  phoneNumber,
  selectedCountry,
  setPhoneNumber,
  setSelectedCountry,
  onSendOTP,
  isLoading,
}: {
  phoneNumber: string;
  selectedCountry: typeof COUNTRIES[0];
  setPhoneNumber: (phone: string) => void;
  setSelectedCountry: (country: typeof COUNTRIES[0]) => void;
  onSendOTP: () => void;
  isLoading: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const isValid = phoneNumber.length >= 10 && /^[0-9]+$/.test(phoneNumber);

  return (
    <View style={styles.container}>
      <StepHeader title="What's your number?" subtitle="We'll send you a verification code" onBack={() => {}} showBack={false} />
      
      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <IconSymbol size={40} name="phone.fill" color="#7C3AED" />
        </View>
      </View>

      <Text style={styles.title}>Enter your phone number</Text>
      <Text style={styles.subtitle}>We&apos;ll send a 6-digit verification code via SMS</Text>

      <View style={styles.phoneInputContainer}>
        <Pressable style={styles.countryButton} onPress={() => setShowPicker(true)}>
          <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
          <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
          <IconSymbol size={16} name="chevron.down" color="#64748B" />
        </Pressable>

        <View style={styles.numberInputWrapper}>
          <TextInput
            label="Phone Number"
            value={phoneNumber}
            onChangeText={(t) => setPhoneNumber(t.replace(/[^0-9]/g, ''))}
            mode="outlined"
            style={styles.numberInput}
            outlineColor="#E2E8F0"
            activeOutlineColor="#7C3AED"
            keyboardType="phone-pad"
            maxLength={15}
            placeholder="Enter number"
            editable={!isLoading}
          />
        </View>
      </View>

      <Text style={styles.hint}>Enter your mobile number without the country code</Text>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          buttonColor="#7C3AED"
          textColor="#FFFFFF"
          style={[styles.button, (!isValid || isLoading) && styles.buttonDisabled]}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          onPress={onSendOTP}
          disabled={!isValid || isLoading}
          loading={isLoading}
        >
          Send Verification Code
        </Button>
      </View>

      <View style={styles.securityNote}>
        <IconSymbol size={16} name="lock.shield" color="#64748B" />
        <Text style={styles.securityText}>Standard SMS rates may apply</Text>
      </View>

      <CountryPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={setSelectedCountry}
        selectedCode={selectedCountry.code}
      />
    </View>
  );
});

// OTP Verification Step
export const StepOTPVerify = memo(function StepOTPVerify({
  identifier,
  type,
  otpCode,
  setOtpCode,
  onVerify,
  onResend,
  onChangeIdentifier,
  isLoading,
  resendTimer,
}: {
  identifier: string;
  type: 'email' | 'phone';
  otpCode: string;
  setOtpCode: (code: string) => void;
  onVerify: () => void;
  onResend: () => void;
  onChangeIdentifier: () => void;
  isLoading: boolean;
  resendTimer: number;
}) {
  const isValid = otpCode.length === 6;

  return (
    <View style={styles.container}>
      <StepHeader title="Enter verification code" subtitle={`We sent a code to ${identifier}`} onBack={onChangeIdentifier} />
      
      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <IconSymbol size={40} name="lock.fill" color="#7C3AED" />
        </View>
      </View>

      <Text style={styles.title}>Verify your {type === 'email' ? 'email' : 'number'}</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code we sent you</Text>

      <OTPInput code={otpCode} setCode={setOtpCode} />

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          buttonColor="#7C3AED"
          textColor="#FFFFFF"
          style={[styles.button, (!isValid || isLoading) && styles.buttonDisabled]}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          onPress={onVerify}
          disabled={!isValid || isLoading}
          loading={isLoading}
        >
          Verify Code
        </Button>
      </View>

      <View style={styles.resendContainer}>
        {resendTimer > 0 ? (
          <Text style={styles.resendText}>Resend code in <Text style={styles.timerText}>{resendTimer}s</Text></Text>
        ) : (
          <Pressable onPress={onResend} disabled={isLoading}>
            <Text style={styles.resendLink}>Didn&apos;t receive it? Resend</Text>
          </Pressable>
        )}
        <Pressable onPress={onChangeIdentifier} style={styles.changeButton}>
          <Text style={styles.changeText}>Wrong {type === 'email' ? 'email' : 'number'}? Change it</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  iconContainer: { alignItems: 'center', marginVertical: 24 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#1E293B', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 20 },
  inputContainer: { marginBottom: 8 },
  input: { backgroundColor: '#FFFFFF' },
  phoneInputContainer: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  countryButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 8, height: 56 },
  countryFlag: { fontSize: 24 },
  countryCodeText: { fontSize: 15, fontWeight: '600', color: '#1E293B', minWidth: 45 },
  numberInputWrapper: { flex: 1 },
  numberInput: { backgroundColor: '#FFFFFF', height: 56 },
  hint: { fontSize: 13, color: '#94A3B8', marginBottom: 24, fontStyle: 'italic' },
  buttonContainer: { marginTop: 8 },
  button: { borderRadius: 16, elevation: 2 },
  buttonDisabled: { opacity: 0.5 },
  buttonContent: { paddingVertical: 8, height: 56 },
  buttonLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  securityNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12 },
  securityText: { fontSize: 13, color: '#64748B' },
  resendContainer: { alignItems: 'center', marginTop: 24 },
  resendText: { fontSize: 14, color: '#64748B' },
  timerText: { color: '#7C3AED', fontWeight: '700' },
  resendLink: { fontSize: 14, color: '#7C3AED', fontWeight: '600' },
  changeButton: { marginTop: 12 },
  changeText: { fontSize: 14, color: '#64748B' },
});
