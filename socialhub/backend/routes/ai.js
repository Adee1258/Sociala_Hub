const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../config/db');

const router = express.Router();

const generateCoachingResponse = (user, prompt) => {
  const normalized = (prompt || '').toLowerCase();
  const displayName = `${user.firstName} ${user.lastName || ''}`.trim();
  const handle = `@${user.username || 'user'}`;
  const followersVal = user._count?.followers || 0;
  const postsVal = user.postsCount || 0;
  const levelVal = user.level || 1;
  const streakVal = user.streakCount || 0;
  const viewsVal = user.profileViews || 0;
  const bioText = user.bio || 'No bio yet';
  const formatViews = viewsVal >= 1000 ? (viewsVal / 1000).toFixed(1) + 'K' : viewsVal;

  if (normalized.includes('bio') || normalized.includes('profile')) {
    return `🤖 *AI Profile Coach:* I've analyzed your current bio: *"${bioText}"*\n\n✨ **Option A (Professional):**\n📸 ${displayName} | Digital Creator\n🌍 Sharing stories & experiences\n🔥 Level ${levelVal} Creator | ${streakVal}-Day Streak!\n🔗 linktr.ee/${user.username}\n\n✨ **Option B (Engaging):**\n📍 Creating content that inspires ⚡\n🎯 Photographer | Creator\n💬 DM for collabs\n\n✨ **Option C (Minimal):**\n${displayName} • Digital Creator\n📷 Capturing beautiful moments`;
  }

  if (normalized.includes('idea') || normalized.includes('post') || normalized.includes('next')) {
    return `🤖 *AI Profile Coach:* Based on your **${followersVal} followers** and **${postsVal} posts**:\n\n1. **Reel (High Reach):** Behind-the-scenes of your daily routine\n2. **Carousel (High Saves):** "5 Tips" educational post in your niche\n3. **Engagement Post:** Ask a question your audience can answer easily`;
  }

  if (normalized.includes('hashtag') || normalized.includes('tag')) {
    return `🤖 *AI Profile Coach:* Optimized hashtag strategy for **${followersVal} followers**:\n\n📈 **High Exposure:**\n#creator #explore #trending #viral\n\n🎯 **Niche:**\n#level${levelVal}creator #socialhub\n\n🚀 **Personal:**\n#${user.username}content`;
  }

  if (normalized.includes('analyze') || normalized.includes('score') || normalized.includes('audit')) {
    const score = user.bio ? 85 : 70;
    return `🤖 *AI Profile Coach:* Profile Audit for **${handle}**:\n\n📈 **Health Score:** ${score}/100\n📊 **Profile Views:** ${formatViews}\n🔥 **Level:** ${levelVal}\n⚡ **Streak:** ${streakVal} days\n\n💡 ${user.bio ? 'Great bio! Add a website link to boost conversions.' : 'Add a bio to increase your profile score by 15 points!'}`;
  }

  return `🤖 *AI Profile Coach:* Welcome, **${displayName}**! (Level ${levelVal}, ${followersVal} Followers)\n\nAsk me:\n- 📝 *'bio'* for bio ideas\n- 📸 *'post ideas'* for content\n- 🏷️ *'hashtags'* for tags\n- 📊 *'analyze'* for profile audit`;
};

// @route   POST /api/ai/coach
router.post('/coach', auth, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ message: 'Prompt is required' });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { _count: { select: { followers: true, following: true } } }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const reply = generateCoachingResponse(user, prompt);
    res.json({ success: true, reply });
  } catch (error) {
    console.error('AI coach error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
