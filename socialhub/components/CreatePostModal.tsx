import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/AuthContext';
import apiService from '@/services/api';

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPosted: () => void;
  defaultIsReel?: boolean;
}

// ── Video Preview (expo-video) ───────────────────────────────────────────

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.muted = true;
  });
  return (
    <VideoView
      player={player}
      style={[styles.mediaPreview, { backgroundColor: '#0F172A' }]}
      contentFit="contain"
      nativeControls
    />
  );
}

export function CreatePostModal({ visible, onClose, onPosted, defaultIsReel = false }: CreatePostModalProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaIsVideo, setMediaIsVideo] = useState(false);
  const [isReel, setIsReel] = useState(defaultIsReel);
  const [posting, setPosting] = useState(false);

  const avatarUrl =
    user?.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user?.firstName || 'Me',
    )}&background=EDE9FE&color=7C3AED`;

  const charCount = content.length;
  const charLimit = 2000;
  const charNearLimit = charCount > charLimit * 0.85;
  const charAtLimit = charCount >= charLimit;

  // ── Pick image from gallery ───────────────────────────────────────
  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
        allowsMultipleSelection: false,
      });
      if (!result.canceled && result.assets.length > 0) {
        setMediaUri(result.assets[0].uri);
        setMediaIsVideo(false);
        await Haptics.selectionAsync();
      }
    } catch (err) {
      Alert.alert('Error', 'Could not access media library.');
    }
  }, []);

  // ── Pick video from gallery ───────────────────────────────────────
  const pickVideo = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 0.85,
        allowsMultipleSelection: false,
      });
      if (!result.canceled && result.assets.length > 0) {
        setMediaUri(result.assets[0].uri);
        setMediaIsVideo(true);
        await Haptics.selectionAsync();
      }
    } catch (err) {
      Alert.alert('Error', 'Could not access media library.');
    }
  }, []);

  // ── Pick image/video from gallery ────────────────────────────────
  const pickMedia = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.85,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setMediaUri(asset.uri);
        // Detect video by mimeType or file extension
        const isVideo =
          asset.type === 'video' ||
          (asset.mimeType?.startsWith('video/') ?? false) ||
          /\.(mp4|mov|avi|mkv|webm|3gp)$/i.test(asset.uri);
        setMediaIsVideo(isVideo);
        await Haptics.selectionAsync();
      }
    } catch (err) {
      Alert.alert('Error', 'Could not access media library.');
    }
  }, []);

  // ── Submit post ──────────────────────────────────────────────────
  const handlePost = useCallback(async () => {
    if (!content.trim() && !mediaUri) {
      Alert.alert('Empty Post', 'Write something or add a photo to post.');
      return;
    }

    // If it's a reel, it must have a video
    if (isReel && mediaUri && !mediaIsVideo) {
      Alert.alert('Reels need a video', 'Please pick a video clip to create a reel.');
      return;
    }

    setPosting(true);
    try {
      await apiService.createPost({
        content: content.trim(),
        media: mediaUri || undefined,
        isVideo: mediaIsVideo,
        isReel: mediaIsVideo ? isReel : false,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset state
      setContent('');
      setMediaUri(null);
      setMediaIsVideo(false);
      setIsReel(defaultIsReel);
      onPosted();
      onClose();
    } catch (err: any) {
      Alert.alert(
        'Post Failed',
        err?.message || 'Could not create post. Please try again.',
      );
    } finally {
      setPosting(false);
    }
  }, [content, mediaUri, mediaIsVideo, isReel, defaultIsReel, onPosted, onClose]);

  // ── Close & reset ────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (posting) return;
    setContent('');
    setMediaUri(null);
    setMediaIsVideo(false);
    setIsReel(defaultIsReel);
    onClose();
  }, [posting, defaultIsReel, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}>
          <View style={styles.sheet}>
            {/* Drag handle */}
            <View style={styles.dragHandle} />

            {/* Header */}
            <View style={styles.header}>
              <Pressable onPress={handleClose} disabled={posting} hitSlop={12} style={styles.headerIcon}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
              <Text style={styles.headerTitle}>Create Post</Text>
              <Pressable
                style={[
                  styles.postButton,
                  (!content.trim() && !mediaUri) || posting
                    ? styles.postButtonDisabled
                    : {},
                ]}
                onPress={handlePost}
                disabled={posting || (!content.trim() && !mediaUri)}>
                {posting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.postButtonText}>Post</Text>
                )}
              </Pressable>
            </View>

            {/* Body */}
            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {/* User row */}
              <View style={styles.userRow}>
                <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
                <View>
                  <Text style={styles.userName}>
                    {user?.firstName} {user?.lastName || ''}
                  </Text>
                  <Text style={styles.userSubtext}>@{user?.username}</Text>
                </View>
              </View>

              {/* Caption input */}
              <TextInput
                style={styles.captionInput}
                placeholder="What's on your mind?"
                placeholderTextColor="#94A3B8"
                value={content}
                onChangeText={setContent}
                multiline
                maxLength={charLimit}
                textAlignVertical="top"
                autoFocus
                editable={!posting}
              />

              {/* Character counter */}
              {charCount > 0 && (
                <Text style={[
                  styles.charCounter,
                  charNearLimit && styles.charCounterWarn,
                  charAtLimit && styles.charCounterLimit,
                ]}>
                  {charCount}/{charLimit}
                </Text>
              )}

              {/* Reel toggle — only show when a video is selected */}
              {mediaIsVideo && (
                <Pressable
                  style={[styles.reelToggleRow, isReel && styles.reelToggleActive]}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    setIsReel((v) => !v);
                  }}
                  disabled={posting}>
                  <Ionicons
                    name="play-circle"
                    size={18}
                    color={isReel ? '#7C3AED' : '#64748B'}
                  />
                  <Text style={[styles.reelToggleText, isReel && styles.reelToggleTextActive]}>
                    Share as Reel
                  </Text>
                  <View style={[styles.toggleSwitch, isReel && styles.toggleSwitchOn]}>
                    <View style={[styles.toggleKnob, isReel && styles.toggleKnobOn]} />
                  </View>
                </Pressable>
              )}

              {/* Media preview */}
              {mediaUri && (
                <View style={styles.mediaPreviewWrap}>
                  {mediaIsVideo ? (
                    Platform.OS === 'web' ? (
                      // Web: use native <video> element via dangerouslySetInnerHTML equivalent
                      <View style={styles.mediaPreview}>
                        {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                        {/* @ts-ignore – web-only video element */}
                        <video
                          src={mediaUri}
                          style={{ width: '100%', height: 260, borderRadius: 16, objectFit: 'contain', backgroundColor: '#0F172A' }}
                          controls
                          muted
                        />
                      </View>
                    ) : (
                      <VideoPreview uri={mediaUri} />
                    )
                  ) : (
                    <Image source={{ uri: mediaUri }} style={styles.mediaPreview} contentFit="cover" />
                  )}
                  <Pressable
                    style={styles.removeMedia}
                    onPress={() => { setMediaUri(null); setMediaIsVideo(false); }}
                    disabled={posting}>
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}
            </ScrollView>

            {/* Bottom toolbar */}
            <View style={styles.toolbar}>
              <Pressable
                style={styles.toolbarBtn}
                onPress={pickImage}
                disabled={posting}>
                <Ionicons name="image-outline" size={24} color="#7C3AED" />
                <Text style={styles.toolbarBtnText}>Photo</Text>
              </Pressable>
              <Pressable
                style={styles.toolbarBtn}
                onPress={pickVideo}
                disabled={posting}>
                <Ionicons name="videocam-outline" size={24} color="#7C3AED" />
                <Text style={styles.toolbarBtnText}>Video</Text>
              </Pressable>
              <Pressable
                style={styles.toolbarBtn}
                onPress={pickMedia}
                disabled={posting}>
                <Ionicons name="albums-outline" size={24} color="#7C3AED" />
                <Text style={styles.toolbarBtnText}>Gallery</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    minHeight: '60%',
    paddingTop: 8,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  postButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#C4B5FD',
    opacity: 0.6,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  bodyScroll: {
    flex: 1,
  },
  body: {
    padding: 16,
    paddingBottom: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  userSubtext: {
    fontSize: 13,
    color: '#94A3B8',
  },
  captionInput: {
    fontSize: 16,
    color: '#1E293B',
    minHeight: 100,
    padding: 0,
    lineHeight: 24,
    marginBottom: 4,
  },
  charCounter: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'right',
    marginBottom: 12,
  },
  charCounterWarn: {
    color: '#F59E0B',
  },
  charCounterLimit: {
    color: '#EF4444',
    fontWeight: '700',
  },
  mediaPreviewWrap: {
    position: 'relative',
    marginBottom: 16,
  },
  mediaPreview: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  removeMedia: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  reelToggleActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#C4B5FD',
  },
  reelToggleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  reelToggleTextActive: {
    color: '#7C3AED',
  },
  toggleSwitch: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#CBD5E1',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchOn: {
    backgroundColor: '#7C3AED',
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  // ── Bottom toolbar ──────────────────────────────────────────────
  toolbar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#FFFFFF',
  },
  toolbarBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 12,
  },
  toolbarBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C3AED',
  },
});
