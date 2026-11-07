import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Share,
  Alert,
  FlatList,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiService from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { PostCard } from '@/components/PostCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_ITEM_SIZE = (SCREEN_WIDTH - 6) / 3;

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const [profileUser, setProfileUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels'>('posts');
  const [viewMode, setViewMode] = useState<'grid' | 'feed'>('grid');
  const [selectedPost, setSelectedPost] = useState<any | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = Boolean(
    currentUser &&
    profileUser &&
    (currentUser.id === profileUser.id ||
      currentUser.username?.toLowerCase() === profileUser.username?.toLowerCase())
  );

  const loadUserProfile = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const res = await apiService.getUserProfile(id);
      if (res && res.user) {
        setProfileUser(res.user);

        // Fetch posts and reels in parallel
        const targetId = res.user.id || id;
        const [postsRes, reelsRes] = await Promise.allSettled([
          apiService.getUserPosts(targetId),
          apiService.getUserReels(targetId),
        ]);

        if (postsRes.status === 'fulfilled' && postsRes.value?.posts) {
          setPosts(postsRes.value.posts);
        }
        if (reelsRes.status === 'fulfilled' && reelsRes.value?.posts) {
          setReels(reelsRes.value.posts);
        }
      } else {
        setError('User profile not found');
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError(err?.message || 'Failed to load user profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    loadUserProfile();
  }, [loadUserProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserProfile();
  };

  const handleToggleFollow = async () => {
    if (!profileUser || isSelf || followLoading) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const prevFollowing = Boolean(profileUser.isFollowing);
    const prevCount = profileUser.followersCount || 0;

    // Optimistic state
    setProfileUser((prev: any) => ({
      ...prev,
      isFollowing: !prevFollowing,
      followersCount: prevFollowing ? Math.max(0, prevCount - 1) : prevCount + 1,
    }));

    setFollowLoading(true);
    try {
      if (prevFollowing) {
        await apiService.unfollowUser(profileUser.id);
      } else {
        await apiService.followUser(profileUser.id);
      }
    } catch (err) {
      // Revert on failure
      setProfileUser((prev: any) => ({
        ...prev,
        isFollowing: prevFollowing,
        followersCount: prevCount,
      }));
      Alert.alert('Error', 'Could not update follow status. Please try again.');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!profileUser) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const targetUserId = profileUser.id;
      const conversation = await apiService.getOrCreateConversation(targetUserId);
      const convId = conversation?._id || conversation?.id;
      if (convId) {
        router.push(`/chat/${convId}` as any);
      } else {
        Alert.alert('Error', 'Unable to start chat with this user.');
      }
    } catch (err: any) {
      Alert.alert('Chat Error', err?.message || 'Failed to open conversation');
    }
  };

  const handleShareProfile = async () => {
    if (!profileUser) return;
    try {
      await Share.share({
        message: `Check out @${profileUser.username} on SocialHub!`,
      });
    } catch (_err) {}
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error || !profileUser) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="person-circle-outline" size={72} color="#CBD5E1" />
        <Text style={styles.errorTitle}>Profile Unavailable</Text>
        <Text style={styles.errorSubtitle}>{error || 'Could not find this user.'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const avatarUrl =
    profileUser.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      profileUser.firstName || profileUser.username || 'User'
    )}&background=EDE9FE&color=7C3AED`;

  const coverUrl = profileUser.profileCover;
  const fullName = `${profileUser.firstName || ''} ${profileUser.lastName || ''}`.trim() || profileUser.username;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconCircle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          @{profileUser.username}
        </Text>
        <TouchableOpacity
          onPress={handleShareProfile}
          style={styles.iconCircle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="share" size={18} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} tintColor="#7C3AED" />}
      >
        {/* Cover Photo */}
        <View style={styles.coverWrapper}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImage} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={styles.defaultCover} />
          )}
        </View>

        {/* Profile Card Header */}
        <View style={styles.profileHeaderBox}>
          {/* Avatar */}
          <View style={styles.avatarRow}>
            <View style={styles.avatarRing}>
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" cachePolicy="memory-disk" />
            </View>

            {/* Actions: Follow / Edit / Message */}
            <View style={styles.actionRow}>
              {isSelf ? (
                <TouchableOpacity style={styles.editProfileBtn} onPress={() => router.push('/edit-profile')}>
                  <Feather name="edit-3" size={15} color="#0F172A" />
                  <Text style={styles.editProfileText}>Edit Profile</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.followBtn, profileUser.isFollowing && styles.followingBtn]}
                    onPress={handleToggleFollow}
                    disabled={followLoading}
                  >
                    <Text style={[styles.followBtnText, profileUser.isFollowing && styles.followingBtnText]}>
                      {profileUser.isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.messageBtn} onPress={handleStartChat}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#0F172A" />
                    <Text style={styles.messageBtnText}>Message</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Name & Username */}
          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{fullName}</Text>
              {profileUser.isVerified && (
                <MaterialCommunityIcons name="check-decagram" size={18} color="#3B82F6" style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={styles.handle}>@{profileUser.username}</Text>
          </View>

          {/* Bio */}
          {profileUser.bio ? <Text style={styles.bioText}>{profileUser.bio}</Text> : null}

          {/* Meta Links / Location */}
          <View style={styles.metaRow}>
            {profileUser.address ? (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={14} color="#64748B" />
                <Text style={styles.metaText}>{profileUser.address}</Text>
              </View>
            ) : null}
            {profileUser.website ? (
              <View style={styles.metaItem}>
                <Ionicons name="link-outline" size={14} color="#7C3AED" />
                <Text style={[styles.metaText, { color: '#7C3AED' }]}>{profileUser.website}</Text>
              </View>
            ) : null}
          </View>

          {/* Counts Bar */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statCount}>{posts.length || profileUser.postsCount || 0}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statCount}>{profileUser.followersCount || 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statCount}>{profileUser.followingCount || 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>

        {/* Tab Selector: Posts vs Reels */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}
            onPress={() => setActiveTab('posts')}
          >
            <Ionicons name="grid-outline" size={18} color={activeTab === 'posts' ? '#7C3AED' : '#94A3B8'} />
            <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>Posts</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'reels' && styles.tabButtonActive]}
            onPress={() => setActiveTab('reels')}
          >
            <Ionicons name="play-circle-outline" size={19} color={activeTab === 'reels' ? '#7C3AED' : '#94A3B8'} />
            <Text style={[styles.tabText, activeTab === 'reels' && styles.tabTextActive]}>Reels</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'posts' ? (
          posts.length === 0 ? (
            <View style={styles.emptyContent}>
              <Ionicons name="images-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Posts Yet</Text>
              <Text style={styles.emptySubtitle}>When @{profileUser.username} shares posts, they will appear here.</Text>
            </View>
          ) : viewMode === 'grid' ? (
            <View style={styles.gridContainer}>
              {posts.map((post) => {
                const mediaUri = post.media?.[0]?.url;
                return (
                  <TouchableOpacity
                    key={post.id}
                    style={styles.gridItem}
                    onPress={() => setSelectedPost(post)}
                  >
                    {mediaUri ? (
                      <Image source={{ uri: mediaUri }} style={styles.gridImage} contentFit="cover" cachePolicy="memory-disk" />
                    ) : (
                      <View style={styles.textPostCard}>
                        <Text style={styles.textPostSnippet} numberOfLines={3}>
                          {post.content || 'Post'}
                        </Text>
                      </View>
                    )}
                    {post.media?.length > 1 && (
                      <View style={styles.multiIconBadge}>
                        <Ionicons name="copy-outline" size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={{ gap: 8, paddingBottom: 32 }}>
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </View>
          )
        ) : reels.length === 0 ? (
          <View style={styles.emptyContent}>
            <Ionicons name="videocam-outline" size={40} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Reels Yet</Text>
            <Text style={styles.emptySubtitle}>@{profileUser.username} hasn't shared any reels yet.</Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {reels.map((reel) => {
              const videoThumb = reel.media?.[0]?.url;
              return (
                <View key={reel.id} style={styles.gridItem}>
                  {videoThumb ? (
                    <Image source={{ uri: videoThumb }} style={styles.gridImage} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <View style={styles.reelPlaceholder}>
                      <Ionicons name="play-circle" size={24} color="#7C3AED" />
                    </View>
                  )}
                  <View style={styles.reelOverlayBadge}>
                    <Ionicons name="play" size={11} color="#FFFFFF" />
                    <Text style={styles.reelLikesCount}>{reel.likesCount || 0}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Selected Post Modal preview */}
      {selectedPost && (
        <View style={styles.postPreviewModalOverlay}>
          <TouchableOpacity style={styles.closePreviewBtn} onPress={() => setSelectedPost(null)}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.postPreviewCardBox}>
            <PostCard post={selectedPost} onPostUpdate={(upd) => setSelectedPost(upd)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 14,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    maxWidth: SCREEN_WIDTH - 120,
  },
  coverWrapper: {
    height: 120,
    width: '100%',
    backgroundColor: '#F1F5F9',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  defaultCover: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E2E8F0',
  },
  profileHeaderBox: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: -42,
    marginBottom: 10,
  },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFFFFF',
    padding: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: '#EDE9FE',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followingBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  followBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  followingBtnText: {
    color: '#0F172A',
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  messageBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editProfileText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  nameBlock: {
    marginBottom: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  handle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
    marginVertical: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#64748B',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statBox: {
    alignItems: 'center',
  },
  statCount: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#7C3AED',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#7C3AED',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    paddingTop: 3,
    backgroundColor: '#FFFFFF',
    paddingBottom: 40,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  textPostCard: {
    flex: 1,
    backgroundColor: '#EDE9FE',
    padding: 8,
    justifyContent: 'center',
  },
  textPostSnippet: {
    fontSize: 11,
    color: '#5B21B6',
    fontWeight: '500',
  },
  multiIconBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 3,
    borderRadius: 4,
  },
  reelPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  reelOverlayBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reelLikesCount: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyContent: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  postPreviewModalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  closePreviewBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    padding: 6,
  },
  postPreviewCardBox: {
    width: '100%',
    maxHeight: '85%',
  },
});
