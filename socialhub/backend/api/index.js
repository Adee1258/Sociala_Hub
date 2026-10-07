/**
 * Vercel Serverless Entry Point
 *
 * NOTE: Socket.IO real-time features (chat, online status, calls) will NOT work
 * on Vercel because it is a serverless platform. All REST API endpoints work fine.
 * For full Socket.IO support, migrate to Railway later.
 */

const express = require('express');
const dns = require('node:dns');
const cors = require('cors');

// Force DNS to Google DNS — fixes ECONNREFUSED/SRV issues with Neon
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();

// Import routes
const authRoutes = require('../routes/auth');
const otpRoutes = require('../routes/otp');
const chatRoutes = require('../routes/chat');
const aiRoutes = require('../routes/ai');
const postRoutes = require('../routes/post');
const searchRoutes = require('../routes/search');
const notificationRoutes = require('../routes/notifications');
const gameRoutes = require('../routes/games');

const prisma = require('../config/db');

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ─── Request Logger ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ─── Database Connection ───────────────────────────────────────────────────────
prisma.$connect()
  .then(() => console.log('🚀 PostgreSQL (Prisma) Connected Successfully'))
  .catch((err) => console.error('❌ Database Connection Error:', err.message));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/games', gameRoutes);

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'SocialHub Backend is running on Vercel',
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.url} not found` });
});

// ─── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// ─── Export for Vercel ────────────────────────────────────────────────────────
// Vercel calls this as a serverless function — no server.listen() needed
module.exports = app;
