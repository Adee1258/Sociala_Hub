import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  SafeAreaView,
  StatusBar,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CreatePostModal } from '@/components/CreatePostModal';
import apiService from '@/services/api';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

// ── Reel Video Item ──────────────────────────────────────────────────────
function ReelVideoItem({ url, isFocused, isMuted }: { url: string; isFocused: boolean; isMuted: boolean }) {
  const player = useVideoPlayer({ uri: url }, (p) => {
    p.loop = true;
    p.muted = isMuted;
    if (isFocused) p.play();
  });

  React.useEffect(() => {
    if (isFocused) {
      player.play();
    } else {
      player.pause();
    }
  }, [isFocused]);

  React.useEffect(() => {
    player.muted = isMuted;
  }, [isMuted]);

  return (
    <VideoView
      player={player}
      style={styles.videoPlayer}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export default function ReelsScreen() {
  const router = useRouter();
  const [reels, setReels] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showCreateReel, setShowCreateReel] = useState(false);

  // Comment sheet modal state
  const [showComments, setShowComments] = useState(false);
  const [selectedReel, setSelectedReel] = useState<any>(null);
  const [commentText, setCommentText] = useState('');
  const [commentsList, setCommentsList] = useState<any[]>([]);

  const fetchReels = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiService.getReels(1, 20);
      if (res.success && res.reels) {
        setReels(res.reels);
      }
    } catch (err) {
      console.error('Fetch reels error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReels();
  }, [fetchReels]);

  // Handle Follow / Unfollow from reel
  const handleToggleFollow = useCallback(async (userId: string, isCurrentlyFollowing: boolean) => {
    if (!userId || userId.startsWith('system-')) return; // skip sample reels
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic UI — update all reels by this user
    setReels((prev) =>
      prev.map((r) =>
        r.user?.id === userId ? { ...r, isFollowing: !isCurrentlyFollowing } : r
      )
    );

    try {
      if (isCurrentlyFollowing) {
        await apiService.unfollowUser(userId);
      } else {
        await apiService.followUser(userId);
      }
    } catch (_e) {
      // Revert on failure
      setReels((prev) =>
        prev.map((r) =>
          r.user?.id === userId ? { ...r, isFollowing: isCurrentlyFollowing } : r
        )
      );
    }
  }, []);

  // Handle Share reel
  const handleShare = useCallback(async (item: any) => {
    try {
      await Share.share({
        message: item.content
          ? `${item.user?.firstName ?? 'Someone'}: "${item.content}" — Check it out on SocialHub!`
          : 'Check out this reel on SocialHub!',
      });
    } catch (_e) {
      // user cancelled
    }
  }, []);

  // Handle Reel Like
  const handleLike = async (reelId: string, likedByMe: boolean) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Optimistic UI update
    setReels((prev) =>
      prev.map((r) =>
        r.id === reelId
          ? {
            ...r,
            likedByMe: !likedByMe,
            likesCount: likedByMe ? r.likesCount - 1 : r.likesCount + 1,
          }
          : r
      )
    );

    try {
      if (likedByMe) {
        await apiService.unlikePost(reelId);
      } else {
        await apiService.likePost(reelId);
      }
    } catch (_e) {
      // Revert if API fails
      setReels((prev) =>
        prev.map((r) => (r.id === reelId ? { ...r, likedByMe: likedByMe } : r))
      );
    }
  };

  // Open comments sheet
  const handleOpenComments = async (reel: any) => {
    setSelectedReel(reel);
    setShowComments(true);
    try {
      const res = await apiService.getComments(reel.id);
      if (res.success) {
        setCommentsList(res.comments || []);
      }
    } catch (_e) {
      setCommentsList(reel.comments || []);
    }
  };

  // Submit comment
  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedReel) return;

    const newCommentObj = {
      id: Date.now().toString(),
      text: commentText.trim(),
      user: { firstName: 'You', username: 'me' },
    };

    setCommentsList((prev) => [...prev, newCommentObj]);
    const textToSend = commentText;
    setCommentText('');

    try {
      await apiService.addComment(selectedReel.id, textToSend);
    } catch (_e) {
      console.error('Add comment error:', _e);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  // Single Reel Item Renderer
  const renderReelItem = ({ item, index }: { item: any; index: number }) => {
    const isFocused = index === currentIndex;
    const videoUrl =
      item.media && item.media.length > 0 ? item.media[0].url : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

    const authorAvatar =
      item.user?.profilePicture ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user?.firstName || 'User')}&background=EDE9FE&color=7C3AED`;

    return (
      <View style={styles.reelContainer}>
        {/* Video Player */}
        <ReelVideoItem url={videoUrl} isFocused={isFocused} isMuted={isMuted} />

        {/* Video Overlay Info */}
        <View style={styles.overlayContainer}>
          {/* Top row: mute + create reel */}
          <View style={styles.topRow}>
            <Text style={styles.reelsTitle}>Reels</Text>
            <View style={styles.topActions}>
              <TouchableOpacity
                style={styles.createReelBtn}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowCreateReel(true);
                }}>
                <IconSymbol size={22} name="plus.circle.fill" color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.muteBtn}
                onPress={() => setIsMuted(!isMuted)}>
                <IconSymbol size={22} name={isMuted ? 'speaker.slash.fill' : 'speaker.wave.2.fill'} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Left Info */}
          <View style={styles.bottomInfo}>
            <View style={styles.authorRow}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                onPress={() => {
                  const targetId = item.userId || item.user?.id || item.user?.username;
                  if (targetId) router.push(`/user/${targetId}` as any);
                }}
                activeOpacity={0.7}
              >
                <Image source={{ uri: authorAvatar }} style={styles.authorAvatar} cachePolicy="memory-disk" />
                <Text style={styles.authorName}>@{item.user?.username || 'creator'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.followBadge, item.isFollowing && styles.followingBadge]}
                onPress={() => handleToggleFollow(item.user?.id, !!item.isFollowing)}>
                <Text style={[styles.followBadgeText, item.isFollowing && styles.followingBadgeText]}>
                  {item.isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.reelCaption} numberOfLines={2}>
              {item.content}
            </Text>
          </View>

          {/* Right Action Icons Sidebar */}
          <View style={styles.rightSidebar}>
            {/* Like */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => handleLike(item.id, !!item.likedByMe)}>
              <IconSymbol
                size={32}
                name={item.likedByMe ? 'heart.fill' : 'heart'}
                color={item.likedByMe ? '#EF4444' : '#FFFFFF'}
              />
              <Text style={styles.actionText}>{item.likesCount || 0}</Text>
            </TouchableOpacity>

            {/* Comment */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => handleOpenComments(item)}>
              <IconSymbol size={30} name="bubble.right.fill" color="#FFFFFF" />
              <Text style={styles.actionText}>{item.commentsCount || 0}</Text>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => handleShare(item)}>
              <IconSymbol size={30} name="paperplane.fill" color="#FFFFFF" />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Loading SocialHub Reels...</Text>
        </View>
      ) : (
        <FlatList
          data={reels}
          renderItem={renderReelItem}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={WINDOW_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        />
      )}

      {/* Comments Sheet Modal */}
      <Modal visible={showComments} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowComments(false)} />
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Comments</Text>
                <TouchableOpacity onPress={() => setShowComments(false)}>
                  <IconSymbol size={24} name="xmark" color="#64748B" />
                </TouchableOpacity>
              </View>

              <FlatList
                data={commentsList}
                keyExtractor={(c) => c.id}
                style={{ flex: 1 }}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 8 }}
                ListEmptyComponent={
                  <View style={styles.emptyComments}>
                    <Text style={styles.emptyCommentsText}>No comments yet. Be the first! 💬</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <TouchableOpacity
                      onPress={() => {
                        setShowComments(false);
                        const targetId = item.user?.id || item.user?.username;
                        if (targetId) router.push(`/user/${targetId}` as any);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.commentUser}>@{item.user?.username || 'user'}</Text>
                    </TouchableOpacity>
                    <Text style={styles.commentBody}>{item.text}</Text>
                  </View>
                )}
              />

              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment..."
                  placeholderTextColor="#94A3B8"
                  value={commentText}
                  onChangeText={setCommentText}
                  returnKeyType="send"
                  onSubmitEditing={handleAddComment}
                />
                <TouchableOpacity style={styles.sendBtn} onPress={handleAddComment}>
                  <Text style={styles.sendBtnText}>Post</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Create Reel Modal */}
      <CreatePostModal
        visible={showCreateReel}
        onClose={() => setShowCreateReel(false)}
        onPosted={() => {
          setShowCreateReel(false);
          fetchReels();
        }}
        defaultIsReel={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 14,
  },
  reelContainer: {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    position: 'relative',
  },
  videoPlayer: {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 90,
    paddingTop: 50,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reelsTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  createReelBtn: {
    backgroundColor: 'rgba(124,58,237,0.85)',
    padding: 8,
    borderRadius: 20,
  },
  muteBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 20,
  },
  bottomInfo: {
    maxWidth: '78%',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#7C3AED',
  },
  authorName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 10,
  },
  followBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  followBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  followingBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  followingBadgeText: {
    color: '#FFFFFF',
  },
  reelCaption: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
  },
  rightSidebar: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    alignItems: 'center',
    gap: 20,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    height: WINDOW_HEIGHT * 0.6,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  commentItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  commentUser: {
    fontWeight: '700',
    color: '#7C3AED',
    fontSize: 13,
  },
  commentBody: {
    color: '#334155',
    fontSize: 14,
    marginTop: 2,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 8 : 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 40,
    fontSize: 14,
    color: '#1E293B',
  },
  sendBtn: {
    marginLeft: 10,
    paddingHorizontal: 14,
  },
  sendBtnText: {
    color: '#7C3AED',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCommentsText: {
    color: '#94A3B8',
    fontSize: 15,
  },
});
