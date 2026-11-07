import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Share,
  Alert,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TextInput,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/AuthContext';
import apiService from '@/services/api';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Full-screen Image Viewer ─────────────────────────────────────────────

function ImageViewer({ uri, visible, onClose }: { uri: string; visible: boolean; onClose: () => void }) {
  const ivOverlay: import('react-native').ViewStyle = {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  };
  const ivImg: import('react-native').ImageStyle = {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.85,
  };
  const ivClose: import('react-native').ViewStyle = {
    position: 'absolute',
    top: 52,
    right: 16,
  };
  const ivCircle: import('react-native').ViewStyle = {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden />
      <Pressable style={ivOverlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Image
            source={{ uri }}
            style={ivImg}
            contentFit="contain"
          />
        </Pressable>
        <Pressable style={ivClose} onPress={onClose} hitSlop={12}>
          <View style={ivCircle}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Types ────────────────────────────────────────────────────────────────

export interface PostUser {
  id: string;
  username: string;
  firstName: string;
  lastName?: string;
  profilePicture?: string;
}

export interface PostMedia {
  id: string;
  url: string;
  type: 'image' | 'video';
}

export interface PostComment {
  id: string;
  text: string;
  createdAt: string;
  user: PostUser;
}

export interface PostData {
  id: string;
  content: string;
  isReel: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  user: PostUser;
  media: PostMedia[];
  likesCount: number;
  likedByMe: boolean;
  commentsCount: number;
  comments: PostComment[];
}

interface PostCardProps {
  post: PostData;
  onPostUpdate?: (updatedPost: PostData) => void;
  onPostDelete?: (postId: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
}

function formatCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(1).replace('.0', '')}K`;
  return `${(count / 1_000_000).toFixed(1).replace('.0', '')}M`;
}

// ── Like Button with animated heart ─────────────────────────────────────

function LikeButton({
  liked,
  count,
  onPress,
}: {
  liked: boolean;
  count: number;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    // Bounce animation
    scale.value = withSequence(
      withSpring(1.35, { damping: 6, stiffness: 300 }),
      withDelay(50, withSpring(1, { damping: 8, stiffness: 300 })),
    );
    onPress();
  };

  return (
    <Pressable style={styles.actionButton} onPress={handlePress} hitSlop={8}>
      <Animated.View style={animatedStyle}>
        <IconSymbol
          size={26}
          name={liked ? 'heart.fill' : 'heart'}
          color={liked ? '#EF4444' : '#1E293B'}
        />
      </Animated.View>
      {count > 0 && (
        <Text style={[styles.actionText, { color: liked ? '#EF4444' : '#1E293B' }]}>
          {formatCount(count)}
        </Text>
      )}
    </Pressable>
  );
}

// ── Comment Item ─────────────────────────────────────────────────────────

function CommentItem({ comment, onUserPress }: { comment: PostComment; onUserPress?: (id?: string, username?: string) => void }) {
  return (
    <View style={styles.commentItem}>
      <Pressable onPress={() => onUserPress?.(comment.user?.id, comment.user?.username)}>
        <Image
          source={{
            uri:
              comment.user?.profilePicture ||
              'https://ui-avatars.com/api/?name=' + encodeURIComponent(comment.user?.firstName || 'User'),
          }}
          style={styles.commentAvatar}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      </Pressable>
      <View style={styles.commentBody}>
        <Pressable onPress={() => onUserPress?.(comment.user?.id, comment.user?.username)}>
          <Text style={styles.commentAuthor}>
            {comment.user?.firstName}{' '}
            {comment.user?.lastName ? comment.user.lastName : ''}
            <Text style={styles.commentUsername}> @{comment.user?.username}</Text>
          </Text>
        </Pressable>
        <Text style={styles.commentText}>{comment.text}</Text>
      </View>
      <Text style={styles.commentTime}>{timeAgo(comment.createdAt)}</Text>
    </View>
  );
}

// ── Native Video Item (expo-video) ──────────────────────────────────────

function NativeVideoItem({ url }: { url: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const player = useVideoPlayer({ uri: url }, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    const sub = player.addListener('playingChange', (event) => {
      setIsPlaying(event.isPlaying);
    });
    return () => sub.remove();
  }, [player]);

  const togglePlay = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const toggleMute = () => {
    player.muted = !player.muted;
    setIsMuted(player.muted);
  };

  return (
    <Pressable style={styles.videoCardContainer} onPress={togglePlay}>
      <VideoView
        player={player}
        style={styles.videoPlayerView}
        contentFit="cover"
        nativeControls={false}
      />
      {/* Video Badge */}
      <View style={styles.videoBadge}>
        <Ionicons name="videocam" size={13} color="#FFFFFF" />
        <Text style={styles.videoBadgeText}>Video</Text>
      </View>

      {/* Center Play/Pause indicator when paused */}
      {!isPlaying && (
        <View style={styles.playPauseOverlay} pointerEvents="none">
          <View style={styles.playIconCircle}>
            <Ionicons name="play" size={28} color="#FFFFFF" style={{ marginLeft: 3 }} />
          </View>
        </View>
      )}

      {/* Mute/Unmute corner toggle */}
      <Pressable style={styles.muteButton} onPress={toggleMute} hitSlop={10}>
        <Ionicons
          name={isMuted ? 'volume-mute' : 'volume-high'}
          size={16}
          color="#FFFFFF"
        />
      </Pressable>
    </Pressable>
  );
}

// ── Main PostCard ────────────────────────────────────────────────────────

export function PostCard({ post, onPostUpdate, onPostDelete }: PostCardProps) {
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const navigateToUserProfile = useCallback((targetUserId?: string, targetUsername?: string) => {
    const identifier = targetUserId || targetUsername;
    if (!identifier) return;
    setShowCommentsModal(false);
    router.push(`/user/${identifier}` as any);
  }, [router]);

  const [liked, setLiked] = useState(post.likedByMe);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [saved, setSaved] = useState((post as any).savedByMe ?? false);
  const [comments, setComments] = useState<PostComment[]>(post.comments || []);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [commentText, setCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [allComments, setAllComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [modalCommentText, setModalCommentText] = useState('');
  const [postingModalComment, setPostingModalComment] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const heartAnim = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  // ── Like handler ────────────────────────────────────────────────────
  const handleLike = useCallback(async () => {
    const wasLiked = liked;
    // Optimistic update
    setLiked(!wasLiked);
    setLikesCount((c) => c + (wasLiked ? -1 : 1));

    try {
      if (wasLiked) {
        await apiService.unlikePost(post.id);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await apiService.likePost(post.id);
      }
      // Notify parent
      onPostUpdate?.({
        ...post,
        likedByMe: !wasLiked,
        likesCount: wasLiked ? likesCount - 1 : likesCount + 1,
      });
    } catch (err) {
      // Revert on failure
      setLiked(wasLiked);
      setLikesCount((c) => c + (wasLiked ? 1 : -1));
      Alert.alert('Error', 'Could not update like. Please try again.');
    }
  }, [liked, likesCount, post, onPostUpdate]);

  // ── Double-tap to like ───────────────────────────────────────────────
  const lastTapRef = useRef(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      if (!liked) {
        handleLike();
      }
      // heart burst animation
      heartAnim.value = 0;
      heartOpacity.value = 1;
      heartAnim.value = withSequence(
        withSpring(1.4, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 10 }),
      );
      heartOpacity.value = withDelay(600, withTiming(0, { duration: 300 }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    lastTapRef.current = now;
  }, [liked, handleLike]);

  const heartAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartAnim.value }],
    opacity: heartOpacity.value,
  }));

  // ── Quick comment (inline) ─────────────────────────────────────────
  const handleQuickComment = useCallback(async () => {
    const text = commentText.trim();
    if (!text) return;

    setCommenting(true);
    try {
      const res = await apiService.addComment(post.id, text);
      const newComment: PostComment = res.comment;
      setComments((prev) => [...prev, newComment]);
      setCommentsCount((c) => c + 1);
      setCommentText('');
      Keyboard.dismiss();
    } catch (err) {
      Alert.alert('Error', 'Could not post comment. Please try again.');
    } finally {
      setCommenting(false);
    }
  }, [commentText, post.id]);

  // ── Open comments modal ────────────────────────────────────────────
  const openComments = useCallback(async () => {
    setShowCommentsModal(true);
    setLoadingComments(true);
    try {
      const res = await apiService.getComments(post.id);
      setAllComments(res.comments || []);
    } catch (err) {
      setAllComments(comments);
    } finally {
      setLoadingComments(false);
    }
  }, [post.id, comments]);

  // ── Post comment from modal ────────────────────────────────────────
  const handleModalComment = useCallback(async () => {
    const text = modalCommentText.trim();
    if (!text) return;

    setPostingModalComment(true);
    try {
      const res = await apiService.addComment(post.id, text);
      const newComment: PostComment = res.comment;
      setAllComments((prev) => [...prev, newComment]);
      setComments((prev) => [...prev, newComment]);
      setCommentsCount((c) => c + 1);
      setModalCommentText('');
    } catch (err) {
      Alert.alert('Error', 'Could not post comment.');
    } finally {
      setPostingModalComment(false);
    }
  }, [modalCommentText, post.id]);

  // ── Share handler ──────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: post.content
          ? `${post.user.firstName}: "${post.content}"`
          : 'Check out this post on SocialHub!',
      });
    } catch (_err) {
      // User cancelled or share failed
    }
  }, [post]);

  // ── More options ───────────────────────────────────────────────────
  const handleMore = useCallback(() => {
    const isOwnPost = currentUser?.id === post.userId;
    Alert.alert('Post Options', undefined, [
      {
        text: isOwnPost ? 'Delete Post' : 'Report Post',
        style: isOwnPost ? 'destructive' : 'default',
        onPress: () => {
          if (isOwnPost) {
            Alert.alert(
              'Delete Post',
              'Are you sure you want to delete this post?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await apiService.deletePost(post.id);
                      onPostDelete?.(post.id);
                    } catch (err: any) {
                      Alert.alert('Error', err?.message || 'Could not delete post. Please try again.');
                    }
                  },
                },
              ],
            );
          } else {
            Alert.alert(
              'Report Post',
              'Why are you reporting this post?',
              [
                {
                  text: 'Inappropriate Content',
                  onPress: async () => {
                    try {
                      await apiService.reportPost(post.id, 'inappropriate');
                      Alert.alert('Reported', 'Thanks! This post has been flagged for review.');
                    } catch (_e) {
                      Alert.alert('Thanks!', 'This post has been reported for review.');
                    }
                  },
                },
                {
                  text: 'Spam',
                  onPress: async () => {
                    try {
                      await apiService.reportPost(post.id, 'spam');
                      Alert.alert('Reported', 'Thanks! This post has been flagged for review.');
                    } catch (_e) {
                      Alert.alert('Thanks!', 'This post has been reported for review.');
                    }
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ],
            );
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [currentUser?.id, post.userId, post.id, onPostDelete]);

  // ── Save / Bookmark handler ────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const wasSaved = saved;
    setSaved(!wasSaved);
    await Haptics.selectionAsync();
    try {
      await apiService.savePost(post.id);
    } catch (_err) {
      setSaved(wasSaved); // revert
    }
  }, [saved, post.id]);

  // ── Render media ───────────────────────────────────────────────────
  const renderMedia = () => {
    if (!post.media || post.media.length === 0) return null;

    const renderMediaItem = (m: PostMedia) => {
      // Treat as video if type is 'video' OR url looks like a video file / Cloudinary video URL
      const isVideoType =
        m.type === 'video' ||
        /\.(mp4|mov|avi|mkv|webm|3gp|m4v)(\?|$)/i.test(m.url) ||
        /\/video\/upload\//i.test(m.url); // Cloudinary video URL pattern

      if (isVideoType) {
        // Web browser: use native HTML video element
        if (Platform.OS === 'web') {
          return (
            <View style={styles.videoCardContainer}>
              {/* @ts-ignore – web-only */}
              <video
                src={m.url}
                style={{
                  width: '100%',
                  aspectRatio: '4 / 5',
                  maxHeight: 480,
                  objectFit: 'cover',
                  backgroundColor: '#0F172A',
                  display: 'block',
                }}
                controls
                preload="metadata"
                playsInline
              />
            </View>
          );
        }
        return <NativeVideoItem url={m.url} />;
      }
      return (
        <Pressable style={styles.mediaContainer} onPress={handleDoubleTap}>
          <Image
            source={{ uri: m.url }}
            style={styles.singleMedia}
            contentFit="cover"
            transition={200}
          />
          {/* Heart burst on double-tap */}
          <Animated.View style={[styles.heartOverlay, heartAnimStyle]} pointerEvents="none">
            <Text style={styles.heartEmoji}>❤️</Text>
          </Animated.View>
        </Pressable>
      );
    };

    if (post.media.length === 1) {
      return renderMediaItem(post.media[0]);
    }

    // Multiple media — horizontal scroll
    return (
      <FlatList
        data={post.media}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderMediaItem(item)}
      />
    );
  };

  const avatarUrl =
    post.user?.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      post.user?.firstName || 'User',
    )}&background=EDE9FE&color=7C3AED`;

  return (
    <>
      <View style={styles.card}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerLeft}
          onPress={() => navigateToUserProfile(post.userId || post.user?.id, post.user?.username)}
          hitSlop={8}
        >
          <View style={styles.avatarRing}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" />
          </View>
          <View>
            <Text style={styles.displayName}>
              {post.user?.firstName} {post.user?.lastName || ''}
            </Text>
            <Text style={styles.metaText}>
              @{post.user?.username} · {timeAgo(post.createdAt)}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={handleMore} hitSlop={12}>
          <IconSymbol size={22} name="ellipsis" color="#64748B" />
        </Pressable>
      </View>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {post.content ? <Text style={styles.content}>{post.content}</Text> : null}

      {/* ── Media ───────────────────────────────────────────────────── */}
      {renderMedia()}

      {/* ── Action Bar ──────────────────────────────────────────────── */}
      <View style={styles.actionBar}>
        <View style={styles.actionsLeft}>
          <LikeButton liked={liked} count={likesCount} onPress={handleLike} />

          <Pressable
            style={styles.actionButton}
            hitSlop={8}
            onPress={openComments}>
            <IconSymbol size={26} name="bubble.left" color="#1E293B" />
            {commentsCount > 0 && (
              <Text style={styles.actionText}>{formatCount(commentsCount)}</Text>
            )}
          </Pressable>

          <Pressable style={styles.actionButton} hitSlop={8} onPress={handleShare}>
            <IconSymbol size={24} name="square.and.arrow.up" color="#1E293B" />
          </Pressable>
        </View>

        <Pressable
          style={styles.actionButton}
          hitSlop={8}
          onPress={handleSave}>
          <IconSymbol size={24} name={saved ? 'bookmark.fill' : 'bookmark'} color={saved ? '#7C3AED' : '#1E293B'} />
        </Pressable>
      </View>

      {/* ── Likes Summary ───────────────────────────────────────────── */}
      {likesCount > 0 && (
        <Text style={styles.likesSummary}>
          {formatCount(likesCount)} {likesCount === 1 ? 'like' : 'likes'}
        </Text>
      )}

      {/* ── Comment Preview ─────────────────────────────────────────── */}
      {commentsCount > 0 && (
        <Pressable onPress={openComments} style={styles.viewComments}>
          <Text style={styles.viewCommentsText}>
            View all {commentsCount} comments
          </Text>
        </Pressable>
      )}

      {/* Inline quick comments (last 2) */}
      {comments.slice(-2).map((c) => (
        <CommentItem key={c.id} comment={c} onUserPress={navigateToUserProfile} />
      ))}

      {/* ── Quick Comment Input ─────────────────────────────────────── */}
      <View style={styles.quickCommentRow}>
        <Image
          source={{
            uri:
              currentUser?.profilePicture ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                currentUser?.firstName || 'Me',
              )}&background=EDE9FE&color=7C3AED`,
          }}
          style={styles.commentInputAvatar}
          contentFit="cover"
        />
        <View style={styles.commentInputWrap}>
          <TextInput
            style={styles.commentInput}
            placeholder="Write a comment..."
            placeholderTextColor="#94A3B8"
            value={commentText}
            onChangeText={setCommentText}
            editable={!commenting}
          />
        </View>
        {commentText.trim().length > 0 && (
          <Pressable
            style={styles.sendButton}
            onPress={handleQuickComment}
            disabled={commenting}>
            <IconSymbol size={22} name="paperplane.fill" color="#7C3AED" />
          </Pressable>
        )}
      </View>

      {/* ── Comments Modal ──────────────────────────────────────────── */}
      <Modal
        visible={showCommentsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCommentsModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <Pressable
                onPress={() => setShowCommentsModal(false)}
                hitSlop={12}>
                <IconSymbol size={24} name="xmark" color="#64748B" />
              </Pressable>
            </View>

            {/* Comments List */}
            <FlatList
              data={loadingComments ? [] : allComments}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <CommentItem comment={item} onUserPress={navigateToUserProfile} />}
              contentContainerStyle={styles.commentsList}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              ListEmptyComponent={
                loadingComments ? (
                  <Text style={styles.emptyCommentText}>Loading comments...</Text>
                ) : (
                  <Text style={styles.emptyCommentText}>
                    No comments yet. Be the first!
                  </Text>
                )
              }
            />

            {/* Modal Comment Input */}
            <View style={styles.modalCommentRow}>
              <Image
                source={{
                  uri:
                    currentUser?.profilePicture ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      currentUser?.firstName || 'Me',
                    )}&background=EDE9FE&color=7C3AED`,
                }}
                style={styles.commentInputAvatar}
                contentFit="cover"
              />
              <View style={styles.commentInputWrap}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment..."
                  placeholderTextColor="#94A3B8"
                  value={modalCommentText}
                  onChangeText={setModalCommentText}
                  editable={!postingModalComment}
                />
              </View>
              {modalCommentText.trim().length > 0 && (
                <Pressable
                  style={styles.sendButton}
                  onPress={handleModalComment}
                  disabled={postingModalComment}>
                  <IconSymbol size={22} name="paperplane.fill" color="#7C3AED" />
                </Pressable>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>

    {/* ── Full-screen Image Viewer ───────────────────────────────── */}
    <ImageViewer
      uri={viewerUri ?? ''}
      visible={!!viewerUri}
      onClose={() => setViewerUri(null)}
    />
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    backgroundColor: '#7C3AED',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
  },
  displayName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  metaText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 1,
  },
  content: {
    fontSize: 15,
    color: '#1E293B',
    lineHeight: 22,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  mediaContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
  },
  singleMedia: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 460,
    backgroundColor: '#F1F5F9',
  },
  videoCardContainer: {
    width: '100%',
    aspectRatio: 4 / 5,
    maxHeight: 480,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    position: 'relative',
  },
  videoPlayerView: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 2,
  },
  videoBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  playPauseOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    zIndex: 1,
  },
  playIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  muteButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  likesSummary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    paddingHorizontal: 16,
    marginTop: 6,
  },
  viewComments: {
    paddingHorizontal: 16,
    marginTop: 6,
  },
  viewCommentsText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  // Comment items
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  commentBody: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  commentUsername: {
    fontWeight: '500',
    color: '#7C3AED',
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    color: '#334155',
    marginTop: 2,
  },
  commentTime: {
    fontSize: 12,
    color: '#94A3B8',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  // Quick comment input
  quickCommentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDE9FE',
  },
  commentInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 40,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    padding: 0,
    height: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  commentsList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyCommentText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 15,
    marginTop: 40,
  },
  modalCommentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  heartOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartEmoji: {
    fontSize: 80,
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImg: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.85,
  },
  imageViewerClose: {
    position: 'absolute',
    top: 52,
    right: 16,
  },
  imageViewerCloseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
