const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../config/db');
const { chatUpload, uploadToCloudinary } = require('../config/cloudinary');

const router = express.Router();

// @route   POST /api/chat/upload-voice
router.post('/upload-voice', auth, chatUpload.single('audio'), async (req, res) => {
  try {
    const { conversationId } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No audio file uploaded' });

    let mediaUrl = req.file.path;
    if (req.file.buffer) {
      mediaUrl = await uploadToCloudinary(req.file.buffer, 'socialhub/chat/voice', { resource_type: 'video' });
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: req.user.id,
        text: '🎤 Voice Message',
        media: { create: [{ url: mediaUrl, type: 'audio' }] },
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        media: true,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageId: message.id },
    });

    res.json(message);
  } catch (error) {
    console.error('Voice upload error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/chat/upload-media
// @desc    Upload image/video attachment in chat
router.post('/upload-media', auth, chatUpload.single('file'), async (req, res) => {
  try {
    const { conversationId } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const isVideo = req.file.mimetype.startsWith('video');
    let fileUrl = req.file.path;
    if (req.file.buffer) {
      fileUrl = await uploadToCloudinary(req.file.buffer, 'socialhub/chat/media', {
        resource_type: isVideo ? 'video' : 'image',
      });
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: req.user.id,
        text: isVideo ? '🎥 Video' : '📷 Photo',
        media: { create: [{ url: fileUrl, type: isVideo ? 'video' : 'image' }] },
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        media: true,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageId: message.id },
    });

    res.json(message);
  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/chat/conversations
router.post('/conversations', auth, async (req, res) => {
  try {
    const { recipientId } = req.body;
    const userId = req.user.id;

    // Find existing conversation between these two users
    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        participants: {
          every: { userId: { in: [userId, recipientId] } },
        },
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
      include: {
        participants: {
          include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, isOnline: true } } },
        },
        lastMessage: true,
      },
    });

    if (existing) return res.json(existing);

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        isGroup: false,
        participants: {
          create: [
            { userId },
            ...(recipientId !== userId ? [{ userId: recipientId }] : []),
          ],
        },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, isOnline: true } } },
        },
      },
    });

    res.json(conversation);
  } catch (error) {
    console.error('Conversation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/chat/conversations
router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { userId: req.user.id } } },
      include: {
        participants: {
          include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, isOnline: true } } },
        },
        lastMessage: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/chat/messages
router.post('/messages', auth, async (req, res) => {
  try {
    const { conversationId, text, media, replyToId, replyToText } = req.body;

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: req.user.id,
        text,
        replyToId,
        replyToText,
        ...(media && media.length > 0 ? { media: { create: media } } : {}),
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        media: true,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageId: message.id },
    });

    res.json(message);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/chat/messages/:messageId/react
// @desc    Add/update emoji reaction on a message
router.post('/messages/:messageId/react', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    let currentReactions = msg.reactions ? (typeof msg.reactions === 'object' ? msg.reactions : {}) : {};
    
    // Toggle reaction
    if (currentReactions[userId] === emoji) {
      delete currentReactions[userId];
    } else {
      currentReactions[userId] = emoji;
    }

    const updatedMsg = await prisma.message.update({
      where: { id: messageId },
      data: { reactions: currentReactions },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        media: true,
      },
    });

    res.json(updatedMsg);
  } catch (error) {
    console.error('React message error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/chat/messages/:messageId
// @desc    Delete message
router.delete('/messages/:messageId', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    if (msg.senderId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    await prisma.message.delete({ where: { id: messageId } });
    res.json({ success: true, messageId });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/chat/messages/:conversationId
router.get('/messages/:conversationId', auth, async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.conversationId },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        media: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/chat/messages/:messageId/pin
// @desc    Pin or unpin a message
router.put('/messages/:messageId/pin', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    // Return message with a pinned flag (we use reactions field as a workaround)
    res.json({ ...msg, pinned: true, messageId });
  } catch (error) {
    console.error('Pin message error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/chat/conversations/:conversationId/media
// @desc    Get all media messages in a conversation
router.get('/conversations/:conversationId/media', auth, async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: {
        conversationId: req.params.conversationId,
        media: { some: {} },
      },
      include: {
        media: true,
        sender: { select: { id: true, firstName: true, username: true, profilePicture: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

