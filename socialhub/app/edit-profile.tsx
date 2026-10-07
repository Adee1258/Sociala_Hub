import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Text, TextInput, Avatar, IconButton, MD3LightTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import apiService from '@/services/api';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';

const PRIMARY = '#7C3AED';

const INPUT_THEME = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    onSurface: '#1E293B',
    onSurfaceVariant: '#94A3B8',
  },
};

export default function EditProfileScreen() {
  const { user, updateUser, checkAuth } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [profileImage, setProfileImage] = useState<string | null>(user?.profilePicture || null);
  const [profileCover, setProfileCover] = useState<string | null>(user?.profileCover || null);
  const [website, setWebsite] = useState(user?.website || '');
  const [address, setAddress] = useState(user?.address || '');
  const [dobDay, setDobDay] = useState(user?.dateOfBirth?.day || '');
  const [dobMonth, setDobMonth] = useState(user?.dateOfBirth?.month || '');
  const [dobYear, setDobYear] = useState(user?.dateOfBirth?.year || '');
  const [isLoading, setIsLoading] = useState(false);

  const initials = `${firstName?.charAt(0) || 'U'}${lastName?.charAt(0) || ''}`.toUpperCase();

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: false,
    });
    if (!result.canceled) setProfileImage(result.assets[0].uri);
  };

  const pickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
      base64: false,
    });
    if (!result.canceled) setProfileCover(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert('Required', 'Username cannot be empty');
      return;
    }
    if (!firstName.trim()) {
      Alert.alert('Required', 'First name cannot be empty');
      return;
    }
    try {
      setIsLoading(true);
      const payload: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.toLowerCase().trim(),
        bio: bio.trim(),
        website: website.trim(),
        address: address.trim(),
        day: dobDay.trim(),
        month: dobMonth.trim(),
        year: dobYear.trim(),
      };
      if (profileImage && !profileImage.startsWith('http')) payload.profilePicture = profileImage;
      if (profileCover && !profileCover.startsWith('http')) payload.profileCover = profileCover;

      const response = await apiService.updateProfile(payload);
      if (response.success) {
        updateUser(response.user);
        Alert.alert('Saved!', 'Profile updated successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        throw new Error(response.message || 'Failed to update');
      }
    } catch (error: any) {
      Alert.alert('Update Failed', error.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const daysRemaining = (() => {
    if (!user?.lastUsernameChange) return null;
    const days = (Date.now() - new Date(user.lastUsernameChange).getTime()) / (1000 * 3600 * 24);
    return days < 120 ? Math.ceil(120 - days) : null;
  })();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Custom Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <FontAwesome name="chevron-left" size={16} color="#1E293B" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Edit Profile</Text>

        <TouchableOpacity
          onPress={handleSave}
          disabled={isLoading}
          style={[styles.saveBtn, isLoading && { opacity: 0.6 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {isLoading ? (
            <ActivityIndicator size={16} color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Cover Photo ── */}
        <TouchableOpacity onPress={pickCover} activeOpacity={0.85}>
          <View style={styles.coverContainer}>
            {profileCover ? (
              <Image source={{ uri: profileCover }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <MaterialCommunityIcons name="image-plus" size={28} color="rgba(255,255,255,0.7)" />
                <Text style={styles.coverPlaceholderText}>Add Cover Photo</Text>
              </View>
            )}
            <View style={styles.coverCameraBtn}>
              <MaterialCommunityIcons name="camera" size={16} color="#FFF" />
            </View>
          </View>
        </TouchableOpacity>

        {/* ── Avatar ── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={styles.avatarTouch}>
            {profileImage ? (
              <Avatar.Image size={90} source={{ uri: profileImage }} />
            ) : (
              <Avatar.Text size={90} label={initials} style={{ backgroundColor: PRIMARY }} />
            )}
            <View style={styles.avatarCameraBtn}>
              <MaterialCommunityIcons name="camera" size={14} color="#FFF" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickImage}>
            <Text style={styles.changePhotoText}>Change profile photo</Text>
          </TouchableOpacity>
        </View>

        {/* ── Form ── */}
        <View style={styles.formCard}>

          {/* Name Row */}
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <TextInput
                label="First Name"
                value={firstName}
                onChangeText={setFirstName}
                mode="outlined"
                style={styles.input}
                textColor="#1E293B"
                outlineColor="#E2E8F0"
                activeOutlineColor={PRIMARY}
                outlineStyle={{ borderRadius: 12 }}
                theme={INPUT_THEME}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                label="Last Name"
                value={lastName}
                onChangeText={setLastName}
                mode="outlined"
                style={styles.input}
                textColor="#1E293B"
                outlineColor="#E2E8F0"
                activeOutlineColor={PRIMARY}
                outlineStyle={{ borderRadius: 12 }}
                theme={INPUT_THEME}
              />
            </View>
          </View>

          {/* Username */}
          <TextInput
            label="Username"
            value={username}
            onChangeText={setUsername}
            mode="outlined"
            style={[styles.input, styles.inputFull]}
            textColor="#1E293B"
            outlineColor="#E2E8F0"
            activeOutlineColor={PRIMARY}
            outlineStyle={{ borderRadius: 12 }}
            left={<TextInput.Icon icon="at" color="#94A3B8" />}
            autoCapitalize="none"
            disabled={daysRemaining !== null}
            theme={INPUT_THEME}
          />
          {daysRemaining !== null && (
            <Text style={styles.helperText}>
              Username change available in <Text style={{ color: PRIMARY, fontWeight: '700' }}>{daysRemaining}</Text> days
            </Text>
          )}

          {/* Bio */}
          <TextInput
            label="Bio"
            value={bio}
            onChangeText={setBio}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={[styles.input, styles.inputFull, { height: 90 }]}
            textColor="#1E293B"
            outlineColor="#E2E8F0"
            activeOutlineColor={PRIMARY}
            outlineStyle={{ borderRadius: 12 }}
            placeholder="Write something about yourself..."
            maxLength={160}
            theme={INPUT_THEME}
          />
          <Text style={styles.charCount}>{bio.length}/160</Text>

          {/* Website */}
          <TextInput
            label="Website"
            value={website}
            onChangeText={setWebsite}
            mode="outlined"
            style={[styles.input, styles.inputFull]}
            textColor="#1E293B"
            outlineColor="#E2E8F0"
            activeOutlineColor={PRIMARY}
            outlineStyle={{ borderRadius: 12 }}
            left={<TextInput.Icon icon="link" color="#94A3B8" />}
            placeholder="https://yourwebsite.com"
            autoCapitalize="none"
            keyboardType="url"
            theme={INPUT_THEME}
          />

          {/* Location */}
          <TextInput
            label="Location"
            value={address}
            onChangeText={setAddress}
            mode="outlined"
            style={[styles.input, styles.inputFull]}
            textColor="#1E293B"
            outlineColor="#E2E8F0"
            activeOutlineColor={PRIMARY}
            outlineStyle={{ borderRadius: 12 }}
            left={<TextInput.Icon icon="map-marker-outline" color="#94A3B8" />}
            placeholder="City, Country"
            theme={INPUT_THEME}
          />

          {/* Date of Birth */}
          <Text style={styles.sectionLabel}>Date of Birth</Text>
          <View style={styles.dobRow}>
            <TextInput
              label="Day"
              value={dobDay}
              onChangeText={setDobDay}
              mode="outlined"
              style={[styles.input, { flex: 1 }]}
              textColor="#1E293B"
              outlineColor="#E2E8F0"
              activeOutlineColor={PRIMARY}
              outlineStyle={{ borderRadius: 12 }}
              keyboardType="numeric"
              placeholder="DD"
              maxLength={2}
              theme={INPUT_THEME}
            />
            <TextInput
              label="Month"
              value={dobMonth}
              onChangeText={setDobMonth}
              mode="outlined"
              style={[styles.input, { flex: 2 }]}
              textColor="#1E293B"
              outlineColor="#E2E8F0"
              activeOutlineColor={PRIMARY}
              outlineStyle={{ borderRadius: 12 }}
              placeholder="e.g. January"
              theme={INPUT_THEME}
            />
            <TextInput
              label="Year"
              value={dobYear}
              onChangeText={setDobYear}
              mode="outlined"
              style={[styles.input, { flex: 1.2 }]}
              textColor="#1E293B"
              outlineColor="#E2E8F0"
              activeOutlineColor={PRIMARY}
              outlineStyle={{ borderRadius: 12 }}
              keyboardType="numeric"
              placeholder="YYYY"
              maxLength={4}
              theme={INPUT_THEME}
            />
          </View>
        </View>

        {/* Bottom padding */}
        <View style={{ height: 20 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
  },
  saveBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },

  scrollContent: {
    paddingBottom: 40,
  },

  // Cover
  coverContainer: {
    height: 140,
    backgroundColor: PRIMARY,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
  },
  coverPlaceholderText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  coverCameraBtn: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarTouch: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarCameraBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  changePhotoText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '700',
  },

  // Form
  formCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  inputFull: {
    width: '100%',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    marginTop: 4,
  },
  dobRow: {
    flexDirection: 'row',
    gap: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: -8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: -8,
    marginBottom: 12,
  },

  // Bottom save
  bottomSaveBtn: {
    backgroundColor: PRIMARY,
    marginHorizontal: 16,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  bottomSaveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
