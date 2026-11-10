const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../config/db');
const redis = require('../config/redis');

const router = express.Router();

// Helper to format post
const formatPost = (post, currentUserId) => ({
  id: post.id,
  content: post.content,
  isReel: post.isReel,
  createdAt: post.createdAt,
  updatedAt: post.updatedAt,
  userId: post.userId,
  user: post.user
    ? {
        id: post.user.id,
        username: post.user.username,
        firstName: post.user.firstName,
        lastName: post.user.lastName,
        profilePicture: post.user.profilePicture,
      }
    : null,
  media: (post.media || []).map((m) => ({ id: m.id, url: m.url, type: m.type })),
  likesCount: (post.likes || []).length,
  likedByMe: (post.likes || []).some((l) => l.userId === currentUserId),
  commentsCount: (post.comments || []).length,
});

// Helper: extract hashtags from post content
const extractHashtags = (content) => {
  if (!content) return [];
  const matches = content.match(/#[a-zA-Z0-9_\u0600-\u06FF]+/g) || [];
  return matches.map((t) => t.toLowerCase());
};

// @route   GET /api/search
router.get('/', auth, async (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    const currentUserId = req.user.id;

    // Fetch user's following list to compute isFollowing
    const myFollowings = await prisma.follows.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    });
    const followingSet = new Set(myFollowings.map((f) => f.followingId));

    let users = [];
    let posts = [];

    if (query.length > 0) {
      // Search Users
      const rawUsers = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
          ],
          id: { not: currentUserId },
        },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          profilePicture: true,
          bio: true,
          isVerified: true,
          level: true,
          _count: { select: { followers: true } },
        },
        take: 20,
      });

      users = rawUsers.map((u) => ({
        ...u,
        followersCount: u._count?.followers || 0,
        isFollowing: followingSet.has(u.id),
      }));

      // Search Posts
      const rawPosts = await prisma.post.findMany({
        where: {
          content: { contains: query, mode: 'insensitive' },
        },
        include: {
          media: true,
          likes: true,
          comments: true,
          user: {
            select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      posts = rawPosts.map((p) => formatPost(p, currentUserId));
    } else {
      // If query empty, suggest newest users (exclude self)
      const suggestedRaw = await prisma.user.findMany({
        where: { id: { not: currentUserId } },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          profilePicture: true,
          bio: true,
          isVerified: true,
          level: true,
          _count: { select: { followers: true } },
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      users = suggestedRaw.map((u) => ({
        ...u,
        followersCount: u._count?.followers || 0,
        isFollowing: followingSet.has(u.id),
      }));
    }

    // ── Real trending hashtags from actual post content ──────────────────────
    // Fetch recent 200 posts and extract + count hashtags
    const recentPosts = await prisma.post.findMany({
      where: { content: { not: null } },
      select: { content: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const tagCounts = new Map();
    for (const p of recentPosts) {
      for (const tag of extractHashtags(p.content)) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Sort by count descending, take top 10
    const sortedTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Format count nicely: 1000 → "1k posts"
    const formatTagCount = (n) => {
      if (n >= 1000) return `${(n / 1000).toFixed(1)}k posts`;
      return `${n} ${n === 1 ? 'post' : 'posts'}`;
    };

    const trendingTags = sortedTags.length > 0
      ? sortedTags.map(([tag, count], i) => ({
          id: String(i + 1),
          tag,
          count: formatTagCount(count),
          rawCount: count,
        }))
      : [
          // Fallback when no posts exist yet
          { id: '1', tag: '#SocialHub', count: '0 posts', rawCount: 0 },
          { id: '2', tag: '#TechTrends', count: '0 posts', rawCount: 0 },
          { id: '3', tag: '#MobileDev', count: '0 posts', rawCount: 0 },
          { id: '4', tag: '#ReactNative', count: '0 posts', rawCount: 0 },
          { id: '5', tag: '#AIRevolution', count: '0 posts', rawCount: 0 },
        ];

    res.json({
      success: true,
      users,
      posts,
      trendingTags,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/search/follow/:targetUserId
router.post('/follow/:targetUserId', auth, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const existing = await prisma.follows.findUnique({
      where: { followerId_followingId: { followerId: currentUserId, followingId: targetUserId } },
    });

    if (!existing) {
      await prisma.follows.create({
        data: { followerId: currentUserId, followingId: targetUserId },
      });

      // Create FOLLOW notification
      try {
        const notification = await prisma.notification.create({
          data: {
            recipientId: targetUserId,
            senderId: currentUserId,
            type: 'FOLLOW',
          },
          include: {
            sender: {
              select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
            },
          },
        });

        // Real-time push
        const io = req.app.get('io');
        if (io) {
          io.to(`user_${targetUserId}`).emit('new_notification', notification);
        }
      } catch (_e) {
        // Non-fatal — notification failure should not block follow
      }
    }

    // Invalidate Redis cache for both users
    try {
      redis.del(`user:${currentUserId}`).catch(() => {});
      redis.del(`user:${targetUserId}`).catch(() => {});
    } catch (_cacheErr) {}

    res.json({ success: true, isFollowing: true });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/search/follow/:targetUserId
router.delete('/follow/:targetUserId', auth, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = req.user.id;

    await prisma.follows.deleteMany({
      where: { followerId: currentUserId, followingId: targetUserId },
    });

    // Invalidate Redis cache for both users
    try {
      redis.del(`user:${currentUserId}`).catch(() => {});
      redis.del(`user:${targetUserId}`).catch(() => {});
    } catch (_cacheErr) {}

    res.json({ success: true, isFollowing: false });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
