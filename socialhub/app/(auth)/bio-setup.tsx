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
import { Text, TextInput, MD3LightTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { setPhoneSignupData } from '@/store/authSlice';
import { FontAwesome } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const PRIMARY = '#7C3AED';

export default function BioSetupScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { width } = useWindowDimensions();

  const [bio, setBio] = useState('');

  const handleNext = () => {
    dispatch(setPhoneSignupData({ bio }));
    router.push('/(auth)/biometrics' as any);
  };

  // Bio is optional — always allow continuing
  const isFormValid = true;

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
          <Text style={styles.titleText}>Tell us about yourself</Text>
          <Text style={styles.optionalText}>(Optional)</Text>
          <Text style={styles.subtitleText}>
            Share a little about yourself with the community.
          </Text>
        </Animated.View>

        {/* Form Section */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={[styles.formSection, { maxWidth: Math.min(width - 48, 400) }]}
        >
          <TextInput
            placeholder="Love connecting with new people and exploring new things! ✨"
            value={bio}
            onChangeText={setBio}
            mode="outlined"
            multiline
            numberOfLines={4}
            maxLength={120}
            style={styles.bioInput}
            textColor="#1E293B"
            outlineColor="#E2E8F0"
            activeOutlineColor={PRIMARY}
            outlineStyle={{ borderRadius: 16, borderWidth: 1.5 }}
            theme={{
              ...MD3LightTheme,
              colors: {
                ...MD3LightTheme.colors,
                onSurface: '#1E293B',
                onSurfaceVariant: '#94A3B8',
              },
            }}
          />
          <Text style={styles.charCount}>{bio.length}/120</Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* Action Buttons */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(600)}
          style={[styles.actionsSection, { maxWidth: Math.min(width - 48, 400) }]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              {
                backgroundColor: !isFormValid ? '#CBD5E1' : PRIMARY,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
            onPress={handleNext}
            disabled={!isFormValid}
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
    marginBottom: 40,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  optionalText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  formSection: {
    width: '100%',
  },
  bioInput: {
    backgroundColor: '#F8FAFC',
    fontSize: 15,
    lineHeight: 24,
    height: 140,
    textAlignVertical: 'top',
    color: '#1E293B',
  },
  charCount: {
    alignSelf: 'flex-end',
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 8,
    marginRight: 4,
  },
  actionsSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
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
