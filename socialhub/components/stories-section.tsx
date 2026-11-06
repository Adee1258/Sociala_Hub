import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  Pressable,
  Modal,
  Dimensions,
  Animated,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5 seconds per story slide

export interface SingleStory {
  id: string;
  mediaUrl: string;
  caption?: string;
  createdAt: string;
}

export interface UserStoryGroup {
  id: string;
  name: string;
  username: string;
  avatar: string;
  isMe?: boolean;
  stories: SingleStory[];
}

const DEFAULT_COMMUNITY_STORIES: UserStoryGroup[] = [
  {
    id: 'sara',
    name: 'Sara Khan',
    username: 'sara_k',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    stories: [
      {
        id: 'sara-1',
        mediaUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1000',
        caption: 'Morning brew & workspace setup ☕✨',
        createdAt: '2h ago',
      },
      {
        id: 'sara-2',
        mediaUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1000',
        caption: 'Weekend hiking vibes in the hills 🌲⛰️',
        createdAt: '45m ago',
      },
    ],
  },
  {
    id: 'zayn',
    name: 'Zayn Malik',
    username: 'zayn_design',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    stories: [
      {
        id: 'zayn-1',
        mediaUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1000',
        caption: 'Late night code & neon aesthetics 🚀👾',
        createdAt: '3h ago',
      },
    ],
  },
  {
    id: 'alizeh',
    name: 'Alizeh Shah',
    username: 'alizeh_art',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    stories: [
      {
        id: 'alizeh-1',
        mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1000',
        caption: 'Golden hour reflection over the lake 🌅',
        createdAt: '5h ago',
      },
    ],
  },
  {
    id: 'hamza',
    name: 'Hamza Ali',
    username: 'hamza_tech',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    stories: [
      {
        id: 'hamza-1',
        mediaUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1000',
        caption: 'Testing the new chip architecture today ⚡💻',
        createdAt: '6h ago',
      },
    ],
  },
  {
    id: 'fatima',
    name: 'Fatima Noor',
    username: 'fatima_n',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
    stories: [
      {
        id: 'fatima-1',
        mediaUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1000',
        caption: 'Minimalist desk & afternoon inspiration 🏛️📐',
        createdAt: '8h ago',
      },
    ],
  },
];

export function StoriesSection() {
  const { user } = useAuth();
  const [myStories, setMyStories] = useState<SingleStory[]>([]);
  const [viewedGroupIds, setViewedGroupIds] = useState<string[]>([]);

  // Story Viewer State
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [floatingReaction, setFloatingReaction] = useState<string | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const currentProgressVal = useRef(0);

  const myAvatarUrl =
    user?.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.firstName || 'Me')}&background=EDE9FE&color=7C3AED`;

  // ── Load user stories & viewed status from storage ──────────────────
  useEffect(() => {
    AsyncStorage.getItem('socialhub_my_stories').then((val) => {
      if (val) {
        try {
          setMyStories(JSON.parse(val));
        } catch {
          // Ignore parse errors
        }
      }
    });

    AsyncStorage.getItem('socialhub_viewed_stories').then((val) => {
      if (val) {
        try {
          setViewedGroupIds(JSON.parse(val));
        } catch {
          // Ignore
        }
      }
    });
  }, []);

  // ── Build complete story list ───────────────────────────────────────
  const allStoryGroups: UserStoryGroup[] = [
    {
      id: 'me',
      name: 'Your Story',
      username: user?.username || 'me',
      avatar: myAvatarUrl,
      isMe: true,
      stories: myStories,
    },
    ...DEFAULT_COMMUNITY_STORIES,
  ];

  // ── Pick and add new story from gallery ─────────────────────────────
  const handleAddNewStory = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newStory: SingleStory = {
          id: `my-story-${Date.now()}`,
          mediaUrl: result.assets[0].uri,
          caption: 'Shared to Story 💫',
          createdAt: 'Just now',
        };

        const updated = [newStory, ...myStories];
        setMyStories(updated);
        await AsyncStorage.setItem('socialhub_my_stories', JSON.stringify(updated));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Error', 'Could not select photo. Please check permissions.');
    }
  };

  // ── Open Story Viewer ──────────────────────────────────────────────
  const openStoryViewer = (groupIndex: number, storyIndex = 0) => {
    const group = allStoryGroups[groupIndex];
    if (group.isMe && group.stories.length === 0) {
      handleAddNewStory();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveGroupIndex(groupIndex);
    setActiveStoryIndex(storyIndex);
    setIsPaused(false);

    // Mark as viewed
    if (!viewedGroupIds.includes(group.id)) {
      const updated = [...viewedGroupIds, group.id];
      setViewedGroupIds(updated);
      AsyncStorage.setItem('socialhub_viewed_stories', JSON.stringify(updated));
    }
  };

  // ── Close Story Viewer ─────────────────────────────────────────────
  const closeStoryViewer = useCallback(() => {
    if (animRef.current) animRef.current.stop();
    setActiveGroupIndex(null);
    setActiveStoryIndex(0);
    setIsPaused(false);
    setReplyText('');
    setFloatingReaction(null);
  }, []);

  // ── Next Story Slide ───────────────────────────────────────────────
  const nextStory = useCallback(() => {
    if (activeGroupIndex === null) return;
    const currentGroup = allStoryGroups[activeGroupIndex];

    if (activeStoryIndex < currentGroup.stories.length - 1) {
      // Next story of same user
      setActiveStoryIndex((prev) => prev + 1);
    } else if (activeGroupIndex < allStoryGroups.length - 1) {
      // Find next user that has stories
      let nextIdx = activeGroupIndex + 1;
      while (nextIdx < allStoryGroups.length && allStoryGroups[nextIdx].stories.length === 0) {
        nextIdx++;
      }
      if (nextIdx < allStoryGroups.length) {
        setActiveGroupIndex(nextIdx);
        setActiveStoryIndex(0);
      } else {
        closeStoryViewer();
      }
    } else {
      closeStoryViewer();
    }
  }, [activeGroupIndex, activeStoryIndex, allStoryGroups, closeStoryViewer]);

  // ── Previous Story Slide ───────────────────────────────────────────
  const prevStory = useCallback(() => {
    if (activeGroupIndex === null) return;

    if (activeStoryIndex > 0) {
      setActiveStoryIndex((prev) => prev - 1);
    } else if (activeGroupIndex > 0) {
      let prevIdx = activeGroupIndex - 1;
      while (prevIdx >= 0 && allStoryGroups[prevIdx].stories.length === 0) {
        prevIdx--;
      }
      if (prevIdx >= 0) {
        setActiveGroupIndex(prevIdx);
        setActiveStoryIndex(Math.max(0, allStoryGroups[prevIdx].stories.length - 1));
      }
    }
  }, [activeGroupIndex, activeStoryIndex, allStoryGroups]);

  // ── Progress bar animation timer ───────────────────────────────────
  useEffect(() => {
    if (activeGroupIndex === null || isPaused) {
      if (animRef.current) animRef.current.stop();
      return;
    }

    progressAnim.setValue(0);
    currentProgressVal.current = 0;

    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });

    animRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) {
        nextStory();
      }
    });

    return () => anim.stop();
  }, [activeGroupIndex, activeStoryIndex, isPaused, nextStory, progressAnim]);

  // ── Delete current user's story ────────────────────────────────────
  const handleDeleteMyStory = async (storyId: string) => {
    Alert.alert('Delete Story', 'Are you sure you want to remove this story?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = myStories.filter((s) => s.id !== storyId);
          setMyStories(updated);
          await AsyncStorage.setItem('socialhub_my_stories', JSON.stringify(updated));
          closeStoryViewer();
        },
      },
    ]);
  };

  // ── Send quick reaction ────────────────────────────────────────────
  const handleSendReaction = (emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFloatingReaction(emoji);
    setTimeout(() => setFloatingReaction(null), 1200);
  };

  const currentGroup = activeGroupIndex !== null ? allStoryGroups[activeGroupIndex] : null;
  const currentStory = currentGroup ? currentGroup.stories[activeStoryIndex] : null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {allStoryGroups.map((group, index) => {
          const isMe = group.isMe;
          const hasStories = group.stories.length > 0;
          const isViewed = viewedGroupIds.includes(group.id);

          return (
            <Pressable
              key={group.id}
              style={styles.storyItem}
              onPress={() => openStoryViewer(index)}>
              <View style={styles.avatarWrapper}>
                {hasStories && !isViewed ? (
                  <LinearGradient
                    colors={['#8B5CF6', '#EC4899', '#F59E0B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientRing}>
                    <View style={styles.avatarInner}>
                      <Image source={{ uri: group.avatar }} style={styles.avatar} contentFit="cover" />
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={[styles.plainRing, isViewed && styles.viewedRing]}>
                    <View style={styles.avatarInner}>
                      <Image source={{ uri: group.avatar }} style={styles.avatar} contentFit="cover" />
                    </View>
                  </View>
                )}

                {/* Add Story (+) button for current user */}
                {isMe && (
                  <Pressable
                    style={styles.addBadge}
                    onPress={handleAddNewStory}
                    hitSlop={8}>
                    <Ionicons name="add" size={14} color="#FFFFFF" />
                  </Pressable>
                )}
              </View>

              <Text style={styles.name} numberOfLines={1}>
                {isMe ? 'Your Story' : group.name.split(' ')[0]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── FULL SCREEN STORY VIEWER MODAL ──────────────────────────── */}
      {currentGroup && currentStory && (
        <Modal
          visible={activeGroupIndex !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={closeStoryViewer}>
          <View style={styles.modalBackdrop}>
            {/* Story Image */}
            <Image
              source={{ uri: currentStory.mediaUrl }}
              style={styles.storyImage}
              contentFit="cover"
            />

            {/* Gradient Scrims for readability */}
            <LinearGradient
              colors={['rgba(0,0,0,0.7)', 'transparent']}
              style={styles.topScrim}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.85)']}
              style={styles.bottomScrim}
              pointerEvents="none"
            />

            {/* Tap Gestures: Left 30% / Right 70% + Long Press Pause */}
            <View style={styles.gestureOverlay}>
              <Pressable
                style={styles.leftTapZone}
                onPress={prevStory}
                onPressIn={() => setIsPaused(true)}
                onPressOut={() => setIsPaused(false)}
              />
              <Pressable
                style={styles.rightTapZone}
                onPress={nextStory}
                onPressIn={() => setIsPaused(true)}
                onPressOut={() => setIsPaused(false)}
              />
            </View>

            {/* Top Segmented Progress Bars */}
            <View style={styles.progressContainer}>
              {currentGroup.stories.map((s, idx) => {
                let barWidth: any = '0%';
                if (idx < activeStoryIndex) {
                  barWidth = '100%';
                } else if (idx === activeStoryIndex) {
                  barWidth = progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  });
                }
                return (
                  <View key={s.id} style={styles.progressTrack}>
                    <Animated.View style={[styles.progressBar, { width: barWidth }]} />
                  </View>
                );
              })}
            </View>

            {/* Header: User Info & Actions */}
            <View style={styles.modalHeader}>
              <View style={styles.headerUserRow}>
                <Image source={{ uri: currentGroup.avatar }} style={styles.headerAvatar} />
                <View>
                  <Text style={styles.headerName}>{currentGroup.name}</Text>
                  <Text style={styles.headerTime}>{currentStory.createdAt}</Text>
                </View>
              </View>

              <View style={styles.headerRightActions}>
                {currentGroup.isMe && (
                  <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() => handleDeleteMyStory(currentStory.id)}>
                    <Ionicons name="trash-outline" size={20} color="#FCA5A5" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.headerBtn} onPress={closeStoryViewer}>
                  <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Floating Reaction Animation */}
            {floatingReaction && (
              <View style={styles.floatingReactionContainer} pointerEvents="none">
                <Text style={styles.floatingEmoji}>{floatingReaction}</Text>
              </View>
            )}

            {/* Caption & Bottom Reply Bar */}
            <View style={styles.bottomArea}>
              {currentStory.caption && (
                <View style={styles.captionBox}>
                  <Text style={styles.captionText}>{currentStory.caption}</Text>
                </View>
              )}

              {/* Quick Emojis */}
              <View style={styles.quickEmojisRow}>
                {['❤️', '🔥', '👏', '😂', '😍'].map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.emojiPill}
                    onPress={() => handleSendReaction(emoji)}>
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Reply Input */}
              <View style={styles.replyRow}>
                <TextInput
                  style={styles.replyInput}
                  placeholder={`Reply to ${currentGroup.name.split(' ')[0]}...`}
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={replyText}
                  onChangeText={setReplyText}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                />
                <TouchableOpacity
                  style={[styles.sendReplyBtn, !replyText.trim() && { opacity: 0.5 }]}
                  disabled={!replyText.trim()}
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setReplyText('');
                    setIsPaused(false);
                    Alert.alert('Sent', 'Reply sent successfully!');
                  }}>
                  <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14,
  },
  storyItem: {
    alignItems: 'center',
    width: 68,
  },
  avatarWrapper: {
    position: 'relative',
    width: 68,
    height: 68,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plainRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 2.5,
    borderWidth: 2,
    borderColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewedRing: {
    borderColor: '#CBD5E1',
  },
  avatarInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  addBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7C3AED',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
    marginTop: 5,
    textAlign: 'center',
  },

  // ── Modal Styles ──────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  storyImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  gestureOverlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  leftTapZone: {
    width: '32%',
    height: '100%',
  },
  rightTapZone: {
    width: '68%',
    height: '100%',
  },

  // Progress Bars
  progressContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 24,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 5,
    zIndex: 10,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },

  // Modal Header
  modalHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 64 : 36,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  headerTime: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: '500',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    padding: 6,
  },

  // Floating Reaction
  floatingReactionContainer: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    zIndex: 20,
  },
  floatingEmoji: {
    fontSize: 72,
  },

  // Bottom Area
  bottomArea: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 18,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  captionBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    marginBottom: 12,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  quickEmojisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  emojiPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 22,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  replyInput: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 18,
    color: '#FFFFFF',
    fontSize: 14,
  },
  sendReplyBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
