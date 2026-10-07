const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../config/db');

const router = express.Router();

// @route   GET /api/privacy
// @desc    Get user privacy settings
router.get('/', auth, async (req, res) => {
  try {
    let privacy = await prisma.privacySettings.findUnique({ where: { userId: req.user.id } });
    if (!privacy) {
      privacy = await prisma.privacySettings.create({ data: { userId: req.user.id } });
    }
    res.json({ success: true, privacy });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/privacy
// @desc    Update user privacy settings
router.put('/', auth, async (req, res) => {
  try {
    const allowedFields = [
      'profileVisibility', 'whoCanFollow', 'whoCanMessage', 'whoCanSeeMyPosts',
      'whoCanSeeMyActivity', 'whoCanSeeFollowers',
      'searchByUsername', 'searchByEmail', 'searchByPhone',
      'locationSharing', 'locationApproximate',
      'whoCanTagMe', 'whoCanMentionMe', 'tagApproval',
    ];

    const data = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    });

    const privacy = await prisma.privacySettings.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, ...data },
      update: data,
    });

    res.json({ success: true, privacy });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
