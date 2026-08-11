import React, { useState, useCallback } from 'react';
import { Pressable, StyleSheet, View, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StoriesSection } from '@/components/stories-section';
import { FeedList } from '@/components/FeedList';
import { CreatePostModal } from '@/components/CreatePostModal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/AuthContext';

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const avatarUrl =
    user?.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user?.firstName || 'Me',
    )}&background=EDE9FE&color=7C3AED`;

  // ── Open create post modal ────────────────────────────────────────
  const openCreatePost = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCreatePost(true);
  }, []);

  // ── Post created callback ─────────────────────────────────────────
  const handlePostCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // ── Header: Stories + Create Post row ─────────────────────────────
  const header = (
    <>
      <StoriesSection />

      {/* Create Post Row */}
      <View style={styles.createRow}>
        {/* Profile avatar */}
        <Pressable
          style={styles.profileIconContainer}
          onPress={() => router.push('/(tabs)/profile')}>
          <View style={styles.profileRing}>
            <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} contentFit="cover" />
          </View>
        </Pressable>

        {/* Text input (tappable, opens modal) */}
        <Pressable style={styles.inputContainer} onPress={openCreatePost}>
          <TextInput
            style={styles.input}
            placeholder="What's on your mind?"
            placeholderTextColor="#94A3B8"
            editable={false}
            pointerEvents="none"
          />
        </Pressable>

        {/* Upload button */}
        <Pressable style={styles.uploadButton} onPress={openCreatePost}>
          <IconSymbol size={28} name="plus.circle.fill" color="#7C3AED" />
        </Pressable>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <FeedList
        headerComponent={header}
        refreshKey={refreshKey}
        onCreatePost={openCreatePost}
      />

      <CreatePostModal
        visible={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onPosted={handlePostCreated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginTop: 4,
  },
  profileIconContainer: {
    marginRight: 12,
  },
  profileRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    backgroundColor: '#7C3AED',
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
  },
  inputContainer: {
    flex: 1,
    marginRight: 12,
  },
  input: {
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1E293B',
  },
  uploadButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
