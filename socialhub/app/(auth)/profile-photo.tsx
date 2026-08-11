import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Image,
  Alert,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { setPhoneSignupData } from '@/store/authSlice';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const PRIMARY = '#7C3AED';

export default function ProfilePhotoScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { width } = useWindowDimensions();

  const [avatar, setAvatar] = useState<string | null>(null);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please grant library permissions to upload an avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // Updated from deprecated MediaTypeOptions
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0].uri) {
      setAvatar(result.assets[0].uri);
    }
  };

  const handleNext = () => {
    if (avatar) {
      dispatch(setPhoneSignupData({ profilePicture: avatar }));
    }
    router.push('/(auth)/bio-setup' as any);
  };

  const handleSkip = () => {
    router.push('/(auth)/bio-setup' as any);
  };

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
          <Text style={styles.titleText}>Add a profile photo</Text>
          <Text style={styles.optionalText}>(Optional)</Text>
          <Text style={styles.subtitleText}>
            Add a photo so your friends recognize you.
          </Text>
        </Animated.View>

        {/* Photo Section */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.photoSection}
        >
          <Pressable onPress={pickAvatar} style={styles.avatarTouch}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <FontAwesome name="camera" size={40} color="#FFFFFF" />
              </View>
            )}
            <View style={styles.plusBadge}>
              <FontAwesome name="plus" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* Action Buttons */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(600)}
          style={[styles.actionsSection, { maxWidth: Math.min(width - 48, 400) }]}
        >
          <Pressable onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipBtnText}>Skip for now</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              {
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
            onPress={handleNext}
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
    marginBottom: 48,
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
  photoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  avatarTouch: {
    position: 'relative',
    width: 140,
    height: 140,
  },
  avatarImg: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  avatarPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  plusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6', // A nice blue for the plus badge like in image
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  actionsSection: {
    width: '100%',
    alignItems: 'center',
  },
  skipBtn: {
    paddingVertical: 12,
    marginBottom: 16,
  },
  skipBtnText: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: '700',
  },
  continueBtn: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    backgroundColor: PRIMARY,
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
