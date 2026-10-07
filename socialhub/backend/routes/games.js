const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../config/db');

const router = express.Router();

// Max rewarded plays per game per day
const MAX_REWARDED_PLAYS = 3;

// Helper: Get start of today (UTC)
function startOfToday() {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now;
}

// @route   GET /api/games/daily-status
// @desc    Get user's daily game status (coins, xp, streak, etc.)
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

    // Count today's rewarded plays per game
    const todayStart = startOfToday();
    const todayPlays = await prisma.gameSession.groupBy({
      by: ['gameName'],
      where: {
        userId: req.user.id,
        playedAt: { gte: todayStart },
      },
      _count: { id: true },
    });

    const playsMap = {};
    todayPlays.forEach((g) => {
      playsMap[g.gameName] = g._count.id;
    });

    res.json({
      success: true,
      ...user,
      todayPlays: playsMap,
      maxPlaysPerGame: MAX_REWARDED_PLAYS,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/games/claim-daily
// @desc    Claim daily login reward (coins + XP + streak)
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
// @desc    Reward coins & XP for completing a mini-game (with cooldown)
router.post('/play-reward', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { gameName, coinsEarned = 50, xpEarned = 200, score = 0 } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check cooldown — count today's plays for this game
    const todayStart = startOfToday();
    const todayPlaysCount = await prisma.gameSession.count({
      where: {
        userId,
        gameName: gameName || 'Unknown',
        playedAt: { gte: todayStart },
      },
    });

    const rewardLimitReached = todayPlaysCount >= MAX_REWARDED_PLAYS;

    // Always log the session for history
    await prisma.gameSession.create({
      data: {
        userId,
        gameName: gameName || 'Unknown',
        score,
        coinsEarned: rewardLimitReached ? 0 : coinsEarned,
        xpEarned: rewardLimitReached ? 0 : xpEarned,
      },
    });

    // Only award coins/XP if under the daily limit
    if (rewardLimitReached) {
      return res.json({
        success: true,
        message: `🎮 ${gameName || 'Game'} played! Daily reward limit reached (${MAX_REWARDED_PLAYS} plays).`,
        user: {
          id: user.id,
          coins: user.coins,
          xp: user.xp,
          level: user.level,
        },
        rewardLimitReached: true,
        playsToday: todayPlaysCount + 1,
        maxPlays: MAX_REWARDED_PLAYS,
      });
    }

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
      playsToday: todayPlaysCount + 1,
      maxPlays: MAX_REWARDED_PLAYS,
    });
  } catch (error) {
    console.error('Play reward error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/games/leaderboard
// @desc    Get top players leaderboard (supports ?period=daily|weekly|alltime)
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const { period = 'alltime' } = req.query;

    if (period === 'alltime') {
      // All-time: order by total coins
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

      return res.json({
        success: true,
        leaderboard: topUsers.map((u, rank) => ({
          rank: rank + 1,
          ...u,
        })),
      });
    }

    // For daily/weekly: aggregate from GameSession
    let dateFilter;
    if (period === 'daily') {
      dateFilter = startOfToday();
    } else {
      // weekly — last 7 days
      const d = new Date();
      d.setDate(d.getDate() - 7);
      d.setUTCHours(0, 0, 0, 0);
      dateFilter = d;
    }

    const topByPeriod = await prisma.gameSession.groupBy({
      by: ['userId'],
      where: { playedAt: { gte: dateFilter } },
      _sum: { coinsEarned: true, xpEarned: true },
      orderBy: { _sum: { coinsEarned: 'desc' } },
      take: 10,
    });

    // Fetch user details for each
    const userIds = topByPeriod.map((g) => g.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
        coins: true,
        level: true,
        xp: true,
      },
    });

    const usersMap = {};
    users.forEach((u) => { usersMap[u.id] = u; });

    const leaderboard = topByPeriod.map((g, idx) => ({
      rank: idx + 1,
      ...usersMap[g.userId],
      periodCoins: g._sum.coinsEarned || 0,
      periodXp: g._sum.xpEarned || 0,
    })).filter((entry) => entry.username); // filter out any null users

    res.json({ success: true, leaderboard });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/games/history
// @desc    Get user's recent game sessions
router.get('/history', auth, async (req, res) => {
  try {
    const sessions = await prisma.gameSession.findMany({
      where: { userId: req.user.id },
      orderBy: { playedAt: 'desc' },
      take: 20,
    });

    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Game history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/games/stats
// @desc    Get user's aggregated game stats
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [totalStats, perGame] = await Promise.all([
      prisma.gameSession.aggregate({
        where: { userId },
        _sum: { coinsEarned: true, xpEarned: true },
        _count: { id: true },
        _max: { score: true },
      }),
      prisma.gameSession.groupBy({
        by: ['gameName'],
        where: { userId },
        _count: { id: true },
        _sum: { coinsEarned: true, xpEarned: true },
        _max: { score: true },
      }),
    ]);

    res.json({
      success: true,
      stats: {
        totalPlayed: totalStats._count.id,
        totalCoinsEarned: totalStats._sum.coinsEarned || 0,
        totalXpEarned: totalStats._sum.xpEarned || 0,
        bestScore: totalStats._max.score || 0,
        perGame: perGame.map((g) => ({
          gameName: g.gameName,
          timesPlayed: g._count.id,
          totalCoins: g._sum.coinsEarned || 0,
          totalXp: g._sum.xpEarned || 0,
          bestScore: g._max.score || 0,
        })),
      },
    });
  } catch (error) {
    console.error('Game stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
