const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const redis = require('../config/redis');
const auth = require('../middleware/auth');
const { upload, uploadToCloudinary } = require('../config/cloudinary');
const { sendVerificationEmail, sendWelcomeEmail, generateVerificationToken } = require('../services/emailService');
const { OAuth2Client } = require('google-auth-library');
const appleSignin = require('apple-signin-auth');
const { handleAccountLinking } = require('../services/socialAuthService');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallbacksecret', {
    expiresIn: process.env.JWT_EXPIRE || '3650d' // 10 years expiry for persistent login
  });
};

// @route   POST /api/auth/signup
// @desc    Register a new user
router.post('/signup', upload.single('profilePicture'), async (req, res) => {
  try {
    const { firstName, lastName, username, email, phoneNumber, dateOfBirth, gender, password, biometrics, bio } = req.body;

    // Support both nested and flat dateOfBirth for flexibility
    // Handle arrays (when both flat and nested are sent)
    const rawDay = dateOfBirth?.day || req.body.day;
    const rawMonth = dateOfBirth?.month || req.body.month;
    const rawYear = dateOfBirth?.year || req.body.year;
    const day = Array.isArray(rawDay) ? rawDay[0] : rawDay;
    const month = Array.isArray(rawMonth) ? rawMonth[0] : rawMonth;
    const year = Array.isArray(rawYear) ? rawYear[0] : rawYear;

    if (!firstName || !username || !password || !gender || !day || !month || !year) {
      console.log('Missing fields:', { firstName: !!firstName, username: !!username, password: !!password, gender: !!gender, day: !!day, month: !!month, year: !!year });
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const usernameLower = username.toLowerCase();

    const existingUsername = await prisma.user.findUnique({ where: { username: usernameLower } });
    if (existingUsername) return res.status(400).json({ message: 'Username already taken' });

    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existingEmail) return res.status(400).json({ message: 'Email already registered' });
    }

    if (phoneNumber) {
      const existingPhone = await prisma.user.findUnique({ where: { phoneNumber: phoneNumber.trim() } });
      if (existingPhone) {
        // Phone already registered — only auto-login if username is ALSO the same
        // (i.e. account recovery). If different username, reject with clear message.
        if (existingPhone.username === usernameLower) {
          const token = generateToken(existingPhone.id);
          const { password: _, ...userData } = existingPhone;
          return res.status(200).json({
            success: true, token, user: userData, accountRecovered: true,
            message: 'An account with this number already exists. You have been logged in.'
          });
        }
        return res.status(400).json({ message: 'This phone number is already registered to another account.' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Parse biometrics if it came as a JSON string from FormData
    let biometricsData = null;
    if (biometrics) {
      try {
        biometricsData = typeof biometrics === 'string' ? JSON.parse(biometrics) : biometrics;
      } catch (e) {
        biometricsData = null;
      }
    }

    // Upload profile picture if provided — non-blocking
    let profilePictureUrl = null;
    if (req.file) {
      try {
        profilePictureUrl = await uploadToCloudinary(req.file.buffer, 'socialhub/profiles');
      } catch (uploadErr) {
        console.error('[Signup] Profile pic upload failed (non-fatal):', uploadErr.message);
      }
    }

    const user = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: (lastName || '').trim(),
        username: usernameLower,
        email: email ? email.toLowerCase() : null,
        phoneNumber: phoneNumber ? phoneNumber.trim() : null,
        dobDay: day, dobMonth: month, dobYear: year, gender,
        password: hashedPassword,
        bio: bio || '',
        biometrics: biometricsData,
        emailVerified: true,
        profilePicture: profilePictureUrl
      }
    });

    const token = generateToken(user.id);
    const { password: _, ...userData } = user;

    return res.status(201).json({
      success: true, token, user: userData
    });
  } catch (error) {
    console.error('Signup error FULL:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/auth/users
// @desc    Get all users for contact selection
router.get('/users', auth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, email: true, isOnline: true }
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'Missing idToken' });

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub, email, given_name, family_name, picture } = payload;

    const result = await handleAccountLinking({
      provider: 'google', providerId: sub, email, firstName: given_name, lastName: family_name, profilePicture: picture
    });

    res.json({ success: true, user: result.user, accessToken: result.tokens.accessToken, refreshToken: result.tokens.refreshToken, token: result.tokens.accessToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token', error: error.message });
  }
});

// @route   POST /api/auth/facebook
router.post('/facebook', async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ message: 'Missing accessToken' });

    const fbRes = await fetch(`https://graph.facebook.com/me?fields=id,name,first_name,last_name,email,picture.type(large)&access_token=${accessToken}`);
    const fbData = await fbRes.json();
    if (fbData.error) return res.status(401).json({ message: 'Invalid Facebook token', error: fbData.error.message });

    const { id, first_name, last_name, email, picture } = fbData;
    const result = await handleAccountLinking({
      provider: 'facebook', providerId: id, email, firstName: first_name, lastName: last_name, profilePicture: picture?.data?.url
    });

    res.json({ success: true, user: result.user, accessToken: result.tokens.accessToken, refreshToken: result.tokens.refreshToken, token: result.tokens.accessToken });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/auth/apple
router.post('/apple', async (req, res) => {
  try {
    const { identityToken, fullName } = req.body;
    if (!identityToken) return res.status(400).json({ message: 'Missing identityToken' });

    const appleIdTokenClaims = await appleSignin.verifyIdToken(identityToken, {
      audience: process.env.APPLE_SERVICE_ID,
      ignoreExpiration: true
    });

    const { sub, email } = appleIdTokenClaims;
    const result = await handleAccountLinking({
      provider: 'apple', providerId: sub, email, firstName: fullName?.givenName, lastName: fullName?.familyName
    });

    res.json({ success: true, user: result.user, accessToken: result.tokens.accessToken, refreshToken: result.tokens.refreshToken, token: result.tokens.accessToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token', error: error.message });
  }
});

// @route   POST /api/auth/refresh-token
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh_secret');
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || !user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const accessToken = jwt.sign({ id: user.id }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'access_secret', { expiresIn: '1h' });
    res.json({ success: true, accessToken, token: accessToken });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
});

// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    let { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Provide credentials' });

    const usernameLower = username.toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: usernameLower },
          { email: usernameLower },
          { phoneNumber: username.trim() }
        ]
      }
    });

    if (!user) return res.status(401).json({ message: 'No account found with these credentials' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password' });

    const token = generateToken(user.id);
    const { password: _, ...userData } = user;
    return res.json({ success: true, token, user: userData });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const cacheKey = `user:${req.user.id}`;

    // Try Redis cache first — gracefully skip if Redis is down
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return res.json({ success: true, ...data, fromCache: true });
      }
    } catch (_cacheErr) {
      // Redis unavailable — fall through to DB query
    }

    // Cache miss — query DB
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { followers: true, following: true }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const posts = await prisma.post.findMany({
      where: { userId: req.user.id },
      include: { media: true },
      orderBy: { createdAt: 'desc' }
    });

    const { password: _, ...userData } = user;
    const responseData = {
      user: { ...userData, followersCount: user.followers.length, followingCount: user.following.length, postsCount: posts.length },
      posts
    };

    // Cache for 5 minutes — gracefully skip if Redis is down
    try {
      await redis.set(cacheKey, JSON.stringify(responseData), { ex: 300 });
    } catch (_cacheErr) {
      // Redis unavailable — continue without caching
    }

    return res.json({ success: true, ...responseData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/auth/update-profile
router.put('/update-profile', auth, express.json({ limit: '20mb' }), async (req, res) => {
  try {
    console.log('=== UPDATE PROFILE DEBUG ===');
    console.log('Body keys:', Object.keys(req.body));
    console.log('Has profilePictureBase64:', !!req.body.profilePictureBase64);
    console.log('Has profileCoverBase64:', !!req.body.profileCoverBase64);
    console.log('============================');

    const {
      firstName, lastName, bio, username, socialLinks,
      website, address, day, month, year,
      profilePicture: reqPicUrl,
      profileCover: reqCoverUrl,
      profilePictureBase64,
      profileCoverBase64,
    } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { followers: true, following: true } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    let updateData = {};
    if (firstName !== undefined && firstName !== null) updateData.firstName = firstName.trim() || user.firstName;
    if (lastName !== undefined && lastName !== null) updateData.lastName = lastName.trim();
    if (bio !== undefined) updateData.bio = bio;
    if (website !== undefined) updateData.website = website;
    if (address !== undefined) updateData.address = address;

    if (day && month && year) {
      updateData.dobDay = day; updateData.dobMonth = month; updateData.dobYear = year;
    }
    if (socialLinks) updateData.socialLinks = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks;

    // Handle profile picture — base64 upload takes priority over plain URL
    if (profilePictureBase64) {
      try {
        // base64 string: "data:image/jpeg;base64,/9j/4AAQ..."
        const base64Data = profilePictureBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        updateData.profilePicture = await uploadToCloudinary(buffer, 'socialhub/profiles', {
          transformation: [{ width: 500, height: 500, crop: 'limit' }]
        });
        console.log('[Upload] Profile picture uploaded:', updateData.profilePicture);
      } catch (uploadErr) {
        console.error('[Upload] Profile picture FAILED:', uploadErr.message);
        return res.status(500).json({ success: false, message: 'Image upload failed. Please try again.' });
      }
    } else if (reqPicUrl && reqPicUrl.startsWith('http')) {
      updateData.profilePicture = reqPicUrl;
    }

    // Handle cover photo
    if (profileCoverBase64) {
      try {
        const base64Data = profileCoverBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        updateData.profileCover = await uploadToCloudinary(buffer, 'socialhub/covers', {
          transformation: [{ width: 1200, height: 400, crop: 'limit' }]
        });
        console.log('[Upload] Cover uploaded:', updateData.profileCover);
      } catch (uploadErr) {
        console.error('[Upload] Cover FAILED:', uploadErr.message);
        return res.status(500).json({ success: false, message: 'Cover upload failed. Please try again.' });
      }
    } else if (reqCoverUrl && reqCoverUrl.startsWith('http')) {
      updateData.profileCover = reqCoverUrl;
    }

    if (username && username.toLowerCase() !== user.username) {
      const cleanUsername = username.toLowerCase().trim();
      if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername) || cleanUsername.length < 3 || cleanUsername.length > 20) {
        return res.status(400).json({ message: 'Invalid username format' });
      }

      const existing = await prisma.user.findUnique({ where: { username: cleanUsername } });
      if (existing) return res.status(400).json({ message: 'Username already taken' });

      if (user.lastUsernameChange) {
        const daysSinceLastChange = (new Date().getTime() - new Date(user.lastUsernameChange).getTime()) / (1000 * 3600 * 24);
        if (daysSinceLastChange < 120) return res.status(400).json({ message: `You can only change your username once every 120 days.` });
      }

      updateData.username = cleanUsername;
      updateData.lastUsernameChange = new Date();
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      include: { followers: true, following: true }
    });
    
    const { password: _, ...userData } = updatedUser;
    const finalData = { ...userData, followersCount: updatedUser.followers.length, followingCount: updatedUser.following.length };

    // Invalidate Redis cache — gracefully skip if Redis is down
    try {
      await redis.del(`user:${req.user.id}`);
    } catch (_cacheErr) {
      // Redis unavailable — continue
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${updatedUser.id}`).emit('user_updated', finalData);
      io.to(`profile_${updatedUser.id}`).emit('profile_refreshed', finalData);
    }
    
    res.json({ success: true, user: finalData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/auth/check-username
router.post('/check-username', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: 'Username is required' });

    const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    res.json({ available: !user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/check-email
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    res.json({ available: !user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login-otp
router.post('/login-otp', async (req, res) => {
  try {
    const { identifier, type } = req.body;
    if (!identifier || !type) return res.status(400).json({ message: 'Identifier and type are required' });

    const { isVerified } = require('../services/otpService');
    if (!await isVerified(identifier)) return res.status(400).json({ message: 'Please request and verify OTP first.' });

    const query = type === 'email' ? { email: identifier.toLowerCase().trim() } : { phoneNumber: identifier.trim() };
    const user = await prisma.user.findFirst({ where: query });

    if (!user) return res.json({ success: true, exists: false, message: 'OTP verified. Proceed to signup.' });

    const token = generateToken(user.id);
    const { password: _, ...userData } = user;
    res.json({ success: true, exists: true, token, user: userData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/auth/profile-settings
router.put('/profile-settings', auth, async (req, res) => {
  try {
    const { profileTheme, profileFrame, claimTodayReward } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { followers: true, following: true } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    let updateData = {};
    if (profileTheme !== undefined) updateData.profileTheme = profileTheme;
    if (profileFrame !== undefined) updateData.profileFrame = profileFrame;

    let didLevelUp = false;
    let gainedXp = 0;
    if (claimTodayReward) {
      if (user.todayRewardClaimed) return res.status(400).json({ message: 'Reward already claimed for today' });

      updateData.todayRewardClaimed = true;
      updateData.coins = (user.coins || 0) + 50;
      gainedXp = 2500;
      let newXp = (user.xp || 0) + gainedXp;
      
      if (newXp >= 10000) {
        newXp -= 10000;
        updateData.level = (user.level || 1) + 1;
        didLevelUp = true;
        const newBadge = `Elite Level ${updateData.level}`;
        const currentAchievements = user.achievements || [];
        if (!currentAchievements.includes(newBadge)) {
          updateData.achievements = [...currentAchievements, newBadge];
        }
      }
      updateData.xp = newXp;
      updateData.weeklyProgress = Math.min(100, (user.weeklyProgress || 80) + 10);
    }

    const updatedUser = await prisma.user.update({ where: { id: req.user.id }, data: updateData, include: { followers: true, following: true } });
    const { password: _, ...userData } = updatedUser;
    const finalData = { ...userData, followersCount: updatedUser.followers.length, followingCount: updatedUser.following.length };

    const io = req.app.get('io');
    if (io) io.to(`user_${updatedUser.id}`).emit('user_updated', finalData);

    res.json({ success: true, user: finalData, didLevelUp, gainedXp, level: updatedUser.level });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/auth/highlights
router.put('/highlights', auth, async (req, res) => {
  try {
    const { title, image } = req.body;
    if (!title || !image) return res.status(400).json({ message: 'Title and image are required' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { followers: true, following: true } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const currentHighlights = user.highlights ? (Array.isArray(user.highlights) ? user.highlights : []) : [];
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { highlights: [...currentHighlights, { title, image }] },
      include: { followers: true, following: true }
    });

    const { password: _, ...userData } = updatedUser;
    const finalData = { ...userData, followersCount: updatedUser.followers.length, followingCount: updatedUser.following.length };

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${updatedUser.id}`).emit('user_updated', finalData);
      io.to(`profile_${updatedUser.id}`).emit('profile_refreshed', finalData);
    }

    res.json({ success: true, user: finalData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/auth/logout
router.post('/logout', auth, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user && refreshToken) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { refreshTokens: user.refreshTokens.filter(t => t !== refreshToken) }
      });
    }
    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { identifier, type } = req.body;
    if (!identifier || !type) return res.status(400).json({ message: 'Identifier and type are required' });

    const { isVerified } = require('../services/otpService');
    if (!await isVerified(identifier)) return res.status(400).json({ success: false, message: 'OTP not verified.' });

    const query = type === 'email' ? { email: identifier.toLowerCase().trim() } : { phoneNumber: identifier.trim() };
    const user = await prisma.user.findFirst({ where: query });
    if (!user) return res.status(404).json({ success: false, message: 'No account found.' });

    res.json({ success: true, message: 'Identity verified. You may now reset your password.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { identifier, type, newPassword } = req.body;
    if (!identifier || !type || !newPassword) return res.status(400).json({ message: 'identifier, type, and newPassword are required' });
    if (newPassword.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });

    const { isVerified } = require('../services/otpService');
    if (!await isVerified(identifier)) return res.status(400).json({ success: false, message: 'Session expired.' });

    const query = type === 'email' ? { email: identifier.toLowerCase().trim() } : { phoneNumber: identifier.trim() };
    const user = await prisma.user.findFirst({ where: query });
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, refreshTokens: [] }
    });

    const token = generateToken(updatedUser.id);
    const { password: _, ...userData } = updatedUser;

    res.json({ success: true, message: 'Password reset successfully.', token, user: userData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/auth/quick-login
// @desc    Login via Phone Number + Biometric (FaceID/Fingerprint)
router.post('/quick-login', async (req, res) => {
  try {
    const { phoneNumber, biometricSuccess } = req.body;
    
    if (!phoneNumber) return res.status(400).json({ message: 'Phone number is required for Quick Login' });
    if (!biometricSuccess) return res.status(401).json({ message: 'Biometric verification failed on device' });

    const user = await prisma.user.findUnique({
      where: { phoneNumber: phoneNumber.trim() }
    });

    if (!user) {
      return res.status(404).json({ message: 'No account found with this phone number' });
    }

    // Since biometric was successful on the device, we log them in directly
    const token = generateToken(user.id);
    const { password: _, ...userData } = user;
    
    console.log(`✅ Quick Login successful for user: ${user.username} (${phoneNumber}) via Biometrics`);
    return res.json({ success: true, token, user: userData });
  } catch (error) {
    console.error('Quick login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
