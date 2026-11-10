import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import apiService from '@/services/api';
import { getOptimizedImageUrl, DEFAULT_BLURHASH } from '@/utils/cdn';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FollowUser {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  bio?: string;
  isVerified?: boolean;
  isFollowing?: boolean;
  isSelf?: boolean;
}

interface FollowListModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'followers' | 'following';
  userId: string;
  username?: string;
}

export function FollowListModal({
  visible,
  onClose,
  type,
  userId,
  username,
}: FollowListModalProps) {
  const router = useRouter();
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [followLoading, setFollowLoading] = useState<{ [key: string]: boolean }>({});

  const titleText = type === 'followers' ? 'Followers' : 'Following';

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res =
        type === 'followers'
          ? await apiService.getUserFollowers(userId)
          : await apiService.getUserFollowing(userId);

      if (res && res.success && Array.isArray(res.users)) {
        setUsers(res.users);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error('Error fetching ' + type + ':', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [userId, type]);

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      loadData();
    }
  }, [visible, loadData]);

  const handleToggleFollow = async (user: FollowUser) => {
    if (followLoading[user.id] || user.isSelf) return;

    await Haptics.selectionAsync();
    const prevStatus = Boolean(user.isFollowing);

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, isFollowing: !prevStatus } : u))
    );
    setFollowLoading((prev) => ({ ...prev, [user.id]: true }));

    try {
      if (prevStatus) {
        await apiService.unfollowUser(user.id);
      } else {
        await apiService.followUser(user.id);
      }
    } catch (err) {
      // Revert on error
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isFollowing: prevStatus } : u))
      );
    } finally {
      setFollowLoading((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  const handleUserPress = (user: FollowUser) => {
    onClose();
    router.push({
      pathname: `/user/${user.id || user.username}`,
      params: {
        initialName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        initialUsername: user.username,
        initialAvatar: user.profilePicture,
      },
    } as any);
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    return fullName.includes(q) || u.username.toLowerCase().includes(q);
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.dragPill} />
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>
                {titleText}
                {username ? <Text style={styles.headerUsername}> · @{username}</Text> : null}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchBar}>
              <Feather name="search" size={16} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search ${titleText.toLowerCase()}...`}
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* User List */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text style={styles.loadingText}>Loading {titleText.toLowerCase()}...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const avatar = getOptimizedImageUrl(
                  item.profilePicture ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      item.firstName || item.username
                    )}&background=EDE9FE&color=7C3AED`,
                  { avatar: true, width: 100 }
                );

                const fullName =
                  `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.username;

                return (
                  <View style={styles.userRow}>
                    <TouchableOpacity
                      style={styles.userInfoRow}
                      onPress={() => handleUserPress(item)}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{ uri: avatar }}
                        style={styles.avatar}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        placeholder={{ blurhash: DEFAULT_BLURHASH }}
                        transition={100}
                      />
                      <View style={styles.textContainer}>
                        <View style={styles.nameWithBadge}>
                          <Text style={styles.name} numberOfLines={1}>
                            {fullName}
                          </Text>
                          {item.isVerified && (
                            <Ionicons
                              name="checkmark-circle"
                              size={14}
                              color="#3B82F6"
                              style={{ marginLeft: 4 }}
                            />
                          )}
                        </View>
                        <Text style={styles.handle}>@{item.username}</Text>
                        {item.bio ? (
                          <Text style={styles.bio} numberOfLines={1}>
                            {item.bio}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>

                    {/* Follow Toggle Button */}
                    {!item.isSelf && (
                      <TouchableOpacity
                        style={[
                          styles.followButton,
                          item.isFollowing && styles.followingButton,
                        ]}
                        onPress={() => handleToggleFollow(item)}
                        disabled={followLoading[item.id]}
                      >
                        {followLoading[item.id] ? (
                          <ActivityIndicator
                            size="small"
                            color={item.isFollowing ? '#0F172A' : '#FFFFFF'}
                          />
                        ) : (
                          <Text
                            style={[
                              styles.followButtonText,
                              item.isFollowing && styles.followingButtonText,
                            ]}
                          >
                            {item.isFollowing ? 'Following' : 'Follow'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.centerContainer}>
                  <Ionicons name="people-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>No {titleText} Found</Text>
                  <Text style={styles.emptySubtitle}>
                    {searchQuery.trim()
                      ? 'No users match your search.'
                      : type === 'followers'
                      ? 'No one is following this user yet.'
                      : 'This user is not following anyone yet.'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.78,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  dragPill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 10,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerUsername: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F1F5F9',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  nameWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  handle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  bio: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  followButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  followingButtonText: {
    color: '#0F172A',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
