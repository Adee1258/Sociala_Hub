import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import apiService from '@/services/api';
import * as Haptics from 'expo-haptics';

type TabType = 'all' | 'users' | 'posts' | 'trending';

export default function SearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [trendingTags, setTrendingTags] = useState<any[]>([]);

  // Search API execution
  const performSearch = useCallback(async (query: string) => {
    try {
      setLoading(true);
      const res = await apiService.searchAll(query);
      if (res.success) {
        setUsers(res.users || []);
        setPosts(res.posts || []);
        setTrendingTags(res.trendingTags || []);
      }
    } catch (err) {
      console.error('Search API error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await performSearch(searchQuery);
    setRefreshing(false);
  };

  // Follow / Unfollow handler
  const handleToggleFollow = async (userId: string, isCurrentlyFollowing: boolean) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              isFollowing: !isCurrentlyFollowing,
              followersCount: isCurrentlyFollowing ? u.followersCount - 1 : u.followersCount + 1,
            }
          : u
      )
    );

    try {
      if (isCurrentlyFollowing) {
        await apiService.unfollowUser(userId);
      } else {
        await apiService.followUser(userId);
      }
    } catch (err) {
      // Revert if API fails
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isFollowing: isCurrentlyFollowing } : u))
      );
    }
  };

  // Header Search Input Component
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ padding: 4 }}>
          <IconSymbol size={22} name="chevron.left" color="#0F172A" />
        </TouchableOpacity>
        <View style={[styles.searchBar, { flex: 1 }]}>
          <IconSymbol size={20} name="magnifyingglass" color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search accounts, posts, or tags..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <IconSymbol size={18} name="xmark.circle.fill" color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {(['all', 'users', 'posts', 'trending'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={async () => {
              await Haptics.selectionAsync();
              setActiveTab(tab);
            }}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Render User Card
  const renderUserItem = ({ item }: { item: any }) => {
    const avatarUrl =
      item.profilePicture ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(item.firstName || item.username)}&background=EDE9FE&color=7C3AED`;

    const handleProfilePress = () => {
      const identifier = item.id || item.username;
      if (identifier) {
        router.push(`/user/${identifier}` as any);
      }
    };

    return (
      <View style={styles.userCard}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          onPress={handleProfilePress}
          activeOpacity={0.7}
        >
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {item.firstName} {item.lastName}
              </Text>
              {item.isVerified && <Text style={styles.badge}>✓</Text>}
            </View>
            <Text style={styles.username}>@{item.username}</Text>
            {item.bio ? (
              <Text style={styles.userBio} numberOfLines={1}>
                {item.bio}
              </Text>
            ) : null}
            <Text style={styles.followersText}>{item.followersCount || 0} followers</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.followBtn, item.isFollowing && styles.followingBtn]}
          onPress={() => handleToggleFollow(item.id, !!item.isFollowing)}>
          <Text style={[styles.followBtnText, item.isFollowing && styles.followingBtnText]}>
            {item.isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render Post Card
  const renderPostItem = ({ item }: { item: any }) => {
    const userAvatar =
      item.user?.profilePicture ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user?.firstName || 'U')}&background=EDE9FE&color=7C3AED`;

    const handleProfilePress = () => {
      const identifier = item.user?.id || item.user?.username;
      if (identifier) {
        router.push(`/user/${identifier}` as any);
      }
    };

    return (
      <View style={styles.postCard}>
        <TouchableOpacity
          style={styles.postHeader}
          onPress={handleProfilePress}
          activeOpacity={0.7}
        >
          <Image source={{ uri: userAvatar }} style={styles.postAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.postAuthor}>
              {item.user?.firstName} {item.user?.lastName}
            </Text>
            <Text style={styles.postTime}>@{item.user?.username}</Text>
          </View>
        </TouchableOpacity>
        {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}
        {item.media && item.media.length > 0 ? (
          <Image source={{ uri: item.media[0].url }} style={styles.postMedia} contentFit="cover" />
        ) : null}
        <View style={styles.postFooter}>
          <View style={styles.statItem}>
            <IconSymbol size={16} name="heart.fill" color="#EF4444" />
            <Text style={styles.statText}>{item.likesCount || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <IconSymbol size={16} name="bubble.right.fill" color="#64748B" />
            <Text style={styles.statText}>{item.commentsCount || 0}</Text>
          </View>
        </View>
      </View>
    );
  };

  // Main content render
  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}

      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} tintColor="#7C3AED" />}
          keyboardShouldPersistTaps="handled"
        >
          {/* No query — Discover/suggestion state */}
          {!searchQuery && users.length === 0 && posts.length === 0 && (
            <View style={styles.discoverContainer}>
              <View style={styles.discoverIconWrap}>
                <IconSymbol size={44} name="magnifyingglass" color="#7C3AED" />
              </View>
              <Text style={styles.discoverTitle}>Discover People & Posts</Text>
              <Text style={styles.discoverSubtitle}>Search for accounts, posts, or trending hashtags to explore SocialHub</Text>
            </View>
          )}

          {/* Trending Section */}
          {(activeTab === 'all' || activeTab === 'trending') && trendingTags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔥 Trending Hashtags</Text>
              <View style={styles.trendingGrid}>
                {trendingTags.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.tagChip}
                    onPress={() => setSearchQuery(t.tag)}>
                    <Text style={styles.tagTitle}>{t.tag}</Text>
                    <Text style={styles.tagCount}>{t.count} posts</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Accounts Section */}
          {(activeTab === 'all' || activeTab === 'users') && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>👤 Accounts</Text>
              {users.length === 0 ? (
                searchQuery ? (
                  <View style={styles.emptySection}>
                    <IconSymbol size={36} name="person.fill" color="#E2E8F0" />
                    <Text style={styles.emptySectionTitle}>No accounts found</Text>
                    <Text style={styles.emptySectionText}>Try a different name or username</Text>
                  </View>
                ) : null
              ) : (
                users.map((u) => <View key={u.id}>{renderUserItem({ item: u })}</View>)
              )}
            </View>
          )}

          {/* Posts Section */}
          {(activeTab === 'all' || activeTab === 'posts') && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📝 Posts</Text>
              {posts.length === 0 ? (
                searchQuery ? (
                  <View style={styles.emptySection}>
                    <IconSymbol size={36} name="doc.text.fill" color="#E2E8F0" />
                    <Text style={styles.emptySectionTitle}>No posts found</Text>
                    <Text style={styles.emptySectionText}>Try different keywords</Text>
                  </View>
                ) : null
              ) : (
                posts.map((p) => <View key={p.id}>{renderPostItem({ item: p })}</View>)
              )}
            </View>
          )}

          {/* All-tab empty state when searched but nothing found */}
          {searchQuery && activeTab === 'all' && users.length === 0 && posts.length === 0 && trendingTags.length === 0 && !loading && (
            <View style={styles.fullEmptyContainer}>
              <IconSymbol size={56} name="magnifyingglass" color="#E2E8F0" />
              <Text style={styles.fullEmptyTitle}>No results for "{searchQuery}"</Text>
              <Text style={styles.fullEmptyText}>Try checking for typos or searching for something else</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#1E293B',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  tabButtonActive: {
    backgroundColor: '#7C3AED',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EDE9FE',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  badge: {
    fontSize: 12,
    color: '#7C3AED',
    marginLeft: 4,
    fontWeight: '900',
  },
  username: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 1,
  },
  userBio: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  followersText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  followBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followingBtn: {
    backgroundColor: '#E2E8F0',
  },
  followBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  followingBtnText: {
    color: '#475569',
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  postAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  postTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  postContent: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 8,
  },
  postMedia: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 8,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 4,
  },
  tagTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6D28D9',
  },
  tagCount: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 2,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginVertical: 8,
  },
  // Discover state (no query yet)
  discoverContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  discoverIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  discoverTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
    textAlign: 'center',
  },
  discoverSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  // Per-section empty
  emptySection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptySectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySectionText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  // Full empty (all tab + searched + 0 results)
  fullEmptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  fullEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  fullEmptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
});
