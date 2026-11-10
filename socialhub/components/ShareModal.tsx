import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  Share,
  Linking,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiService from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import type { PostData } from '@/components/PostCard';

interface ShareModalProps {
  visible: boolean;
  post: PostData | null;
  onClose: () => void;
}

export function ShareModal({ visible, post, onClose }: ShareModalProps) {
  const { user: currentUser } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [sendingChatId, setSendingChatId] = useState<string | null>(null);
  const [sentChatIds, setSentChatIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const authorName =
    post?.user?.firstName && post?.user?.lastName
      ? `${post.user.firstName} ${post.user.lastName}`
      : post?.user?.firstName || post?.user?.username || 'Someone';

  const authorUsername = post?.user?.username || 'user';
  const authorAvatar =
    post?.user?.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=EDE9FE&color=7C3AED`;

  const postUrl = post ? `https://socialhub.app/post/${post.id}` : 'https://socialhub.app';
  const mediaThumbnail = post?.media?.[0]?.url;

  // Show a momentary toast banner inside the modal
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  }, []);

  // Fetch conversations for in-app DM sharing
  useEffect(() => {
    if (visible && currentUser) {
      setLoadingChats(true);
      setSentChatIds(new Set());
      apiService
        .getConversations()
        .then((data) => {
          if (Array.isArray(data)) {
            setConversations(data.slice(0, 10)); // Top 10 recent chats
          }
        })
        .catch((err) => {
          console.warn('[ShareModal] Failed to load conversations:', err.message);
        })
        .finally(() => {
          setLoadingChats(false);
        });
    }
  }, [visible, currentUser]);

  // ── 1. Copy Link Action ─────────────────────────────────────────────
  const handleCopyLink = useCallback(async () => {
    try {
      await Haptics.selectionAsync();
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(postUrl);
        showToast('Link copied to clipboard!');
      } else {
        // Fallback: Trigger native share sheet with the link so user can copy
        await Share.share(
          Platform.OS === 'ios'
            ? { url: postUrl }
            : { message: postUrl, title: `SocialHub post by ${authorName}` }
        );
        showToast('Link copied to clipboard!');
      }
    } catch (_e) {
      showToast('Link: ' + postUrl);
    }
  }, [postUrl, authorName, showToast]);

  // ── 2. Native System Share Sheet ────────────────────────────────────
  const handleSystemShare = useCallback(async () => {
    if (!post) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const postSnippet = post.content ? `"${post.content.trim()}"` : '';
      const shareMessage = `${authorName} (@${authorUsername}) on SocialHub:\n${postSnippet}\n\n${postUrl}`;

      await Share.share(
        Platform.OS === 'ios'
          ? {
              title: `SocialHub Post by ${authorName}`,
              message: shareMessage,
              url: postUrl,
            }
          : {
              title: `SocialHub Post by ${authorName}`,
              message: shareMessage,
            }
      );
    } catch (_err) {
      // User dismissed share dialog
    }
  }, [post, authorName, authorUsername, postUrl]);

  // ── 3. WhatsApp Direct Share ─────────────────────────────────────────
  const handleWhatsAppShare = useCallback(async () => {
    if (!post) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const postSnippet = post.content ? `"${post.content.trim()}"` : '';
      const text = encodeURIComponent(
        `Check out this post by ${authorName} on SocialHub:\n${postSnippet}\n${postUrl}`
      );
      const whatsappUrl = `whatsapp://send?text=${text}`;

      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to web WhatsApp or system share
        const webUrl = `https://api.whatsapp.com/send?text=${text}`;
        await Linking.openURL(webUrl).catch(() => handleSystemShare());
      }
    } catch (_e) {
      handleSystemShare();
    }
  }, [post, authorName, postUrl, handleSystemShare]);

  // ── 4. In-App Direct Message Share ──────────────────────────────────
  const handleSendToChat = useCallback(
    async (conversation: any) => {
      if (!post || !conversation?.id) return;
      const conversationId = conversation.id;

      setSendingChatId(conversationId);
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const shareSnippet = post.content ? `"${post.content.slice(0, 120)}..."` : 'Check out this post';
        const messageText = `🔗 Shared a post from @${authorUsername}:\n${shareSnippet}\n${postUrl}`;

        await apiService.sendMessage({
          conversationId,
          text: messageText,
          media: mediaThumbnail ? [{ url: mediaThumbnail, type: post.media?.[0]?.type || 'image' }] : undefined,
        });

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSentChatIds((prev) => new Set(prev).add(conversationId));

        // Get recipient name
        const otherParticipant = conversation.participants?.find((p: any) => p.user?.id !== currentUser?.id)?.user;
        const recipientName = otherParticipant?.firstName || 'Friend';
        showToast(`Sent to ${recipientName}!`);
      } catch (err: any) {
        showToast(err?.message || 'Failed to send message');
      } finally {
        setSendingChatId(null);
      }
    },
    [post, authorUsername, postUrl, mediaThumbnail, currentUser?.id, showToast]
  );

  if (!post) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Share Post</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </Pressable>
          </View>

          {/* Toast Notification */}
          {toastMessage && (
            <View style={styles.toast}>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          )}

          {/* Post Preview Card */}
          <View style={styles.previewCard}>
            <Image source={{ uri: authorAvatar }} style={styles.previewAvatar} contentFit="cover" />
            <View style={styles.previewTextWrap}>
              <Text style={styles.previewAuthor}>{authorName}</Text>
              <Text style={styles.previewContent} numberOfLines={2}>
                {post.content || (post.isReel ? '🎬 Watch this reel' : '📷 Shared a photo')}
              </Text>
            </View>
            {mediaThumbnail && (
              <Image source={{ uri: mediaThumbnail }} style={styles.previewMedia} contentFit="cover" />
            )}
          </View>

          {/* Quick Actions Row */}
          <View style={styles.quickActionsContainer}>
            <Pressable style={styles.actionItem} onPress={handleCopyLink}>
              <View style={[styles.actionIconWrap, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="link-outline" size={24} color="#7C3AED" />
              </View>
              <Text style={styles.actionLabel}>Copy Link</Text>
            </Pressable>

            <Pressable style={styles.actionItem} onPress={handleWhatsAppShare}>
              <View style={[styles.actionIconWrap, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="logo-whatsapp" size={24} color="#16A34A" />
              </View>
              <Text style={styles.actionLabel}>WhatsApp</Text>
            </Pressable>

            <Pressable style={styles.actionItem} onPress={handleSystemShare}>
              <View style={[styles.actionIconWrap, { backgroundColor: '#E0E7FF' }]}>
                <Ionicons name="share-social-outline" size={24} color="#4F46E5" />
              </View>
              <Text style={styles.actionLabel}>Share via...</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* In-App Direct Message Section */}
          <View style={styles.dmSection}>
            <Text style={styles.sectionTitle}>Send in Direct Message</Text>

            {loadingChats ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="small" color="#7C3AED" />
                <Text style={styles.loaderText}>Loading chats...</Text>
              </View>
            ) : conversations.length === 0 ? (
              <View style={styles.emptyDmWrap}>
                <Ionicons name="chatbubbles-outline" size={32} color="#CBD5E1" />
                <Text style={styles.emptyDmText}>No active conversations yet.</Text>
                <Pressable style={styles.bigShareBtn} onPress={handleSystemShare}>
                  <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.bigShareBtnText}>Share to Other Apps</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                style={styles.chatList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                {conversations.map((c) => {
                  const other = c.participants?.find((p: any) => p.user?.id !== currentUser?.id)?.user;
                  const cName = c.isGroup
                    ? c.name || 'Group Chat'
                    : other
                    ? `${other.firstName} ${other.lastName || ''}`.trim()
                    : 'Chat';
                  const cAvatar =
                    other?.profilePicture ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(cName)}&background=EDE9FE&color=7C3AED`;
                  const isSent = sentChatIds.has(c.id);
                  const isSending = sendingChatId === c.id;

                  return (
                    <View key={c.id} style={styles.chatRow}>
                      <Image source={{ uri: cAvatar }} style={styles.chatAvatar} contentFit="cover" />
                      <View style={styles.chatInfo}>
                        <Text style={styles.chatName} numberOfLines={1}>
                          {cName}
                        </Text>
                        <Text style={styles.chatSub} numberOfLines={1}>
                          {other?.username ? `@${other.username}` : 'Direct message'}
                        </Text>
                      </View>
                      <Pressable
                        style={[styles.sendBtn, isSent && styles.sendBtnSuccess]}
                        disabled={isSent || isSending}
                        onPress={() => handleSendToChat(c)}>
                        {isSending ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={[styles.sendBtnText, isSent && styles.sendBtnTextSuccess]}>
                            {isSent ? 'Sent ✓' : 'Send'}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 10,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  // Preview Card
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    gap: 12,
  },
  previewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  previewTextWrap: {
    flex: 1,
  },
  previewAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  previewContent: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  previewMedia: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  // Quick Actions
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  actionItem: {
    alignItems: 'center',
    gap: 6,
    minWidth: 70,
  },
  actionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  // DM Section
  dmSection: {
    flexShrink: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  loaderWrap: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyDmWrap: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 10,
  },
  emptyDmText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  bigShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 6,
  },
  bigShareBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  chatList: {
    maxHeight: 240,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  chatAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  chatSub: {
    fontSize: 12,
    color: '#94A3B8',
  },
  sendBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnSuccess: {
    backgroundColor: '#10B981',
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sendBtnTextSuccess: {
    color: '#FFFFFF',
  },
});
