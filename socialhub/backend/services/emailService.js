const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Email templates
const getVerificationEmailTemplate = (firstName, verificationLink) => {
  return {
    subject: 'Verify Your Email - SocialHub',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - SocialHub</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #7C3AED 0%, #A855F7 100%); padding: 40px 30px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; }
          .content { padding: 40px 30px; }
          .greeting { font-size: 20px; color: #1E293B; margin-bottom: 16px; font-weight: 600; }
          .message { font-size: 16px; color: #64748B; line-height: 1.6; margin-bottom: 30px; }
          .button-container { text-align: center; margin: 30px 0; }
          .verify-button { display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #A855F7 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; }
          .link-container { background-color: #F8FAFC; border-radius: 8px; padding: 16px; margin: 20px 0; word-break: break-all; }
          .link-label { font-size: 12px; color: #64748B; margin-bottom: 8px; }
          .link { font-size: 14px; color: #7C3AED; }
          .footer { padding: 30px; text-align: center; border-top: 1px solid #E2E8F0; }
          .footer-text { font-size: 12px; color: #94A3B8; }
          .expiry { font-size: 14px; color: #EF4444; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SocialHub</h1>
          </div>
          <div class="content">
            <div class="greeting">Hello ${firstName || 'there'}!</div>
            <div class="message">
              Thanks for signing up for SocialHub! To complete your registration and start connecting with friends, please verify your email address by clicking the button below.
            </div>
            <div class="button-container">
              <a href="${verificationLink}" class="verify-button">Verify Email Address</a>
            </div>
            <div class="link-container">
              <div class="link-label">Or copy and paste this link:</div>
              <div class="link">${verificationLink}</div>
            </div>
            <div class="expiry">This link will expire in 24 hours.</div>
          </div>
          <div class="footer">
            <div class="footer-text">
              If you didn't create an account on SocialHub, you can safely ignore this email.<br>
              © ${new Date().getFullYear()} SocialHub. All rights reserved.
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hello ${firstName || 'there'}!\n\nThanks for signing up for SocialHub! To complete your registration, please verify your email address by visiting this link:\n\n${verificationLink}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account on SocialHub, you can safely ignore this email.`
  };
};

const getWelcomeEmailTemplate = (firstName) => {
  return {
    subject: 'Welcome to SocialHub!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to SocialHub</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #7C3AED 0%, #A855F7 100%); padding: 40px 30px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; }
          .content { padding: 40px 30px; text-align: center; }
          .greeting { font-size: 24px; color: #1E293B; margin-bottom: 16px; font-weight: 700; }
          .message { font-size: 16px; color: #64748B; line-height: 1.6; margin-bottom: 30px; }
          .features { display: flex; justify-content: center; gap: 30px; margin: 30px 0; flex-wrap: wrap; }
          .feature { text-align: center; }
          .feature-icon { font-size: 32px; margin-bottom: 8px; }
          .feature-text { font-size: 14px; color: #64748B; }
          .button { display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #A855F7 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; margin-top: 20px; }
          .footer { padding: 30px; text-align: center; border-top: 1px solid #E2E8F0; }
          .footer-text { font-size: 12px; color: #94A3B8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SocialHub</h1>
          </div>
          <div class="content">
            <div class="greeting">Welcome to SocialHub, ${firstName || 'Friend'}!</div>
            <div class="message">
              Your email has been verified successfully. You're now ready to connect, share, and discover with millions of users worldwide.
            </div>
            <div class="features">
              <div class="feature">
                <div class="feature-icon">📱</div>
                <div class="feature-text">Share Stories</div>
              </div>
              <div class="feature">
                <div class="feature-icon">💬</div>
                <div class="feature-text">Chat</div>
              </div>
              <div class="feature">
                <div class="feature-icon">🎮</div>
                <div class="feature-text">Play Games</div>
              </div>
            </div>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:8081'}/(tabs)/profile" class="button">Get Started</a>
          </div>
          <div class="footer">
            <div class="footer-text">
              © ${new Date().getFullYear()} SocialHub. All rights reserved.
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Welcome to SocialHub, ${firstName || 'Friend'}!\n\nYour email has been verified successfully. You're now ready to connect, share, and discover with millions of users worldwide.`
  };
};

// Send verification email
const sendVerificationEmail = async (to, firstName, verificationToken) => {
  try {
    const transporter = createTransporter();
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:8081'}/verify-email?token=${verificationToken}`;
    const template = getVerificationEmailTemplate(firstName, verificationLink);

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'SocialHub <noreply@socialhub.com>',
      to,
      subject: template.subject,
      html: template.html,
      text: template.text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
};

// Send welcome email after verification
const sendWelcomeEmail = async (to, firstName) => {
  try {
    const transporter = createTransporter();
    const template = getWelcomeEmailTemplate(firstName);

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'SocialHub <noreply@socialhub.com>',
      to,
      subject: template.subject,
      html: template.html,
      text: template.text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

// Generate verification token
const generateVerificationToken = () => {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
};

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  generateVerificationToken
};
