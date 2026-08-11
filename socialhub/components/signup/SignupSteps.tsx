import React, { useState, memo, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View, ActivityIndicator, Alert } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AntDesign, Entypo } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';

// Types
export type SignupStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const COUNTRIES = [
  { code: '+1', flag: '🇺🇸', name: 'USA' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+92', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+90', flag: '🇹🇷', name: 'Turkey' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const GENDERS = [
  { id: 'male', label: 'Male', icon: '👨' },
  { id: 'female', label: 'Female', icon: '👩' },
  { id: 'other', label: 'Other', icon: '⚧️' },
];

// Progress Indicator Component
export const ProgressIndicator = memo(function ProgressIndicator({ currentStep, totalSteps }: { currentStep: SignupStep; totalSteps: number }) {
  return (
    <View style={signupStyles.progressContainer}>
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <View
          key={step}
          style={[
            signupStyles.progressDot,
            step === currentStep ? signupStyles.progressDotActive : step < currentStep ? signupStyles.progressDotCompleted : signupStyles.progressDotInactive,
          ]}>
          {step < currentStep && (
            <IconSymbol size={12} name="checkmark" color="#FFFFFF" />
          )}
        </View>
      ))}
    </View>
  );
});

// Back Button Component
export const BackButton = memo(function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Pressable onPress={onBack} style={signupStyles.backBtn}>
      <View style={signupStyles.backBtnCircle}>
        <IconSymbol size={20} name="chevron.left" color="#7C3AED" />
      </View>
    </Pressable>
  );
});

// Step Header Component
export const StepHeader = memo(function StepHeader({ title, subtitle, onBack, showBack = true }: { title: string; subtitle: string; onBack?: () => void; showBack?: boolean }) {
  return (
    <View style={signupStyles.stepHeaderContainer}>
      {showBack && onBack && <BackButton onBack={onBack} />}
      <View style={signupStyles.stepHeaderText}>
        <Text style={signupStyles.stepTitle}>{title}</Text>
        <Text style={signupStyles.stepSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
});

// Signup Options Section - Professional Design
const SIGNUP_OPTIONS = [
  { id: 'phone', label: 'Continue with Phone', icon: 'phone', color: '#7C3AED', iconFamily: 'Symbol' },
  { id: 'email', label: 'Continue with Email', icon: 'envelope', color: '#3B82F6', iconFamily: 'Symbol' },
  { id: 'google', label: 'Continue with Google', icon: 'google', color: '#EA4335', iconFamily: 'AntDesign' },
  { id: 'facebook', label: 'Continue with Facebook', icon: 'facebook-with-circle', color: '#1877F2', iconFamily: 'Entypo' },
  { id: 'apple', label: 'Continue with Apple', icon: 'apple1', color: '#000000', iconFamily: 'AntDesign' },
] as const;

export const Step0SignupOptions = memo(function Step0SignupOptions({ onSelectMethod }: { onSelectMethod: (method: 'phone' | 'email' | 'google' | 'facebook' | 'apple') => void }) {
  return (
    <>
      <StepHeader
        title="Create your account"
        subtitle="Choose how you want to sign up"
        onBack={() => { }}
        showBack={false}
      />

      <View style={signupStyles.signupOptionsContainer}>
        {SIGNUP_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            style={signupStyles.signupOptionButton}
            onPress={() => onSelectMethod(option.id as any)}>
            <View style={[signupStyles.signupOptionIcon, { backgroundColor: `${option.color}15` }]}>
              {option.iconFamily === 'AntDesign' ? (
                <AntDesign name={option.icon as any} size={24} color={option.color} />
              ) : option.iconFamily === 'Entypo' ? (
                <Entypo name={option.icon as any} size={24} color={option.color} />
              ) : (
                <IconSymbol size={24} name={option.icon as any} color={option.color} />
              )}
            </View>
            <Text style={signupStyles.signupOptionLabel}>{option.label}</Text>
            <IconSymbol size={20} name="chevron.right" color="#94A3B8" />
          </Pressable>
        ))}
      </View>

      <View style={signupStyles.signupTermsContainer}>
        <Text style={signupStyles.signupTermsText}>
          By signing up, you agree to our{' '}
          <Text style={signupStyles.signupTermsLink}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={signupStyles.signupTermsLink}>Privacy Policy</Text>
        </Text>
      </View>
    </>
  );
});

// Step 1: First Name + Last Name
export const Step1Name = memo(function Step1Name({ firstName, lastName, setFirstName, setLastName, onNext }: { firstName: string, lastName: string, setFirstName: (t: string) => void, setLastName: (t: string) => void, onNext: () => void }) {
  const isValid = firstName.trim().length >= 2 && lastName.trim().length >= 2;

  return (
    <>
      <StepHeader
        title="What's your name?"
        subtitle="Enter your first and last name"
        onBack={() => { }}
        showBack={false}
      />

      <View style={signupStyles.nameStack}>
        <TextInput
          label="First Name"
          value={firstName}
          onChangeText={setFirstName}
          mode="outlined"
          style={signupStyles.input}
          outlineColor="#E2E8F0"
          activeOutlineColor="#7C3AED"
          autoCapitalize="words"
          placeholder="Enter first name"
        />
        <TextInput
          label="Last Name"
          value={lastName}
          onChangeText={setLastName}
          mode="outlined"
          style={signupStyles.input}
          outlineColor="#E2E8F0"
          activeOutlineColor="#7C3AED"
          autoCapitalize="words"
          placeholder="Enter last name"
        />
      </View>

      <View style={signupStyles.buttonContainer}>
        <Button
          mode="contained"
          buttonColor="#7C3AED"
          textColor="#FFFFFF"
          style={signupStyles.primaryBtn}
          contentStyle={signupStyles.primaryBtnContent}
          labelStyle={signupStyles.primaryBtnLabel}
          onPress={onNext}
          disabled={!isValid}>
          Continue
        </Button>
      </View>
    </>
  );
});

// Step 2: Birthday & Gender
export const Step2Birthday = memo(function Step2Birthday({ day, month, year, gender, setDay, setMonth, setYear, setGender, onNext, onBack }: any) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(parseInt(month) ? parseInt(month) - 1 : new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(parseInt(year) || new Date().getFullYear() - 20);

  const isValid = day && month && year && gender;

  const getDaysInMonth = (m: number, y: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m: number, y: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const firstDay = getFirstDayOfMonth(selectedMonth, selectedYear);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1949 }, (_, i) => currentYear - i);

  const handleDateSelect = (d: number) => {
    setDay(String(d));
    setMonth(String(selectedMonth + 1));
    setYear(String(selectedYear));
    setShowCalendar(false);
  };

  return (
    <>
      <StepHeader title="When's your birthday?" subtitle="Select your date of birth" onBack={onBack} />
      <Pressable style={signupStyles.dateDisplayBar} onPress={() => setShowCalendar(!showCalendar)}>
        <Text style={signupStyles.dateDisplayText}>
          {day && month && year ? `${day} ${MONTHS[parseInt(month) - 1]} ${year}` : 'Select Date'}
        </Text>
        <IconSymbol size={24} name={showCalendar ? "arrow.up" : "arrow.down"} color="#7C3AED" />
      </Pressable>

      {showCalendar && (
        <View style={signupStyles.calendarContainer}>
          <View style={signupStyles.calendarHeader}>
            <Pressable style={signupStyles.monthYearSelector} onPress={() => setShowMonthPicker(!showMonthPicker)}>
              <Text style={signupStyles.monthYearText}>{MONTHS[selectedMonth]}</Text>
              <IconSymbol size={16} name={showMonthPicker ? "arrow.up" : "arrow.down"} color="#7C3AED" />
            </Pressable>
            <Pressable style={signupStyles.monthYearSelector} onPress={() => setShowYearPicker(!showYearPicker)}>
              <Text style={signupStyles.monthYearText}>{selectedYear}</Text>
              <IconSymbol size={16} name={showYearPicker ? "arrow.up" : "arrow.down"} color="#7C3AED" />
            </Pressable>
          </View>

          {showMonthPicker && (
            <View style={signupStyles.pickerDropdown}>
              <ScrollView style={signupStyles.pickerScroll}>
                {MONTHS.map((m, i) => (
                  <Pressable key={m} style={[signupStyles.pickerItem, selectedMonth === i && signupStyles.pickerItemActive]} onPress={() => { setSelectedMonth(i); setShowMonthPicker(false); }}>
                    <Text style={[signupStyles.pickerItemText, selectedMonth === i && signupStyles.pickerItemTextActive]}>{m}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {showYearPicker && (
            <View style={signupStyles.pickerDropdown}>
              <ScrollView style={signupStyles.pickerScroll}>
                {years.map(y => (
                  <Pressable key={y} style={[signupStyles.pickerItem, selectedYear === y && signupStyles.pickerItemActive]} onPress={() => { setSelectedYear(y); setShowYearPicker(false); }}>
                    <Text style={[signupStyles.pickerItemText, selectedYear === y && signupStyles.pickerItemTextActive]}>{y}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={signupStyles.calendarDayHeaders}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <Text key={d} style={signupStyles.calendarDayHeader}>{d}</Text>)}
          </View>
          <View style={signupStyles.calendarGrid}>
            {Array.from({ length: firstDay }).map((_, i) => <View key={`empty-${i}`} style={signupStyles.calendarDayEmpty} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
              const isSelected = parseInt(day) === d && parseInt(month) === selectedMonth + 1 && selectedYear === selectedYear;
              return (
                <Pressable key={d} style={[signupStyles.calendarDay, isSelected && signupStyles.calendarDaySelected]} onPress={() => handleDateSelect(d)}>
                  <Text style={[signupStyles.calendarDayText, isSelected && signupStyles.calendarDayTextSelected]}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <Text style={signupStyles.sectionLabel}>Gender</Text>
      <Pressable style={signupStyles.genderDropdown} onPress={() => setShowGenderDropdown(!showGenderDropdown)}>
        <Text style={gender ? signupStyles.genderDropdownSelected : signupStyles.genderDropdownPlaceholder}>
          {gender ? GENDERS.find(g => g.id === gender)?.label : 'Select your gender'}
        </Text>
        <IconSymbol size={20} name={showGenderDropdown ? "arrow.up" : "arrow.down"} color="#64748B" />
      </Pressable>

      {showGenderDropdown && (
        <View style={signupStyles.genderDropdownList}>
          {GENDERS.map((g) => (
            <Pressable key={g.id} style={[signupStyles.genderDropdownItem, gender === g.id && signupStyles.genderDropdownItemActive]} onPress={() => { setGender(g.id); setShowGenderDropdown(false); }}>
              <Text style={signupStyles.genderDropdownIcon}>{g.icon}</Text>
              <Text style={[signupStyles.genderDropdownLabel, gender === g.id && signupStyles.genderDropdownLabelActive]}>{g.label}</Text>
              {gender === g.id && <IconSymbol size={20} name="checkmark" color="#7C3AED" />}
            </Pressable>
          ))}
        </View>
      )}

      <View style={signupStyles.buttonContainer}>
        <Button mode="contained" buttonColor="#7C3AED" textColor="#FFFFFF" style={signupStyles.primaryBtn} contentStyle={signupStyles.primaryBtnContent} labelStyle={signupStyles.primaryBtnLabel} onPress={onNext} disabled={!isValid}>
          Continue
        </Button>
      </View>
    </>
  );
});

// Step 3: Username
export const Step3Username = memo(function Step3Username({ username, setUsername, onNext, onBack }: any) {
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (username.length >= 3) {
      setChecking(true);
      const timer = setTimeout(() => {
        const isAvailable = !['admin', 'root', 'test', 'user'].includes(username.toLowerCase());
        setAvailable(isAvailable);
        setChecking(false);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setAvailable(null);
    }
  }, [username]);

  const isValid = username.length >= 3 && /[0-9]/.test(username) && available === true;

  return (
    <>
      <StepHeader title="Choose a username" subtitle="This will be your unique identifier" onBack={onBack} />
      <View style={signupStyles.usernameContainer}>
        <TextInput
          label="Username"
          value={username}
          onChangeText={setUsername}
          mode="outlined"
          style={signupStyles.input}
          outlineColor="#E2E8F0"
          activeOutlineColor="#7C3AED"
          left={<TextInput.Icon icon="at" />}
          autoCapitalize="none"
          placeholder="@username"
          right={
            checking ? <TextInput.Icon icon={() => <ActivityIndicator size={20} color="#7C3AED" />} /> :
              available === true ? <TextInput.Icon icon={() => <IconSymbol size={20} name="checkmark.circle.fill" color="#10B981" />} /> :
                available === false ? <TextInput.Icon icon={() => <IconSymbol size={20} name="xmark" color="#EF4444" />} /> : undefined
          }
        />
        {username.length >= 3 && !checking && available !== null && (
          <View style={signupStyles.availabilityBadge}>
            <View style={available ? signupStyles.availableIndicator : signupStyles.takenIndicator}>
              <IconSymbol size={16} name={available ? "checkmark" : "xmark"} color={available ? "#10B981" : "#EF4444"} />
              <Text style={available ? signupStyles.availableText : signupStyles.takenText}>{available ? 'Available' : 'Username taken'}</Text>
            </View>
          </View>
        )}
        <View style={signupStyles.usernameRequirements}>
          <Text style={signupStyles.requirementsTitle}>Username must have:</Text>
          <View style={signupStyles.requirementRow}>
            <IconSymbol size={16} name={username.length >= 3 ? "checkmark.circle.fill" : "circle"} color={username.length >= 3 ? "#10B981" : "#94A3B8"} />
            <Text style={[signupStyles.requirementText, username.length >= 3 && signupStyles.requirementMet]}>At least 3 characters</Text>
          </View>
          <View style={signupStyles.requirementRow}>
            <IconSymbol size={16} name={/[0-9]/.test(username) ? "checkmark.circle.fill" : "circle"} color={/[0-9]/.test(username) ? "#10B981" : "#94A3B8"} />
            <Text style={[signupStyles.requirementText, /[0-9]/.test(username) && signupStyles.requirementMet]}>At least one number</Text>
          </View>
        </View>
      </View>
      <View style={signupStyles.buttonContainer}>
        <Button mode="contained" buttonColor="#7C3AED" textColor="#FFFFFF" style={signupStyles.primaryBtn} contentStyle={signupStyles.primaryBtnContent} labelStyle={signupStyles.primaryBtnLabel} onPress={onNext} disabled={!isValid}>
          Continue
        </Button>
      </View>
    </>
  );
});

// Step 4: Address
export const Step4Address = memo(function Step4Address({ address, setAddress, onNext, onBack }: any) {
  const isValid = address.trim().length >= 5;
  return (
    <>
      <StepHeader title="Where do you live?" subtitle="Enter your address" onBack={onBack} />
      <View style={{ marginBottom: 16 }}>
        <TextInput
          label="Address"
          value={address}
          onChangeText={setAddress}
          mode="outlined"
          style={signupStyles.input}
          outlineColor="#E2E8F0"
          activeOutlineColor="#7C3AED"
          placeholder="Enter your full address"
          left={<TextInput.Icon icon="home" />}
          multiline
          numberOfLines={3}
        />
      </View>
      <Text style={signupStyles.phoneHint}>This will be displayed on your profile</Text>
      <View style={signupStyles.buttonContainer}>
        <Button mode="contained" buttonColor="#7C3AED" textColor="#FFFFFF" style={signupStyles.primaryBtn} contentStyle={signupStyles.primaryBtnContent} labelStyle={signupStyles.primaryBtnLabel} onPress={onNext} disabled={!isValid}>
          Continue
        </Button>
      </View>
    </>
  );
});

// Step 5: Phone
export const Step4Phone = memo(function Step4Phone({ phoneNumber, selectedCountry, setPhoneNumber, setSelectedCountry, onNext, onBack }: any) {
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const isValid = phoneNumber.length >= 10 && /^[0-9]+$/.test(phoneNumber);

  return (
    <>
      <StepHeader title="What's your phone number?" subtitle="We'll send you a verification code" onBack={onBack} />
      <View style={signupStyles.phoneInputRow}>
        <Pressable style={signupStyles.countrySelectorBtn} onPress={() => setShowCountryPicker(!showCountryPicker)}>
          <Text style={signupStyles.countryFlagLarge}>{selectedCountry.flag}</Text>
          <Text style={signupStyles.countryCodeLarge}>{selectedCountry.code}</Text>
          <IconSymbol size={16} name={showCountryPicker ? "arrow.up" : "arrow.down"} color="#64748B" />
        </Pressable>
        <View style={signupStyles.phoneNumberInputContainer}>
          <TextInput label="Phone Number" value={phoneNumber} onChangeText={t => setPhoneNumber(t.replace(/[^0-9]/g, ''))} mode="outlined" style={signupStyles.phoneNumberInput} outlineColor="#E2E8F0" activeOutlineColor="#7C3AED" keyboardType="phone-pad" maxLength={15} placeholder="Enter number" />
        </View>
      </View>
      {showCountryPicker && (
        <View style={signupStyles.countryPickerDropdown}>
          <ScrollView style={signupStyles.countryPickerScroll}>
            {COUNTRIES.map((c) => (
              <Pressable key={c.code} style={[signupStyles.countryPickerItem, selectedCountry.code === c.code && signupStyles.countryPickerItemActive]} onPress={() => { setSelectedCountry(c); setShowCountryPicker(false); }}>
                <Text style={signupStyles.countryPickerFlag}>{c.flag}</Text>
                <Text style={signupStyles.countryPickerCode}>{c.code}</Text>
                <Text style={signupStyles.countryPickerName}>{c.name}</Text>
                {selectedCountry.code === c.code && <IconSymbol size={20} name="checkmark" color="#7C3AED" />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      <Text style={signupStyles.phoneHint}>Enter your mobile number without the country code</Text>
      <View style={signupStyles.buttonContainer}>
        <Button mode="contained" buttonColor="#7C3AED" textColor="#FFFFFF" style={signupStyles.primaryBtn} contentStyle={signupStyles.primaryBtnContent} labelStyle={signupStyles.primaryBtnLabel} onPress={onNext} disabled={!isValid}>
          Continue
        </Button>
      </View>
    </>
  );
});

// Step 4: Email
export const Step4Email = memo(function Step4Email({ email, setEmail, onNext, onBack }: any) {
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return (
    <>
      <StepHeader title="What's your email?" subtitle="We'll send you a verification link" onBack={onBack} />
      <View style={{ marginBottom: 16 }}>
        <TextInput label="Email Address" value={email} onChangeText={setEmail} mode="outlined" style={signupStyles.input} outlineColor="#E2E8F0" activeOutlineColor="#7C3AED" keyboardType="email-address" autoCapitalize="none" placeholder="example@mail.com" left={<TextInput.Icon icon="email" />} />
      </View>
      <Text style={signupStyles.phoneHint}>Ensure this is an active email address</Text>
      <View style={signupStyles.buttonContainer}>
        <Button mode="contained" buttonColor="#7C3AED" textColor="#FFFFFF" style={signupStyles.primaryBtn} contentStyle={signupStyles.primaryBtnContent} labelStyle={signupStyles.primaryBtnLabel} onPress={onNext} disabled={!isValid}>
          Continue
        </Button>
      </View>
    </>
  );
});

// Step 5: Password
export const Step5Password = memo(function Step5Password({ password, confirmPassword, setPassword, setConfirmPassword, onNext, onBack }: any) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const getStrength = (p: string) => {
    if (!p) return { label: '', color: '#94A3B8', percent: 0 };
    if (p.length < 6) return { label: 'Weak', color: '#EF4444', percent: 25 };
    if (p.length < 8) return { label: 'Fair', color: '#F59E0B', percent: 50 };
    if (/[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)) return { label: 'Strong', color: '#10B981', percent: 100 };
    return { label: 'Good', color: '#7C3AED', percent: 75 };
  };

  const { label, color, percent } = getStrength(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isValid = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) && passwordsMatch;

  return (
    <>
      <StepHeader title="Create a password" subtitle="Keep your account secure" onBack={onBack} />
      <TextInput label="Password" value={password} onChangeText={setPassword} mode="outlined" style={signupStyles.input} outlineColor="#E2E8F0" activeOutlineColor="#7C3AED" secureTextEntry={!showPassword} left={<TextInput.Icon icon="lock" />} right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword(!showPassword)} />} />
      {password.length > 0 && (
        <View style={signupStyles.strengthContainer}>
          <View style={signupStyles.strengthBarBg}><View style={[signupStyles.strengthBar, { width: `${percent}%`, backgroundColor: color }]} /></View>
          <Text style={[signupStyles.strengthText, { color }]}>{label}</Text>
        </View>
      )}
      <View style={signupStyles.requirementsBox}>
        <Text style={signupStyles.requirementsTitle}>Password must have:</Text>
        {[
          { met: password.length >= 8, label: 'At least 8 characters' },
          { met: /[A-Z]/.test(password), label: 'One uppercase letter' },
          { met: /[0-9]/.test(password), label: 'One number' },
          { met: /[^A-Za-z0-9]/.test(password), label: 'One special character' },
        ].map((r, i) => (
          <View key={i} style={signupStyles.requirementRow}>
            <IconSymbol size={16} name={r.met ? "checkmark.circle.fill" : "circle"} color={r.met ? "#10B981" : "#94A3B8"} />
            <Text style={[signupStyles.requirementText, r.met && signupStyles.requirementMet]}>{r.label}</Text>
          </View>
        ))}
      </View>
      <TextInput label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} mode="outlined" style={[signupStyles.input, { marginTop: 16 }]} outlineColor="#E2E8F0" activeOutlineColor="#7C3AED" secureTextEntry={!showConfirm} left={<TextInput.Icon icon="shield" />} right={<TextInput.Icon icon={showConfirm ? "eye-off" : "eye"} onPress={() => setShowConfirm(!showConfirm)} />} />
      {confirmPassword.length > 0 && (
        <View style={signupStyles.matchContainer}>
          <View style={signupStyles.matchRow}>
            <IconSymbol size={16} name={passwordsMatch ? "checkmark.circle.fill" : "xmark"} color={passwordsMatch ? "#10B981" : "#EF4444"} />
            <Text style={passwordsMatch ? signupStyles.matchText : signupStyles.noMatchText}>{passwordsMatch ? 'Passwords match' : "Passwords don't match"}</Text>
          </View>
        </View>
      )}
      <View style={signupStyles.buttonContainer}>
        <Button mode="contained" buttonColor="#7C3AED" textColor="#FFFFFF" style={signupStyles.primaryBtn} contentStyle={signupStyles.primaryBtnContent} labelStyle={signupStyles.primaryBtnLabel} onPress={onNext} disabled={!isValid}>Continue</Button>
      </View>
    </>
  );
});

// Step 6: Biometric
export const Step6Biometric = memo(function Step6Biometric({ onNext, onBack, onEnableBiometric, enabledBiometrics }: any) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authenticate = async () => {
    setIsAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Verify your identity' });
      if (result.success) { onEnableBiometric('fingerprint'); Alert.alert('Success', 'Fingerprint enabled!'); }
      else { Alert.alert('Failed', 'Verification failed'); }
    } catch { Alert.alert('Error', 'Something went wrong'); }
    finally { setIsAuthenticating(false); }
  };

  return (
    <>
      <StepHeader title="Secure your account" subtitle="Add extra security with biometrics" onBack={onBack} />
      <View style={signupStyles.biometricContainer}>
        <Pressable style={[signupStyles.biometricCard, enabledBiometrics.fingerprint && signupStyles.biometricCardActive]} onPress={authenticate} disabled={isAuthenticating}>
          <View style={[signupStyles.biometricIcon, enabledBiometrics.fingerprint && signupStyles.biometricIconActive]}>
            {isAuthenticating ? <ActivityIndicator color="#7C3AED" /> : <IconSymbol size={40} name="touchid" color={enabledBiometrics.fingerprint ? "#FFFFFF" : "#7C3AED"} />}
          </View>
          <View style={signupStyles.biometricTextContainer}>
            <Text style={signupStyles.biometricTitle}>Fingerprint</Text>
            <Text style={signupStyles.biometricSubtitle}>{enabledBiometrics.fingerprint ? 'Enabled' : 'Tap to verify'}</Text>
          </View>
          <View style={[signupStyles.biometricCheck, enabledBiometrics.fingerprint && signupStyles.biometricCheckActive]}>
            {enabledBiometrics.fingerprint && <IconSymbol size={16} name="checkmark" color="#FFFFFF" />}
          </View>
        </Pressable>
        <Pressable style={[signupStyles.biometricCard, enabledBiometrics.voice && signupStyles.biometricCardActive]} onPress={() => onEnableBiometric('voice')}>
          <View style={[signupStyles.biometricIcon, enabledBiometrics.voice && signupStyles.biometricIconActive]}>
            <IconSymbol size={40} name="mic.fill" color={enabledBiometrics.voice ? "#FFFFFF" : "#7C3AED"} />
          </View>
          <View style={signupStyles.biometricTextContainer}>
            <Text style={signupStyles.biometricTitle}>Voice ID</Text>
            <Text style={signupStyles.biometricSubtitle}>Coming soon</Text>
          </View>
          <View style={[signupStyles.biometricCheck, enabledBiometrics.voice && signupStyles.biometricCheckActive]}>
            {enabledBiometrics.voice && <IconSymbol size={16} name="checkmark" color="#FFFFFF" />}
          </View>
        </Pressable>
      </View>
      <View style={signupStyles.buttonContainer}>
        <Button mode="contained" buttonColor="#7C3AED" textColor="#FFFFFF" style={signupStyles.primaryBtn} contentStyle={signupStyles.primaryBtnContent} labelStyle={signupStyles.primaryBtnLabel} onPress={onNext}>Continue</Button>
        <Pressable style={signupStyles.skipBtn} onPress={onNext}><Text style={signupStyles.skipText}>Skip</Text></Pressable>
      </View>
    </>
  );
});

// Step 7: Profile Photo
export const Step7ProfilePicture = memo(function Step7ProfilePicture({ onComplete, onBack }: any) {
  return (
    <>
      <StepHeader title="Add a profile picture" subtitle="Choose an avatar or skip for now" onBack={onBack} />
      <View style={signupStyles.avatarContainer}>
        <Pressable style={signupStyles.uploadBtnLarge}>
          <View style={signupStyles.uploadIconCircle}><IconSymbol size={40} name="camera" color="#7C3AED" /></View>
          <Text style={signupStyles.uploadTitle}>Upload Photo</Text>
          <Text style={signupStyles.uploadSubtitle}>Tap to select from gallery</Text>
        </Pressable>
      </View>
      <View style={signupStyles.buttonContainer}>
        <Button mode="contained" buttonColor="#7C3AED" textColor="#FFFFFF" style={signupStyles.primaryBtn} contentStyle={signupStyles.primaryBtnContent} labelStyle={signupStyles.primaryBtnLabel} onPress={onComplete}>Create Account</Button>
        <Pressable style={signupStyles.skipBtn} onPress={onComplete}><Text style={signupStyles.skipText}>Skip for now</Text></Pressable>
      </View>
    </>
  );
});

// Styles
export const signupStyles = StyleSheet.create({
  input: { marginBottom: 4, backgroundColor: '#FFFFFF' },
  buttonContainer: { marginTop: 24, gap: 12 },
  primaryBtn: { borderRadius: 16, elevation: 2 },
  primaryBtnContent: { paddingVertical: 8, height: 56 },
  primaryBtnLabel: { fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
  skipBtn: { alignSelf: 'center', paddingVertical: 12 },
  skipText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  progressDot: { width: 28, height: 8, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  progressDotActive: { backgroundColor: '#7C3AED', width: 28 },
  progressDotCompleted: { backgroundColor: '#10B981', width: 28 },
  progressDotInactive: { backgroundColor: '#E2E8F0', width: 8 },
  stepHeaderContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { marginRight: 12 },
  backBtnCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  stepHeaderText: { flex: 1 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: '#1E293B' },
  stepSubtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
  signupOptionsContainer: { gap: 12, marginBottom: 24 },
  signupOptionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  signupOptionIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  signupOptionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1E293B' },
  signupTermsContainer: { marginTop: 24, paddingHorizontal: 16 },
  signupTermsText: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  signupTermsLink: { color: '#7C3AED', fontWeight: '600' },
  nameStack: { flexDirection: 'column', gap: 12, marginBottom: 8 },
  dateDisplayBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  dateDisplayText: { fontSize: 16, color: '#1E293B', fontWeight: '500' },
  calendarContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginBottom: 20 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthYearSelector: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F8FAFC', borderRadius: 8, gap: 8 },
  monthYearText: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  pickerDropdown: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, maxHeight: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  pickerScroll: { padding: 8 },
  pickerItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 4 },
  pickerItemActive: { backgroundColor: '#EDE9FE' },
  pickerItemText: { fontSize: 15, color: '#1E293B', textAlign: 'center' },
  pickerItemTextActive: { color: '#7C3AED', fontWeight: '700' },
  calendarDayHeaders: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  calendarDayHeader: { fontSize: 12, fontWeight: '600', color: '#64748B', width: 36, textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
  calendarDay: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', margin: 2 },
  calendarDaySelected: { backgroundColor: '#7C3AED' },
  calendarDayText: { fontSize: 14, color: '#1E293B', fontWeight: '500' },
  calendarDayTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  calendarDayEmpty: { width: 36, height: 36, margin: 2 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#64748B', marginBottom: 8, marginTop: 16 },
  genderDropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8 },
  genderDropdownSelected: { fontSize: 16, fontWeight: '500', color: '#1E293B' },
  genderDropdownPlaceholder: { fontSize: 16, fontWeight: '400', color: '#94A3B8' },
  genderDropdownList: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  genderDropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12 },
  genderDropdownItemActive: { backgroundColor: '#EDE9FE' },
  genderDropdownIcon: { fontSize: 24 },
  genderDropdownLabel: { fontSize: 15, fontWeight: '500', color: '#1E293B', flex: 1 },
  genderDropdownLabelActive: { color: '#7C3AED', fontWeight: '600' },
  usernameContainer: { marginBottom: 16 },
  availabilityBadge: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  availableIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  availableText: { fontSize: 13, fontWeight: '600', color: '#10B981' },
  takenIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  takenText: { fontSize: 13, fontWeight: '600', color: '#EF4444' },
  usernameRequirements: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, marginTop: 16 },
  requirementsTitle: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 12 },
  requirementRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  requirementText: { fontSize: 13, color: '#64748B' },
  requirementMet: { color: '#10B981', fontWeight: '500' },
  phoneInputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  countrySelectorBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 8, height: 56 },
  countryFlagLarge: { fontSize: 24 },
  countryCodeLarge: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  phoneNumberInputContainer: { flex: 1 },
  phoneNumberInput: { backgroundColor: '#FFFFFF', height: 56 },
  countryPickerDropdown: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, maxHeight: 250, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  countryPickerScroll: { padding: 8 },
  countryPickerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, gap: 12 },
  countryPickerItemActive: { backgroundColor: '#EDE9FE' },
  countryPickerFlag: { fontSize: 24 },
  countryPickerCode: { fontSize: 14, fontWeight: '600', color: '#64748B', width: 50 },
  countryPickerName: { fontSize: 14, color: '#1E293B', flex: 1 },
  phoneHint: { fontSize: 13, color: '#64748B', marginBottom: 16, fontStyle: 'italic' },
  strengthContainer: { marginBottom: 16 },
  strengthBarBg: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  strengthBar: { height: '100%', borderRadius: 3 },
  strengthText: { fontSize: 13, fontWeight: '600', textAlign: 'right' },
  requirementsBox: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 16, alignItems: 'flex-start' },
  matchContainer: { marginTop: 8 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  matchText: { fontSize: 13, fontWeight: '500', color: '#10B981' },
  noMatchText: { fontSize: 13, fontWeight: '500', color: '#EF4444' },
  biometricContainer: { gap: 16, marginBottom: 16 },
  biometricCard: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 2, borderColor: '#E2E8F0' },
  biometricCardActive: { backgroundColor: '#EDE9FE', borderColor: '#7C3AED' },
  biometricIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  biometricIconActive: { backgroundColor: '#7C3AED' },
  biometricTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  biometricSubtitle: { fontSize: 13, color: '#64748B' },
  biometricTextContainer: { flex: 1 },
  biometricCheck: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  biometricCheckActive: { backgroundColor: '#10B981' },
  avatarContainer: { alignItems: 'center' },
  uploadBtnLarge: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32, backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', width: '100%' },
  uploadIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  uploadTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  uploadSubtitle: { fontSize: 14, color: '#64748B' },
});
