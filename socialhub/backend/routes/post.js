const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../config/db');
const { postsUpload, uploadToCloudinary } = require('../config/cloudinary');

const router = express.Router();

// Helper: format a single post for API response
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
  comments: (post.comments || [])
    .slice(-3) // last 3 comments for preview
    .map((c) => ({
      id: c.id,
      text: c.text,
      createdAt: c.createdAt,
      user: c.user
        ? {
            id: c.user.id,
            username: c.user.username,
            firstName: c.user.firstName,
            profilePicture: c.user.profilePicture,
          }
        : null,
    })),
});

// @route   GET /api/posts/feed
// @desc    Fetch feed posts (all posts ordered by most recent, with pagination)
router.get('/feed', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    const posts = await prisma.post.findMany({
      where: { isReel: false },
      include: {
        media: true,
        likes: true,
        comments: {
          include: { user: { select: { id: true, username: true, firstName: true, profilePicture: true } } },
          orderBy: { createdAt: 'asc' },
        },
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await prisma.post.count({ where: { isReel: false } });

    res.json({
      success: true,
      posts: posts.map((p) => formatPost(p, req.user.id)),
      pagination: { page, limit, total, hasMore: skip + posts.length < total },
    });
  } catch (error) {
    console.error('Feed fetch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/posts/reels
// @desc    Fetch video reels
router.get('/reels', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    let posts = await prisma.post.findMany({
      where: { isReel: true },
      include: {
        media: true,
        likes: true,
        comments: {
          include: { user: { select: { id: true, username: true, firstName: true, profilePicture: true } } },
          orderBy: { createdAt: 'asc' },
        },
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    let formattedReels = posts.map((p) => formatPost(p, req.user.id));

    // Fallback sample reels if DB has few or no reels yet
    if (formattedReels.length < 3) {
      const sampleReels = [
        {
          id: 'reel-sample-1',
          content: '🚀 Welcome to SocialHub Reels! Explore smooth 60fps vertical video playback #reels #viral',
          isReel: true,
          createdAt: new Date().toISOString(),
          userId: 'system-ai',
          user: {
            id: 'system-ai',
            username: 'socialhub_official',
            firstName: 'SocialHub',
            lastName: 'Team',
            profilePicture: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
          },
          media: [
            {
              id: 'm1',
              url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
              type: 'video',
            },
          ],
          likesCount: 1240,
          likedByMe: false,
          commentsCount: 88,
        },
        {
          id: 'reel-sample-2',
          content: '✨ Create, share, and stay connected with real-time video feeds! #creative #tech',
          isReel: true,
          createdAt: new Date().toISOString(),
          userId: 'system-ai-2',
          user: {
            id: 'system-ai-2',
            username: 'alex_creator',
            firstName: 'Alex',
            lastName: 'Rivers',
            profilePicture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          },
          media: [
            {
              id: 'm2',
              url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
              type: 'video',
            },
          ],
          likesCount: 3890,
          likedByMe: true,
          commentsCount: 240,
        },
        {
          id: 'reel-sample-3',
          content: '🔥 Daily motivation & tech highlights directly inside SocialHub! #explore #daily',
          isReel: true,
          createdAt: new Date().toISOString(),
          userId: 'system-ai-3',
          user: {
            id: 'system-ai-3',
            username: 'tech_insider',
            firstName: 'Tech',
            lastName: 'Hub',
            profilePicture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          },
          media: [
            {
              id: 'm3',
              url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
              type: 'video',
            },
          ],
          likesCount: 5620,
          likedByMe: false,
          commentsCount: 312,
        },
      ];

      formattedReels = [...formattedReels, ...sampleReels];
    }

    res.json({
      success: true,
      reels: formattedReels,
    });
  } catch (error) {
    console.error('Fetch reels error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/posts
router.post('/', auth, postsUpload.single('media'), async (req, res) => {
  try {
    const { content, isReel, mediaUrl, mediaType } = req.body;
    const userId = req.user.id;
    const isReelBool = isReel === 'true' || isReel === true;

    // Build media array
    const mediaItems = [];
    if (req.file) {
      const fileUrl = await uploadToCloudinary(
        req.file.buffer,
        'socialhub/posts',
        { resource_type: req.file.mimetype.startsWith('video') ? 'video' : 'image' }
      );
      mediaItems.push({ url: fileUrl, type: req.file.mimetype.startsWith('video') ? 'video' : 'image' });
    } else if (mediaUrl) {
      mediaItems.push({ url: mediaUrl, type: mediaType || 'image' });
    }

    const newPost = await prisma.post.create({
      data: {
        userId,
        content: content || '',
        isReel: isReelBool,
        media: { create: mediaItems }
      },
      include: { media: true, user: { select: { id: true, username: true, profilePicture: true } } }
    });

    // XP + level up logic
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { followers: true, following: true } });
    const postsCount = await prisma.post.count({ where: { userId } });

    let newXp = (user.xp || 0) + 500;
    let newLevel = user.level || 1;
    let achievements = user.achievements || [];

    if (newXp >= 10000) {
      newXp -= 10000;
      newLevel += 1;
      const badge = `Elite Level ${newLevel}`;
      if (!achievements.includes(badge)) achievements = [...achievements, badge];
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { postsCount, xp: newXp, level: newLevel, achievements },
      include: { followers: true, following: true }
    });

    const { password: _, ...userData } = updatedUser;
    const io = req.app.get('io');
    if (io) {
      const finalData = { ...userData, followersCount: updatedUser.followers.length, followingCount: updatedUser.following.length };
      io.to(`user_${userId}`).emit('user_updated', finalData);
      io.to(`profile_${userId}`).emit('profile_refreshed', finalData);
    }

    res.status(201).json({ success: true, post: newPost });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/posts/user/:userId
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      where: { userId: req.params.userId, isReel: false },
      include: {
        media: true,
        likes: true,
        comments: {
          include: { user: { select: { id: true, username: true, firstName: true, profilePicture: true } } },
          orderBy: { createdAt: 'asc' },
        },
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, posts: posts.map((p) => formatPost(p, req.user.id)) });
  } catch (error) {
    console.error('Fetch user posts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/posts/:postId/like
// @desc    Like a post
router.post('/:postId/like', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Check if already liked (unique constraint on [postId, userId])
    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      return res.status(400).json({ message: 'Post already liked' });
    }

    await prisma.like.create({ data: { postId, userId } });

    // Update likesReceived on post owner
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
    if (post && post.userId !== userId) {
      await prisma.user.update({
        where: { id: post.userId },
        data: { likesReceived: { increment: 1 } },
      });
    }

    const likesCount = await prisma.like.count({ where: { postId } });
    res.json({ success: true, liked: true, likesCount });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/posts/:postId/like
// @desc    Unlike a post
router.delete('/:postId/like', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    await prisma.like.deleteMany({ where: { postId, userId } });

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
    if (post && post.userId !== userId) {
      await prisma.user.update({
        where: { id: post.userId },
        data: { likesReceived: { decrement: 1 } },
      });
    }

    const likesCount = await prisma.like.count({ where: { postId } });
    res.json({ success: true, liked: false, likesCount });
  } catch (error) {
    console.error('Unlike post error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/posts/:postId/comments
// @desc    Add a comment to a post
router.post('/:postId/comments', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = await prisma.comment.create({
      data: { text: text.trim(), postId, userId },
      include: {
        user: { select: { id: true, username: true, firstName: true, profilePicture: true } },
      },
    });

    res.status(201).json({
      success: true,
      comment: {
        id: comment.id,
        text: comment.text,
        createdAt: comment.createdAt,
        user: comment.user,
      },
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/posts/:postId/comments
// @desc    Get all comments for a post
router.get('/:postId/comments', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const comments = await prisma.comment.findMany({
      where: { postId },
      include: {
        user: { select: { id: true, username: true, firstName: true, profilePicture: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      comments: comments.map((c) => ({
        id: c.id,
        text: c.text,
        createdAt: c.createdAt,
        user: c.user,
      })),
    });
  } catch (error) {
    console.error('Fetch comments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/posts/user/:userId (legacy, returns formatted posts)
// @desc    Fetch user's posts (formatted)
router.get('/user/:userId/legacy', auth, async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      where: { userId: req.params.userId },
      include: { media: true, likes: true, comments: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, posts: posts.map((p) => formatPost(p, req.user.id)) });
  } catch (error) {
    console.error('Fetch user posts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
