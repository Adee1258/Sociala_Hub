const nodemailer = require('nodemailer');

// OTP store — pure in-memory (reliable for single-process dev server)
// Redis is disabled because Upstash token has no SET permissions.
// To enable Redis: fix token permissions and set ENABLE_REDIS=true in .env
const USE_REDIS = process.env.ENABLE_REDIS === 'true';
let redis = null;

if (USE_REDIS) {
  try {
    redis = require('../config/redis');
    console.log('[OTP] Redis enabled');
  } catch (e) {
    console.warn('[OTP] Redis load failed, using in-memory:', e.message);
  }
} else {
  console.log('[OTP] Using in-memory OTP store');
}

// In-memory store — { key: { value, expiresAt } }
const memStore = new Map();

// Constants
const OTP_EXPIRY_SECONDS     = 10 * 60;  // 10 min
const VERIFIED_EXPIRY_SECONDS = 15 * 60; // 15 min
const MAX_ATTEMPTS            = 5;        // allow 5 tries

// Key builders
const otpKey      = (id) => `otp:${id}`;
const verifiedKey = (id) => `otp:verified:${id}`;
const rateKey     = (id) => `otp:rate:${id}`;

// Generate random 6-digit OTP
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// ─── Cache helpers ────────────────────────────────────────────────────────────

const cacheSet = async (key, value, exSeconds) => {
  if (redis) {
    try {
      await redis.set(key, value, { ex: exSeconds });
      return;
    } catch (e) {
      console.warn('[OTP] Redis set failed, using memory:', e.message);
    }
  }
  memStore.set(key, { value, expiresAt: Date.now() + exSeconds * 1000 });
};

const cacheGet = async (key) => {
  if (redis) {
    try {
      const val = await redis.get(key);
      if (val !== null && val !== undefined) return val;
    } catch (e) {
      console.warn('[OTP] Redis get failed, using memory:', e.message);
    }
  }
  const entry = memStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memStore.delete(key); return null; }
  return entry.value;
};

const cacheDel = async (key) => {
  if (redis) {
    try { await redis.del(key); } catch (e) {}
  }
  memStore.delete(key);
};

const cacheIncr = async (key, exSeconds) => {
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, exSeconds);
      return count;
    } catch (e) {}
  }
  const entry = memStore.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    memStore.set(key, { value: 1, expiresAt: Date.now() + exSeconds * 1000 });
    return 1;
  }
  entry.value += 1;
  return entry.value;
};

// ─── Store OTP ────────────────────────────────────────────────────────────────

const storeOTP = async (identifier, type) => {
  const otp = generateOTP();
  await cacheSet(otpKey(identifier), { otp, type, attempts: 0 }, OTP_EXPIRY_SECONDS);
  await cacheDel(verifiedKey(identifier));
  console.log(`[OTP] Stored for ${identifier} → ${otp}`);
  return otp;
};

// ─── Verify OTP ───────────────────────────────────────────────────────────────

const verifyOTP = async (identifier, otp) => {
  const data = await cacheGet(otpKey(identifier));

  console.log(`[OTP] Verify attempt — identifier: ${identifier}, submitted: ${otp}, stored:`, data);

  if (!data) {
    return { success: false, message: 'OTP expired or not found. Please request a new one.' };
  }

  if (data.attempts >= MAX_ATTEMPTS) {
    await cacheDel(otpKey(identifier));
    return { success: false, message: 'Too many failed attempts. Request a new OTP.' };
  }

  const submittedOtp = String(otp).trim();
  const storedOtp    = String(data.otp).trim();

  if (storedOtp !== submittedOtp) {
    data.attempts += 1;
    await cacheSet(otpKey(identifier), data, OTP_EXPIRY_SECONDS);
    const remaining = MAX_ATTEMPTS - data.attempts;
    console.log(`[OTP] Mismatch — stored: "${storedOtp}", submitted: "${submittedOtp}", attempts left: ${remaining}`);
    return { success: false, message: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} left.` };
  }

  // Correct OTP — mark as verified, remove raw OTP
  await cacheDel(otpKey(identifier));
  await cacheSet(verifiedKey(identifier), '1', VERIFIED_EXPIRY_SECONDS);
  console.log(`[OTP] Verified successfully for ${identifier}`);
  return { success: true, message: 'OTP verified successfully' };
};

// ─── Check if identifier is verified ─────────────────────────────────────────

const isVerified = async (identifier) => {
  const val = await cacheGet(verifiedKey(identifier));
  return val === '1' || val === 1;
};

// ─── Rate limit (max 3 sends per 5 min per identifier) ───────────────────────

const checkRateLimit = async (identifier) => {
  const count = await cacheIncr(rateKey(identifier), 5 * 60);
  return count <= 3;
};

// ─── Email template ───────────────────────────────────────────────────────────

const getEmailOTPTemplate = (otp) => ({
  subject: 'Your SocialHub Verification Code',
  html: `
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body{font-family:'Segoe UI',sans-serif;margin:0;padding:0;background:#f5f5f5;}
      .container{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);}
      .header{background:linear-gradient(135deg,#7C3AED,#A855F7);padding:40px 30px;text-align:center;}
      .header h1{color:#fff;margin:0;font-size:28px;font-weight:700;}
      .content{padding:40px 30px;text-align:center;}
      .otp-box{background:linear-gradient(135deg,#EDE9FE,#F5F3FF);border-radius:16px;padding:30px;margin:30px 0;}
      .otp-code{font-size:48px;font-weight:800;color:#7C3AED;letter-spacing:8px;font-family:'Courier New',monospace;}
      .expiry{font-size:14px;color:#EF4444;margin-top:16px;}
      .footer{padding:24px;text-align:center;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8;}
    </style></head><body>
    <div class="container">
      <div class="header"><h1>SocialHub</h1></div>
      <div class="content">
        <div style="font-size:64px">🔐</div>
        <h2 style="color:#1E293B">Verify Your Account</h2>
        <p style="color:#64748B">Use the code below to verify your identity. Valid for 10 minutes.</p>
        <div class="otp-box">
          <div style="font-size:13px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Verification Code</div>
          <div class="otp-code">${otp}</div>
          <div class="expiry">⏰ Expires in 10 minutes</div>
        </div>
        <p style="font-size:13px;color:#94A3B8">Never share this code. SocialHub will never ask for it.</p>
      </div>
      <div class="footer">© ${new Date().getFullYear()} SocialHub. All rights reserved.</div>
    </div></body></html>`,
  text: `Your SocialHub code: ${otp}\nValid for 10 minutes. Never share this code.`
});

// ─── Send Email OTP ───────────────────────────────────────────────────────────

const sendEmailOTP = async (email) => {
  try {
    const allowed = await checkRateLimit(email);
    if (!allowed) {
      return { success: false, message: 'Too many OTP requests. Please wait 5 minutes.' };
    }

    const otp = await storeOTP(email, 'email');

    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    const template = getEmailOTPTemplate(otp);
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'SocialHub <noreply@socialhub.com>',
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    });

    console.log(`[OTP] Email sent to ${email}`);
    return { success: true, message: 'Verification code sent to your email' };
  } catch (error) {
    console.error('[OTP] Email send error:', error.message);
    // Dev fallback
    const otp = await storeOTP(email, 'email');
    console.log(`\n══════════════════════════════════════\n[DEV] Email OTP for ${email}: ${otp}\n══════════════════════════════════════\n`);
    return {
      success: true,
      message: 'OTP sent (Dev mode — check server console)',
      devOTP: otp
    };
  }
};

// ─── Send SMS OTP ─────────────────────────────────────────────────────────────

const sendSMSOTP = async (phoneNumber) => {
  try {
    const allowed = await checkRateLimit(phoneNumber);
    if (!allowed) {
      return { success: false, message: 'Too many OTP requests. Please wait 5 minutes.' };
    }

    const otp = await storeOTP(phoneNumber, 'phone');

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
      const twilio = require('twilio');
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: `Your SocialHub verification code is: ${otp}. Valid for 10 minutes.`,
        from: TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
      console.log(`[OTP] SMS sent to ${phoneNumber}`);
      return {
        success: true,
        message: 'OTP sent to your mobile number',
        devOTP: process.env.NODE_ENV !== 'production' ? otp : undefined
      };
    }

    // Dev fallback — no Twilio configured
    console.log(`\n══════════════════════════════════════\n[DEV] SMS OTP for ${phoneNumber}: ${otp}\n══════════════════════════════════════\n`);
    return {
      success: true,
      message: 'OTP sent (Dev mode — check server console)',
      devOTP: otp
    };
  } catch (error) {
    console.error('[OTP] SMS send error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmailOTP,
  sendSMSOTP,
  verifyOTP,
  isVerified,
  storeOTP
};
