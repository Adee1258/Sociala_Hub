import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/AuthContext';
import apiService from '@/services/api';

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

function CommentItem({ comment }: { comment: PostComment }) {
  return (
    <View style={styles.commentItem}>
      <Image
        source={{
          uri:
            comment.user?.profilePicture ||
            'https://ui-avatars.com/api/?name=' + encodeURIComponent(comment.user?.firstName || 'User'),
        }}
        style={styles.commentAvatar}
        contentFit="cover"
      />
      <View style={styles.commentBody}>
        <Text style={styles.commentAuthor}>
          {comment.user?.firstName}{' '}
          {comment.user?.lastName ? comment.user.lastName : ''}
          <Text style={styles.commentUsername}> @{comment.user?.username}</Text>
        </Text>
        <Text style={styles.commentText}>{comment.text}</Text>
      </View>
      <Text style={styles.commentTime}>{timeAgo(comment.createdAt)}</Text>
    </View>
  );
}

// ── Main PostCard ────────────────────────────────────────────────────────

export function PostCard({ post, onPostUpdate }: PostCardProps) {
  const { user: currentUser } = useAuth();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [comments, setComments] = useState<PostComment[]>(post.comments || []);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [commentText, setCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [allComments, setAllComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [modalCommentText, setModalCommentText] = useState('');
  const [postingModalComment, setPostingModalComment] = useState(false);

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
    const options = isOwnPost ? ['Delete Post', 'Cancel'] : ['Report Post', 'Cancel'];
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
                { text: 'Delete', style: 'destructive', onPress: () => {} },
              ],
            );
          } else {
            Alert.alert('Thanks!', 'This post has been reported for review.');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [currentUser?.id, post.userId]);

  // ── Render media ───────────────────────────────────────────────────
  const renderMedia = () => {
    if (!post.media || post.media.length === 0) return null;

    if (post.media.length === 1) {
      const m = post.media[0];
      if (m.type === 'video') {
        return (
          <View style={styles.mediaContainer}>
            <Video
              source={{ uri: m.url }}
              style={styles.singleMedia}
              useNativeControls
              resizeMode={ResizeMode.COVER}
              shouldPlay={false}
            />
          </View>
        );
      }
      return (
        <View style={styles.mediaContainer}>
          <Image
            source={{ uri: m.url }}
            style={styles.singleMedia}
            contentFit="cover"
            transition={200}
          />
        </View>
      );
    }

    // Multiple images — horizontal scroll
    return (
      <FlatList
        data={post.media}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.mediaContainer}>
            {item.type === 'video' ? (
              <Video
                source={{ uri: item.url }}
                style={styles.singleMedia}
                useNativeControls
                resizeMode={ResizeMode.COVER}
                shouldPlay={false}
              />
            ) : (
              <Image
                source={{ uri: item.url }}
                style={styles.singleMedia}
                contentFit="cover"
                transition={200}
              />
            )}
          </View>
        )}
      />
    );
  };

  const avatarUrl =
    post.user?.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      post.user?.firstName || 'User',
    )}&background=EDE9FE&color=7C3AED`;

  return (
    <View style={styles.card}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarRing}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
          </View>
          <View>
            <Text style={styles.displayName}>
              {post.user?.firstName} {post.user?.lastName || ''}
            </Text>
            <Text style={styles.metaText}>
              @{post.user?.username} · {timeAgo(post.createdAt)}
            </Text>
          </View>
        </View>
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
          onPress={() => Haptics.selectionAsync()}>
          <IconSymbol size={24} name="bookmark" color="#1E293B" />
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
        <CommentItem key={c.id} comment={c} />
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
              renderItem={({ item }) => <CommentItem comment={item} />}
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
  },
  singleMedia: {
    width: '100%',
    height: 380,
    backgroundColor: '#F1F5F9',
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
});
