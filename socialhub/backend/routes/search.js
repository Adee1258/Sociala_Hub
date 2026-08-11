const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../config/db');

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

// @route   GET /api/search
// @desc    Search users, posts, and return trending tags
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
      // If query is empty, suggest recommended users & recent posts
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

    const trendingTags = [
      { id: '1', tag: '#SocialHub', count: '14.2k posts' },
      { id: '2', tag: '#TechTrends', count: '9.8k posts' },
      { id: '3', tag: '#MobileDev', count: '6.5k posts' },
      { id: '4', tag: '#ReactNative', count: '5.1k posts' },
      { id: '5', tag: '#AIRevolution', count: '4.7k posts' },
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
// @desc    Follow a user
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

      // Create notification for target user
      try {
        await prisma.notification.create({
          data: {
            recipientId: targetUserId,
            senderId: currentUserId,
            type: 'FOLLOW',
          },
        });
      } catch (_e) {
        // Notification model will be added in Phase 3
      }
    }

    res.json({ success: true, isFollowing: true });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/search/follow/:targetUserId
// @desc    Unfollow a user
router.delete('/follow/:targetUserId', auth, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = req.user.id;

    await prisma.follows.deleteMany({
      where: { followerId: currentUserId, followingId: targetUserId },
    });

    res.json({ success: true, isFollowing: false });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
