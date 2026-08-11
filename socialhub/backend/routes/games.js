const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../config/db');

const router = express.Router();

// @route   POST /api/games/claim-daily
// @desc    Claim daily login reward (coins + XP + streak)
router.get('/daily-status', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        todayRewardClaimed: true,
        streakCount: true,
        coins: true,
        xp: true,
        level: true,
      },
    });

    res.json({ success: true, ...user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/games/claim-daily
router.post('/claim-daily', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.todayRewardClaimed) {
      return res.status(400).json({ message: 'Daily reward already claimed today!' });
    }

    const bonusCoins = 150;
    const bonusXp = 500;
    let newXp = (user.xp || 0) + bonusXp;
    let newLevel = user.level || 1;
    let didLevelUp = false;

    if (newXp >= 10000) {
      newXp -= 10000;
      newLevel += 1;
      didLevelUp = true;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        coins: (user.coins || 0) + bonusCoins,
        xp: newXp,
        level: newLevel,
        streakCount: (user.streakCount || 0) + 1,
        todayRewardClaimed: true,
        weeklyProgress: Math.min(100, (user.weeklyProgress || 50) + 15),
      },
      select: {
        id: true,
        coins: true,
        xp: true,
        level: true,
        streakCount: true,
        todayRewardClaimed: true,
        weeklyProgress: true,
      },
    });

    res.json({
      success: true,
      message: `🎉 Claimed ${bonusCoins} Coins & ${bonusXp} XP!`,
      user: updatedUser,
      didLevelUp,
    });
  } catch (error) {
    console.error('Claim daily error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/games/play-reward
// @desc    Reward coins & XP for completing a mini-game
router.post('/play-reward', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { gameName, coinsEarned = 50, xpEarned = 200 } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    let newXp = (user.xp || 0) + xpEarned;
    let newLevel = user.level || 1;
    let didLevelUp = false;

    if (newXp >= 10000) {
      newXp -= 10000;
      newLevel += 1;
      didLevelUp = true;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        coins: (user.coins || 0) + coinsEarned,
        xp: newXp,
        level: newLevel,
      },
      select: {
        id: true,
        coins: true,
        xp: true,
        level: true,
      },
    });

    res.json({
      success: true,
      message: `🎮 ${gameName || 'Game'} Complete! +${coinsEarned} Coins & +${xpEarned} XP`,
      user: updatedUser,
      didLevelUp,
    });
  } catch (error) {
    console.error('Play reward error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/games/leaderboard
// @desc    Get top players leaderboard
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const topUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
        coins: true,
        level: true,
        xp: true,
        streakCount: true,
      },
      orderBy: { coins: 'desc' },
      take: 10,
    });

    res.json({
      success: true,
      leaderboard: topUsers.map((u, rank) => ({
        rank: rank + 1,
        ...u,
      })),
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
