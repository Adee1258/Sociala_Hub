const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const prisma = require('../config/db');

const router = express.Router();

// @route   PUT /api/security/change-password
// @desc    Change password (requires current password)
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/security/sessions
// @desc    Get all active login sessions
router.get('/sessions', auth, async (req, res) => {
  try {
    const sessions = await prisma.loginSession.findMany({
      where: { userId: req.user.id, isActive: true },
      orderBy: { lastActive: 'desc' },
    });
    res.json({ success: true, sessions });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/security/sessions/create
// @desc    Register a new login session (called on login)
router.post('/sessions/create', auth, async (req, res) => {
  try {
    const { deviceName, deviceType, ipAddress, location, userAgent } = req.body;

    const session = await prisma.loginSession.create({
      data: {
        userId: req.user.id,
        deviceName: deviceName || 'Unknown Device',
        deviceType: deviceType || 'unknown',
        ipAddress: ipAddress || null,
        location: location || null,
        userAgent: userAgent || null,
      },
    });

    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/security/sessions/:sessionId
// @desc    Revoke a specific login session
router.delete('/sessions/:sessionId', auth, async (req, res) => {
  try {
    const session = await prisma.loginSession.findUnique({
      where: { id: req.params.sessionId },
    });

    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ message: 'Session not found' });
    }

    await prisma.loginSession.update({
      where: { id: req.params.sessionId },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/security/sessions/all
// @desc    Revoke all sessions (logout from all devices)
router.delete('/sessions', auth, async (req, res) => {
  try {
    await prisma.loginSession.updateMany({
      where: { userId: req.user.id, isActive: true },
      data: { isActive: false },
    });

    // Also clear all refresh tokens
    await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshTokens: [] },
    });

    res.json({ success: true, message: 'All sessions revoked' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/security/2fa
// @desc    Enable or disable 2FA (OTP-based)
router.put('/2fa', auth, async (req, res) => {
  try {
    const { enabled } = req.body;

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        biometrics: {
          ...(req.user.biometrics || {}),
          twoFactorEnabled: !!enabled,
        },
      },
    });

    res.json({
      success: true,
      message: enabled ? '2FA enabled' : '2FA disabled',
      twoFactorEnabled: !!enabled,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/security/account
// @desc    Deactivate account (soft delete)
router.delete('/account', auth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'Password required to deactivate account' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Incorrect password' });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'Account deactivated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
