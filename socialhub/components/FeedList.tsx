import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Text } from 'react-native-paper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PostCard, type PostData } from '@/components/PostCard';
import apiService from '@/services/api';

// ── Loading Skeleton ────────────────────────────────────────────────────

function PostSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      {/* Header */}
      <View style={styles.skeletonHeader}>
        <View style={[styles.skeletonCircle, { width: 44, height: 44, borderRadius: 22 }]} />
        <View style={{ gap: 6, flex: 1 }}>
          <View style={[styles.skeletonBar, { width: 120, height: 12 }]} />
          <View style={[styles.skeletonBar, { width: 80, height: 10 }]} />
        </View>
      </View>
      {/* Content lines */}
      <View style={styles.skeletonContent}>
        <View style={[styles.skeletonBar, { width: '100%', height: 14 }]} />
        <View style={[styles.skeletonBar, { width: '70%', height: 14 }]} />
      </View>
      {/* Media placeholder */}
      <View style={styles.skeletonMedia} />
      {/* Actions */}
      <View style={styles.skeletonActions}>
        <View style={[styles.skeletonBar, { width: 60, height: 24 }]} />
        <View style={[styles.skeletonBar, { width: 60, height: 24 }]} />
        <View style={[styles.skeletonBar, { width: 60, height: 24 }]} />
      </View>
    </View>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────

function EmptyFeed({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <IconSymbol size={48} name="house.fill" color="#7C3AED" />
      </View>
      <Text style={styles.emptyTitle}>Your feed is empty</Text>
      <Text style={styles.emptySubtitle}>
        Be the first to share something!{'\n'}
        Create a post to get the conversation started.
      </Text>
      <Pressable style={styles.emptyButton} onPress={onRefresh}>
        <Text style={styles.emptyButtonText}>Refresh Feed</Text>
      </Pressable>
    </View>
  );
}

// ── Error State ──────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <IconSymbol size={48} name="ellipsis" color="#EF4444" />
      </View>
      <Text style={styles.emptyTitle}>Something went wrong</Text>
      <Text style={styles.emptySubtitle}>
        We couldn't load your feed.{'\n'}
        Please check your connection and try again.
      </Text>
      <Pressable style={styles.emptyButton} onPress={onRetry}>
        <Text style={styles.emptyButtonText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

// ── FeedList Component ───────────────────────────────────────────────────

interface FeedListProps {
  /** Called when the user taps the "Create Post" area. */
  onCreatePost?: () => void;
  /** Optional component rendered as a sticky header above the feed (e.g. Stories). */
  headerComponent?: React.ReactElement;
  /** Key to force a refetch (e.g. after creating a post). */
  refreshKey?: number;
}

export function FeedList({ onCreatePost, headerComponent, refreshKey }: FeedListProps) {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const mountedRef = useRef(true);

  // ── Fetch feed posts ──────────────────────────────────────────────
  const fetchFeed = useCallback(
    async (reset = false) => {
      const targetPage = reset ? 1 : page;
      if (reset) {
        setError(false);
      }

      try {
        const res = await apiService.getFeedPosts(targetPage, 10);

        if (!mountedRef.current) return;

        if (reset || targetPage === 1) {
          setPosts(res.posts || []);
        } else {
          setPosts((prev) => [...prev, ...(res.posts || [])]);
        }

        setHasMore(res.pagination?.hasMore ?? false);
        setPage(targetPage + 1);
        setError(false);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(true);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [page],
  );

  // ── Initial load ──────────────────────────────────────────────────
  React.useEffect(() => {
    mountedRef.current = true;
    fetchFeed(true);
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Refetch when refreshKey changes (e.g. after creating a post) ──
  React.useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      fetchFeed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // ── Pull to refresh ───────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchFeed(true);
  }, [fetchFeed]);

  // ── Load more ─────────────────────────────────────────────────────
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading && !error) {
      setLoadingMore(true);
      fetchFeed(false);
    }
  }, [loadingMore, hasMore, loading, error, fetchFeed]);

  // ── Update a single post in the list ──────────────────────────────
  const handlePostUpdate = useCallback((updatedPost: PostData) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)),
    );
  }, []);

  // ── Render ────────────────────────────────────────────────────────

  // Initial loading
  if (loading && posts.length === 0) {
    return (
      <View style={styles.container}>
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
      </View>
    );
  }

  // Error state with no cached data
  if (error && posts.length === 0) {
    return <ErrorState onRetry={() => fetchFeed(true)} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard post={item} onPostUpdate={handlePostUpdate} />
        )}
        ListHeaderComponent={headerComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#7C3AED']}
            tintColor="#7C3AED"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#7C3AED" />
            </View>
          ) : null
        }
        ListEmptyComponent={<EmptyFeed onRefresh={handleRefresh} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={posts.length === 0 ? styles.emptyList : undefined}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  emptyList: {
    flexGrow: 1,
  },
  separator: {
    height: 6,
    backgroundColor: '#F1F5F9',
  },
  // Skeleton
  skeletonCard: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    padding: 16,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  skeletonCircle: {
    backgroundColor: '#E2E8F0',
  },
  skeletonBar: {
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
  },
  skeletonContent: {
    gap: 8,
    marginBottom: 14,
  },
  skeletonMedia: {
    width: '100%',
    height: 300,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 14,
  },
  skeletonActions: {
    flexDirection: 'row',
    gap: 20,
  },
  // Empty / Error state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Footer loader
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
