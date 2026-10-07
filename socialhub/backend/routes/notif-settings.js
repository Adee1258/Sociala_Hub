const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../config/db');

const router = express.Router();

// @route   GET /api/notif-settings
// @desc    Get notification preferences
router.get('/', auth, async (req, res) => {
  try {
    let notifSettings = await prisma.notificationSettings.findUnique({
      where: { userId: req.user.id },
    });
    if (!notifSettings) {
      notifSettings = await prisma.notificationSettings.create({
        data: { userId: req.user.id },
      });
    }
    res.json({ success: true, notifSettings });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/notif-settings
// @desc    Update notification preferences
router.put('/', auth, async (req, res) => {
  try {
    const allowedFields = [
      'likes', 'comments', 'replies', 'followers', 'friendRequests',
      'messages', 'mentions', 'tags',
      'gameNotifs', 'rewardNotifs', 'challengeNotifs', 'achievementNotifs',
      'aiRecommendations', 'systemAnnouncements',
    ];

    const data = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    });

    const notifSettings = await prisma.notificationSettings.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, ...data },
      update: data,
    });

    res.json({ success: true, notifSettings });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
