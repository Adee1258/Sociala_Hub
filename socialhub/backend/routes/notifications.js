const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../config/db');

const router = express.Router();

// @route   GET /api/notifications
// @desc    Get user's notifications
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    let notifications = await prisma.notification.findMany({
      where: { recipientId: userId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // If user has no notifications yet, generate friendly welcome & system notifications
    if (notifications.length === 0) {
      await prisma.notification.createMany({
        data: [
          {
            recipientId: userId,
            type: 'SYSTEM',
            message: '🎉 Welcome to SocialHub! Customize your profile & explore community reels.',
            isRead: false,
          },
          {
            recipientId: userId,
            type: 'SYSTEM',
            message: '⚡ Pro Tip: Play games daily in the Games tab to earn XP and level up!',
            isRead: false,
          },
        ],
      });

      notifications = await prisma.notification.findMany({
        where: { recipientId: userId },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    res.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/notifications/read
// @desc    Mark notifications as read
router.put('/read', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationIds } = req.body;

    if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
      await prisma.notification.updateMany({
        where: { recipientId: userId, id: { in: notificationIds } },
        data: { isRead: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { recipientId: userId, isRead: false },
        data: { isRead: true },
      });
    }

    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
