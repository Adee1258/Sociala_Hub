const express = require('express');
const dns = require('node:dns');
const cors = require('cors');
const http = require('http');

// Force DNS resolution to Google DNS to fix ECONNREFUSED/SRV issues
dns.setServers(['8.8.8.8', '8.8.4.4']);

const { Server } = require('socket.io');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const otpRoutes = require('./routes/otp');
const chatRoutes = require('./routes/chat');
const aiRoutes = require('./routes/ai');
const postRoutes = require('./routes/post');
const searchRoutes = require('./routes/search');
const notificationRoutes = require('./routes/notifications');
const gameRoutes = require('./routes/games');

const prisma = require('./config/db');
// Create Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT']
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.set('io', io);


// Socket.io Logic
const users = new Map(); // Store online users

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', async (userId) => {
    users.set(userId, socket.id);
    socket.join(`user_${userId}`); // Join a personal room for updates
    
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: true, lastSeen: new Date() }
      });
      io.emit('user_status_changed', { userId, isOnline: true });
    } catch (err) {
      console.error('Error updating online status:', err);
    }
    
    console.log(`User ${userId} joined and entered room user_${userId}`);
  });

  // Real-time profile view room
  socket.on('view_profile', (profileId) => {
    socket.join(`profile_${profileId}`);
    console.log(`Socket ${socket.id} viewing profile ${profileId}`);
  });

  socket.on('leave_profile', (profileId) => {
    socket.leave(`profile_${profileId}`);
  });

  socket.on('send_message', (data) => {
    const recipientSocketId = users.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('receive_message', data);
    }
  });

  // Global event emitter for profile updates
  socket.on('profile_changed', (data) => {
    // Notify the user themselves
    io.to(`user_${data.userId}`).emit('user_updated', data.user);
    // Notify everyone viewing this profile
    io.to(`profile_${data.userId}`).emit('profile_refreshed', data.user);
  });

  socket.on('typing', (data) => {
    const recipientSocketId = users.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user_typing', data);
    }
  });

  socket.on('send_reaction', (data) => {
    const recipientSocketId = users.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('message_reaction', data);
    }
  });

  socket.on('delete_message', (data) => {
    const recipientSocketId = users.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('message_deleted', data);
    }
  });

  socket.on('call_user', (data) => {
    const recipientSocketId = users.get(data.targetUserId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('incoming_call', {
        callerId: data.callerId,
        callerName: data.callerName,
        callerAvatar: data.callerAvatar,
        callType: data.callType, // 'audio' | 'video'
        channelId: data.channelId,
      });
    }
  });

  socket.on('answer_call', (data) => {
    const callerSocketId = users.get(data.callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_accepted', data);
    }
  });

  socket.on('end_call', (data) => {
    const targetSocketId = users.get(data.targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call_ended', data);
    }
  });

  socket.on('disconnect', async () => {
    let disconnectedUserId = null;
    for (let [userId, socketId] of users.entries()) {
      if (socketId === socket.id) {
        disconnectedUserId = userId;
        users.delete(userId);
        break;
      }
    }

    if (disconnectedUserId) {
      try {
        await prisma.user.update({
          where: { id: disconnectedUserId },
          data: { isOnline: false, lastSeen: new Date() }
        });
        io.emit('user_status_changed', { userId: disconnectedUserId, isOnline: false });
      } catch (err) {
        console.error('Error updating offline status:', err);
      }
    }
    console.log('User disconnected');
  });
});

// Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`, req.body);
  next();
});

// Connect to Database
prisma.$connect()
  .then(() => console.log('🚀 PostgreSQL (Prisma) Connected Successfully'))
  .catch((err) => {
    console.error('❌ Database Connection Error Details:');
    console.error('Error Message:', err.message);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/games', gameRoutes);

// Health check
app.get('/', (req, res) => {
  res.send('SocialHub Backend is running...');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
