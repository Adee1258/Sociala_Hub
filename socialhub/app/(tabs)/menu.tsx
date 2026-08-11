import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import apiService from '@/services/api';
import * as Haptics from 'expo-haptics';

export default function MenuScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // AI Coach Modal State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const avatarUrl =
    user?.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user?.firstName || 'Me'
    )}&background=EDE9FE&color=7C3AED`;

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out of SocialHub?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
        },
      },
    ]);
  };

  const handleAskAICoach = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResponse('');
    try {
      const res = await apiService.askAICoach(aiPrompt);
      if (res.success || res.advice) {
        setAiResponse(res.advice || res.reply || 'Here is your profile recommendation!');
      } else {
        setAiResponse('🤖 Keep posting reels daily to maximize engagement!');
      }
    } catch (_e) {
      setAiResponse('🤖 Profile Tip: Add a catchy bio and post 2 reels this week to boost reach!');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Header */}
        <Text style={styles.headerTitle}>Menu & Settings</Text>

        {/* Profile Card */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => router.push('/(tabs)/profile')}>
          <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>
                {user?.firstName || 'User'} {user?.lastName || ''}
              </Text>
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>Lvl {user?.level || 1}</Text>
              </View>
            </View>
            <Text style={styles.profileHandle}>@{user?.username || 'username'}</Text>
            <Text style={styles.viewProfileLink}>View & edit profile →</Text>
          </View>
        </TouchableOpacity>

        {/* AI Profile Coach Shortcut Banner */}
        <TouchableOpacity
          style={styles.aiBanner}
          onPress={() => setShowAiModal(true)}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 18 }}>🤖</Text>
              <Text style={styles.aiTitle}>AI Profile Coach</Text>
            </View>
            <Text style={styles.aiSub}>Get instant tips to grow your audience & engagement</Text>
          </View>
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>Ask AI</Text>
          </View>
        </TouchableOpacity>

        {/* Account Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity
            style={styles.rowItem}
            onPress={() => router.push('/edit-profile')}>
            <View style={[styles.rowIcon, { backgroundColor: '#EDE9FE' }]}>
              <IconSymbol size={20} name="person.fill" color="#7C3AED" />
            </View>
            <Text style={styles.rowLabel}>Edit Profile Information</Text>
            <IconSymbol size={16} name="chevron.right" color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rowItem}
            onPress={() => router.push('/verify-email')}>
            <View style={[styles.rowIcon, { backgroundColor: '#D1FAE5' }]}>
              <IconSymbol size={20} name="envelope.fill" color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Email Verification</Text>
              <Text style={styles.rowSub}>
                {user?.emailVerified ? 'Verified ✓' : 'Unverified - Tap to verify'}
              </Text>
            </View>
            <IconSymbol size={16} name="chevron.right" color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.rowItem} onPress={() => router.push('/(auth)/forgot-password')}>
            <View style={[styles.rowIcon, { backgroundColor: '#FEF3C7' }]}>
              <IconSymbol size={20} name="lock.fill" color="#D97706" />
            </View>
            <Text style={styles.rowLabel}>Security & Password</Text>
            <IconSymbol size={16} name="chevron.right" color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* App Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          <View style={styles.rowItem}>
            <View style={[styles.rowIcon, { backgroundColor: '#E0F2FE' }]}>
              <IconSymbol size={20} name="bell.fill" color="#0284C7" />
            </View>
            <Text style={[styles.rowLabel, { flex: 1 }]}>Push Notifications</Text>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: '#CBD5E1', true: '#C4B5FD' }}
              thumbColor={pushEnabled ? '#7C3AED' : '#F1F5F9'}
            />
          </View>

          <View style={styles.rowItem}>
            <View style={[styles.rowIcon, { backgroundColor: '#F3E8FF' }]}>
              <IconSymbol size={20} name="moon.fill" color="#9333EA" />
            </View>
            <Text style={[styles.rowLabel, { flex: 1 }]}>Dark Mode</Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#CBD5E1', true: '#C4B5FD' }}
              thumbColor={darkMode ? '#7C3AED' : '#F1F5F9'}
            />
          </View>
        </View>

        {/* Support & Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & About</Text>

          <TouchableOpacity style={styles.rowItem} onPress={() => router.push('/(auth)/terms')}>
            <View style={[styles.rowIcon, { backgroundColor: '#F1F5F9' }]}>
              <IconSymbol size={20} name="doc.text.fill" color="#64748B" />
            </View>
            <Text style={styles.rowLabel}>Terms & Privacy Policy</Text>
            <IconSymbol size={16} name="chevron.right" color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.rowItem}>
            <View style={[styles.rowIcon, { backgroundColor: '#F1F5F9' }]}>
              <IconSymbol size={20} name="info.circle.fill" color="#64748B" />
            </View>
            <Text style={[styles.rowLabel, { flex: 1 }]}>SocialHub Version</Text>
            <Text style={styles.versionText}>v1.0.0 Pro</Text>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <IconSymbol size={20} name="arrow.right.square.fill" color="#EF4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* AI Coach Modal */}
      <Modal visible={showAiModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🤖 AI Profile Coach</Text>
              <TouchableOpacity onPress={() => setShowAiModal(false)}>
                <IconSymbol size={22} name="xmark" color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Ask for post ideas, hashtag advice, or how to reach 1,000 followers!
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. How can I get more post likes?"
              placeholderTextColor="#94A3B8"
              value={aiPrompt}
              onChangeText={setAiPrompt}
              multiline
            />

            <TouchableOpacity style={styles.askBtn} onPress={handleAskAICoach} disabled={aiLoading}>
              {aiLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.askBtnText}>Ask Coach</Text>
              )}
            </TouchableOpacity>

            {aiResponse ? (
              <View style={styles.responseBox}>
                <Text style={styles.responseText}>{aiResponse}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EDE9FE',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  levelBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  profileHandle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  viewProfileLink: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '600',
    marginTop: 6,
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6D28D9',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  aiSub: {
    fontSize: 12,
    color: '#DDD6FE',
    marginTop: 4,
  },
  aiBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  aiBadgeText: {
    color: '#6D28D9',
    fontWeight: '800',
    fontSize: 12,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  rowSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  versionText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 14,
    borderRadius: 18,
    marginTop: 8,
    gap: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    marginVertical: 10,
  },
  modalInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: '#1E293B',
    height: 70,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  askBtn: {
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  askBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  responseBox: {
    backgroundColor: '#F5F3FF',
    padding: 14,
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  responseText: {
    color: '#5B21B6',
    fontSize: 14,
    lineHeight: 20,
  },
});
