import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import apiService from '@/services/api';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOptimizedImageUrl, DEFAULT_BLURHASH } from '@/utils/cdn';

type FilterType = 'ALL' | 'LIKE' | 'COMMENT' | 'FOLLOW' | 'SYSTEM';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { socket, setNotificationCount } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 0ms Cache Hydration on mount
  useEffect(() => {
    AsyncStorage.getItem('socialhub_cached_notifs').then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setNotifications(parsed);
            setLoading(false);
          }
        } catch (_e) {}
      }
    });
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      if (notifications.length === 0) {
        setLoading(true);
      }
      const res = await apiService.getNotifications();
      if (res && res.success) {
        const notifs = res.notifications || [];
        setNotifications(notifs);
        setUnreadCount(res.unreadCount || 0);
        // Seed the context badge with the real count from the API
        setNotificationCount(res.unreadCount || 0);
        if (notifs.length > 0) {
          AsyncStorage.setItem('socialhub_cached_notifs', JSON.stringify(notifs.slice(0, 30))).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
    } finally {
      setLoading(false);
    }
  }, [setNotificationCount, notifications.length]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ── Real-time: listen for new notifications via socket ────────────
  useEffect(() => {
    if (!socket) return;

    const handleNew = (notification: any) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((c) => c + 1);
      // NOTE: context badge is already incremented by AuthContext's own listener
      // so we don't call setNotificationCount here to avoid double-counting
    };

    socket.on('new_notification', handleNew);
    return () => {
      socket.off('new_notification', handleNew);
    };
  }, [socket]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    setNotificationCount(0); // clear tab bar badge too
    try {
      await apiService.markNotificationsRead();
    } catch (_e) {
      console.error('Mark read error:', _e);
    }
  };

  const handleDeleteItem = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await apiService.deleteNotification(id);
    } catch (_e) {
      console.error('Delete notification error:', _e);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setNotifications([]);
            setUnreadCount(0);
            setNotificationCount(0);
            AsyncStorage.removeItem('socialhub_cached_notifs').catch(() => {});
            try {
              await apiService.clearAllNotifications();
            } catch (_e) {
              console.error('Clear notifications error:', _e);
            }
          },
        },
      ]
    );
  };

  // Helper for relative time string
  const formatTime = (dateStr: string) => {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  // Filtered notifications list
  const filteredList = notifications.filter((n) => {
    if (filter === 'ALL') return true;
    return n.type === filter;
  });

  const getFilterCount = (f: FilterType) => {
    if (f === 'ALL') return notifications.length;
    return notifications.filter((n) => n.type === f).length;
  };

  // Render single notification item
  const renderItem = ({ item }: { item: any }) => {
    const isSystem = item.type === 'SYSTEM';
    const sender = item.sender;
    const rawAvatarUrl =
      sender?.profilePicture ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(sender?.firstName || 'SocialHub')}&background=EDE9FE&color=7C3AED`;
    const avatarUrl = getOptimizedImageUrl(rawAvatarUrl, { avatar: true, width: 100 });

    let iconName = 'bell.fill';
    let iconColor = '#7C3AED';

    if (item.type === 'LIKE') {
      iconName = 'heart.fill';
      iconColor = '#EF4444';
    } else if (item.type === 'COMMENT') {
      iconName = 'bubble.right.fill';
      iconColor = '#3B82F6';
    } else if (item.type === 'FOLLOW') {
      iconName = 'person.badge.plus.fill';
      iconColor = '#10B981';
    } else if (item.type === 'SYSTEM') {
      iconName = 'sparkles';
      iconColor = '#F59E0B';
    }

    const handlePress = async () => {
      if (!item.isRead) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
        await apiService.markNotificationsRead([item.id] as any);
      }
      const targetId = sender?.id || sender?.username;
      if (targetId) {
        const fullName = `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim() || sender?.username;
        router.push({
          pathname: `/user/${targetId}`,
          params: {
            initialName: fullName,
            initialUsername: sender?.username,
            initialAvatar: sender?.profilePicture,
          },
        } as any);
      }
    };

    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrapper}>
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
            placeholder={{ blurhash: DEFAULT_BLURHASH }}
            transition={150}
          />
          <View style={[styles.typeBadge, { backgroundColor: iconColor }]}>
            <IconSymbol size={10} name={iconName as any} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.contentBox}>
          {isSystem ? (
            <Text style={styles.messageText}>{item.message}</Text>
          ) : (
            <Text style={styles.messageText}>
              <Text style={styles.senderName}>
                {sender?.firstName} {sender?.lastName}
              </Text>{' '}
              {item.type === 'LIKE' && 'liked your post.'}
              {item.type === 'COMMENT' && 'commented on your post.'}
              {item.type === 'FOLLOW' && 'started following you.'}
            </Text>
          )}
          <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
        </View>

        <View style={styles.rightActions}>
          {!item.isRead && <View style={styles.unreadDot} />}
          <TouchableOpacity
            onPress={() => handleDeleteItem(item.id)}
            hitSlop={10}
            style={styles.deleteBtn}
          >
            <Ionicons name="close" size={14} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + (Platform.OS === 'ios' ? 6 : 10) }]}>
        <View style={styles.titleRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 10, padding: 2 }}>
            <IconSymbol size={22} name="chevron.left" color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRightActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.headerActionBtn}>
              <Text style={styles.markReadText}>Mark read</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} style={styles.headerActionBtn}>
              <Ionicons name="trash-outline" size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersContainer}>
        {(['ALL', 'LIKE', 'COMMENT', 'FOLLOW', 'SYSTEM'] as FilterType[]).map((f) => {
          const count = getFilterCount(f);
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={async () => {
                await Haptics.selectionAsync();
                setFilter(f);
              }}>
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase() + 's'}
                {count > 0 ? ` (${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} tintColor="#7C3AED" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🔔</Text>
              <Text style={styles.emptyTitle}>No Notifications Yet</Text>
              <Text style={styles.emptySubtitle}>
                When people interact with your posts or profile, you'll see updates here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  badge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  markReadText: {
    color: '#7C3AED',
    fontSize: 13,
    fontWeight: '600',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: '#7C3AED',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  unreadCard: {
    backgroundColor: '#F5F3FF',
    borderColor: '#C4B5FD',
    borderLeftWidth: 4,
    borderLeftColor: '#7C3AED',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerActionBtn: {
    padding: 4,
  },
  rightActions: {
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  deleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  contentBox: {
    flex: 1,
  },
  messageText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 19,
  },
  senderName: {
    fontWeight: '700',
    color: '#0F172A',
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7C3AED',
    marginLeft: 8,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 54,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
