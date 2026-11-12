const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../config/db');
const redis = require('../config/redis');
const { postsUpload, uploadToCloudinary, cloudinary } = require('../config/cloudinary');

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
  likesCount: post._count?.likes ?? (post.likes || []).length,
  likedByMe: (post.likes || []).some((l) => l.userId === currentUserId),
  commentsCount: post._count?.comments ?? (post.comments || []).length,
  savedByMe: (post.saves || []).some((s) => s.userId === currentUserId),
  comments: (post.comments || [])
    .slice(-3)
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

// Helper: create notification safely (non-blocking)
const createNotification = async (data) => {
  try {
    await prisma.notification.create({ data });
  } catch (_e) {
    // Notification failure should never break core functionality
  }
};

// Helper: emit socket event safely (non-blocking)
const emitNotification = (io, userId, notification) => {
  try {
    if (io) {
      io.to(`user_${userId}`).emit('new_notification', notification);
    }
  } catch (_e) {}
};

// @route   GET /api/posts/feed
router.get('/feed', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;
    const currentUserId = req.user.id;
    const cacheKey = `feed:p1:${currentUserId}`;

    // Redis cache for page 1
    if (page === 1) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
          return res.json({ success: true, ...parsed, fromCache: true });
        }
      } catch (_cacheErr) {
        // Fall back gracefully to DB
      }
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: { isReel: false },
        include: {
          media: true,
          _count: { select: { likes: true, comments: true } },
          likes: { where: { userId: currentUserId }, select: { userId: true } },
          saves: { where: { userId: currentUserId }, select: { userId: true } },
          comments: {
            take: 3,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { id: true, username: true, firstName: true, profilePicture: true } } },
          },
          user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.post.count({ where: { isReel: false } })
    ]);

    const responsePayload = {
      posts: posts.map((p) => formatPost(p, currentUserId)),
      pagination: { page, limit, total, hasMore: skip + posts.length < total },
    };

    if (page === 1) {
      try {
        redis.set(cacheKey, JSON.stringify(responsePayload), { ex: 45 }).catch(() => {});
      } catch (_setErr) {}
    }

    res.json({
      success: true,
      ...responsePayload,
    });
  } catch (error) {
    console.error('Feed fetch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/posts/reels
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
        saves: true,
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

    // Fallback sample reels if DB has none yet
    if (formattedReels.length < 3) {
      const sampleReels = [
        {
          id: 'reel-sample-1',
          content: '🚀 Welcome to SocialHub Reels! Explore smooth 60fps vertical video playback #reels #viral',
          isReel: true,
          createdAt: new Date().toISOString(),
          userId: 'system-ai',
          user: { id: 'system-ai', username: 'socialhub_official', firstName: 'SocialHub', lastName: 'Team', profilePicture: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150' },
          media: [{ id: 'm1', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', type: 'video' }],
          likesCount: 1240, likedByMe: false, commentsCount: 88, savedByMe: false,
        },
        {
          id: 'reel-sample-2',
          content: '✨ Create, share, and stay connected with real-time video feeds! #creative #tech',
          isReel: true,
          createdAt: new Date().toISOString(),
          userId: 'system-ai-2',
          user: { id: 'system-ai-2', username: 'alex_creator', firstName: 'Alex', lastName: 'Rivers', profilePicture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
          media: [{ id: 'm2', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', type: 'video' }],
          likesCount: 3890, likedByMe: true, commentsCount: 240, savedByMe: false,
        },
        {
          id: 'reel-sample-3',
          content: '🔥 Daily motivation & tech highlights directly inside SocialHub! #explore #daily',
          isReel: true,
          createdAt: new Date().toISOString(),
          userId: 'system-ai-3',
          user: { id: 'system-ai-3', username: 'tech_insider', firstName: 'Tech', lastName: 'Hub', profilePicture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
          media: [{ id: 'm3', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', type: 'video' }],
          likesCount: 5620, likedByMe: false, commentsCount: 312, savedByMe: false,
        },
      ];
      formattedReels = [...formattedReels, ...sampleReels];
    }

    res.json({ success: true, reels: formattedReels });
  } catch (error) {
    console.error('Fetch reels error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/posts/saved
// @desc    Get all saved/bookmarked posts for current user
// ⚠️  MUST be registered before /:postId param routes to avoid Express interception
router.get('/saved', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const savedRecords = await prisma.savedPost.findMany({
      where: { userId },
      include: {
        post: {
          include: {
            media: true,
            likes: true,
            saves: true,
            comments: {
              include: { user: { select: { id: true, username: true, firstName: true, profilePicture: true } } },
              orderBy: { createdAt: 'asc' },
            },
            user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const posts = savedRecords
      .filter((s) => s.post !== null)
      .map((s) => formatPost(s.post, userId));

    res.json({ success: true, posts });
  } catch (error) {
    console.error('Get saved posts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/posts/upload-signature
// @desc    Generate Cloudinary upload signature for client-side direct uploads
router.get('/upload-signature', auth, (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = 'socialhub/posts';
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      process.env.CLOUDINARY_API_SECRET
    );
    res.json({
      success: true,
      signature,
      timestamp,
      folder,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (error) {
    console.error('Upload signature error:', error);
    res.status(500).json({ message: 'Could not generate upload signature', error: error.message });
  }
});

// Safe multer middleware that does not break on JSON requests or file filter warnings
const safePostsUpload = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json')) {
    return next();
  }
  postsUpload.single('media')(req, res, (err) => {
    if (err) {
      console.warn('[postsUpload] Multer notice:', err.message);
      req.fileValidationError = err.message;
    }
    next();
  });
};

// @route   POST /api/posts
router.post('/', auth, safePostsUpload, async (req, res) => {
  try {
    const { content, isReel, mediaUrl, mediaType, mediaBase64, imageBase64 } = req.body;
    const userId = req.user.id;
    const isReelBool = isReel === 'true' || isReel === true;

    const VIDEO_EXTS = /\.(mp4|mov|avi|mkv|webm|3gp|m4v|quicktime)$/i;
    const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/avi',
      'video/x-matroska', 'video/webm', 'video/3gpp', 'video/x-m4v'];

    const isVideoFile = (mimetype, originalname) => {
      if (mimetype && VIDEO_MIMES.includes(mimetype)) return true;
      if (mimetype && mimetype.startsWith('video/')) return true;
      if (originalname && VIDEO_EXTS.test(originalname)) return true;
      return false;
    };

    const mediaItems = [];

    // 1. Upload from multipart file buffer (FormData)
    if (req.file && req.file.buffer) {
      const isVideo = isVideoFile(req.file.mimetype, req.file.originalname) || isReelBool;
      try {
        const fileUrl = await uploadToCloudinary(
          req.file.buffer,
          'socialhub/posts',
          {
            resource_type: isVideo ? 'video' : 'auto',
            ...(isVideo ? { chunk_size: 6000000 } : {}),
          }
        );
        if (fileUrl) {
          mediaItems.push({ url: fileUrl, type: isVideo ? 'video' : 'image' });
        }
      } catch (uploadErr) {
        console.error('[post] Multipart upload error:', uploadErr.message);
        throw new Error('Failed to upload media file. ' + (uploadErr.message || ''));
      }
    }
    // 2. Upload from base64 string (JSON upload - highly resilient for web, Android & iOS)
    else if (mediaBase64 || imageBase64) {
      const rawBase64 = mediaBase64 || imageBase64;
      const isVideo = isReelBool || (typeof rawBase64 === 'string' && rawBase64.startsWith('data:video/'));
      try {
        const fileUrl = await uploadToCloudinary(
          rawBase64,
          'socialhub/posts',
          {
            resource_type: isVideo ? 'video' : 'auto',
          }
        );
        if (fileUrl) {
          mediaItems.push({ url: fileUrl, type: isVideo ? 'video' : 'image' });
        }
      } catch (uploadErr) {
        console.error('[post] Base64 upload error:', uploadErr.message);
        throw new Error('Failed to upload media. ' + (uploadErr.message || ''));
      }
    }
    // 3. Existing media URL or data URI in mediaUrl
    else if (mediaUrl) {
      if (typeof mediaUrl === 'string' && mediaUrl.startsWith('data:')) {
        const isVideo = isReelBool || mediaUrl.startsWith('data:video/');
        const fileUrl = await uploadToCloudinary(mediaUrl, 'socialhub/posts', {
          resource_type: isVideo ? 'video' : 'auto',
        });
        mediaItems.push({ url: fileUrl, type: isVideo ? 'video' : 'image' });
      } else {
        const detectedType = mediaType ||
          (VIDEO_EXTS.test(mediaUrl) || /\/video\/upload\//i.test(mediaUrl) ? 'video' : 'image');
        mediaItems.push({ url: mediaUrl, type: detectedType });
      }
    }

    // Auto-classify all video uploads as Reels so they appear in both Reels tab & user reels
    const hasVideo = isReelBool || mediaItems.some((m) => m.type === 'video');

    const newPost = await prisma.post.create({
      data: {
        userId,
        content: content || '',
        isReel: hasVideo,
        media: { create: mediaItems }
      },
      include: {
        media: true,
        likes: true,
        saves: true,
        comments: true,
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } }
      }
    });

    // XP + level up logic (non-blocking: gamification failure should never fail post creation)
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { followers: true, following: true } });
      if (user) {
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
          const finalData = {
            ...userData,
            followersCount: updatedUser.followers.length,
            followingCount: updatedUser.following.length
          };
          io.to(`user_${userId}`).emit('user_updated', finalData);
          io.to(`profile_${userId}`).emit('profile_refreshed', finalData);
        }
      }
    } catch (xpErr) {
      console.warn('[post] XP update warning (non-fatal):', xpErr.message);
    }

    // Invalidate Redis caches for user & feed
    try {
      redis.del(`user:${userId}`).catch(() => {});
      redis.del(`feed:p1:${userId}`).catch(() => {});
    } catch (_cacheDelErr) {}

    res.status(201).json({ success: true, post: formatPost(newPost, userId) });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: error.message || 'Server error', error: error.message });
  }
});

// @route   DELETE /api/posts/:postId
// @desc    Delete own post (owner only)
router.delete('/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ message: 'You can only delete your own posts' });
    }

    // Delete in correct dependency order
    await prisma.like.deleteMany({ where: { postId } });
    await prisma.comment.deleteMany({ where: { postId } });
    await prisma.savedPost.deleteMany({ where: { postId } });
    await prisma.media.deleteMany({ where: { postId } });
    await prisma.post.delete({ where: { id: postId } });

    // Decrement postsCount
    const newCount = await prisma.post.count({ where: { userId } });
    await prisma.user.update({ where: { id: userId }, data: { postsCount: newCount } });

    // Notify user's profile to refresh
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('post_deleted', { postId });
      io.to(`profile_${userId}`).emit('post_deleted', { postId });
    }

    // Invalidate Redis caches
    try {
      redis.del(`user:${userId}`).catch(() => {});
      redis.del(`feed:p1:${userId}`).catch(() => {});
    } catch (_cacheDelErr) {}

    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
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
        saves: true,
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

// @route   GET /api/posts/user/:userId/reels
router.get('/user/:userId/reels', auth, async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      where: { userId: req.params.userId, isReel: true },
      include: {
        media: true,
        likes: true,
        saves: true,
        comments: { orderBy: { createdAt: 'asc' } },
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, posts: posts.map((p) => formatPost(p, req.user.id)) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/posts/:postId/like
router.post('/:postId/like', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      return res.status(400).json({ message: 'Post already liked' });
    }

    await prisma.like.create({ data: { postId, userId } });

    // Update likesReceived on post owner + create notification
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true, content: true },
    });

    if (post && post.userId !== userId) {
      await prisma.user.update({
        where: { id: post.userId },
        data: { likesReceived: { increment: 1 } },
      });

      // Create LIKE notification
      const notification = await prisma.notification.create({
        data: {
          recipientId: post.userId,
          senderId: userId,
          type: 'LIKE',
          postId,
        },
        include: {
          sender: {
            select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
          },
        },
      });

      // Real-time push to recipient
      const io = req.app.get('io');
      emitNotification(io, post.userId, notification);
    }

    const likesCount = await prisma.like.count({ where: { postId } });
    res.json({ success: true, liked: true, likesCount });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/posts/:postId/like
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

// @route   POST /api/posts/:postId/save
// @desc    Save / bookmark a post (toggle)
router.post('/:postId/save', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const existing = await prisma.savedPost.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      // Already saved — unsave it
      await prisma.savedPost.delete({ where: { postId_userId: { postId, userId } } });
      return res.json({ success: true, saved: false });
    }

    // Save it
    await prisma.savedPost.create({ data: { postId, userId } });
    res.json({ success: true, saved: true });
  } catch (error) {
    console.error('Save post error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/posts/:postId/comments
router.post('/:postId/comments', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = await prisma.comment.create({
      data: { text: text.trim(), postId, userId },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
      },
    });

    // Send instant 201 response immediately (don't block client for notification write)
    res.status(201).json({
      success: true,
      comment: {
        id: comment.id,
        text: comment.text,
        createdAt: comment.createdAt,
        user: comment.user,
      },
    });

    // Asynchronously create COMMENT notification for post owner (non-blocking)
    if (post.userId !== userId) {
      prisma.notification
        .create({
          data: {
            recipientId: post.userId,
            senderId: userId,
            type: 'COMMENT',
            postId,
          },
          include: {
            sender: {
              select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
            },
          },
        })
        .then((notification) => {
          if (notification) {
            const io = req.app.get('io');
            emitNotification(io, post.userId, notification);
          }
        })
        .catch(() => {});
    }
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/posts/:postId/comments
router.get('/:postId/comments', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const comments = await prisma.comment.findMany({
      where: { postId },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
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

// @route   POST /api/posts/:postId/report
// @desc    Report a post
router.post('/:postId/report', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason = 'inappropriate' } = req.body;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, userId: true } });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    // Prevent duplicate reports from same user
    const existing = await prisma.report.findFirst({
      where: { reporterId: userId, postId },
    });
    if (existing) {
      return res.json({ success: true, message: 'Already reported' });
    }

    await prisma.report.create({
      data: {
        reporterId: userId,
        reportedUserId: post.userId,
        postId,
        reason,
        type: 'POST',
      },
    });

    res.json({ success: true, message: 'Post reported successfully' });
  } catch (error) {
    console.error('Report post error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
