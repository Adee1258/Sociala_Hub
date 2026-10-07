const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../config/db');

const router = express.Router();

// Helper: get or create user settings with defaults
async function getOrCreateSettings(userId) {
  let settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings) {
    settings = await prisma.userSettings.create({ data: { userId } });
  }
  return settings;
}

// @route   GET /api/settings
// @desc    Get user app settings
router.get('/', auth, async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.user.id);
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/settings
// @desc    Update user app settings
router.put('/', auth, async (req, res) => {
  try {
    const allowedFields = [
      'darkMode', 'language', 'soundEnabled', 'vibrationEnabled', 'autoplay', 'dataSaver',
      'gameSound', 'gameVibration', 'showGameActivity', 'showGameAchievements',
      'showLeaderboardRank', 'allowFriendChallenge',
      'aiRecommendations', 'aiPersonalization',
      'readReceipts', 'typingIndicator', 'showOnlineStatus', 'messageRequestsFrom',
    ];

    const data = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    });

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, ...data },
      update: data,
    });

    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
