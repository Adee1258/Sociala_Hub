const express = require('express');
const { sendEmailOTP, sendSMSOTP, verifyOTP, isVerified } = require('../services/otpService');

const router = express.Router();

// @route   POST /api/otp/send-email
router.post('/send-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ message: 'Invalid email format' });

    const result = await sendEmailOTP(email);

    if (result.success) {
      res.json({ success: true, message: result.message, devOTP: result.devOTP });
    } else {
      res.status(429).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('Send email OTP error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/otp/send-sms
router.post('/send-sms', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ message: 'Phone number is required' });

    const result = await sendSMSOTP(phoneNumber);

    if (result.success) {
      res.json({ success: true, message: result.message, devOTP: result.devOTP });
    } else {
      res.status(429).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('Send SMS OTP error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/otp/verify
router.post('/verify', async (req, res) => {
  try {
    const { identifier, otp, type } = req.body;
    if (!identifier || !otp || !type) {
      return res.status(400).json({ message: 'Identifier, OTP, and type are required' });
    }

    // ✅ await — now Redis-backed
    const result = await verifyOTP(identifier, otp);

    if (result.success) {
      res.json({ success: true, message: 'Verification successful', verified: true, type });
    } else {
      res.status(400).json({ success: false, message: result.message, verified: false });
    }
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/otp/check-verified
router.post('/check-verified', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ message: 'Identifier is required' });

    // ✅ await — now Redis-backed
    const verified = await isVerified(identifier);
    res.json({ success: true, verified });
  } catch (error) {
    console.error('Check verified error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
