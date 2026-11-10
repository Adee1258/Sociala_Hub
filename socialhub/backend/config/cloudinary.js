const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Use memory storage — files kept in buffer, then uploaded to Cloudinary manually
const memoryStorage = multer.memoryStorage();

// Upload buffer or base64 data to Cloudinary and return secure URL
const uploadToCloudinary = (fileOrBuffer, folder, options = {}) => {
  return new Promise((resolve, reject) => {
    const defaultOptions = {
      folder,
      resource_type: options.resource_type || 'auto',
      ...options,
    };

    // If string: could be base64 data URI ("data:image/jpeg;base64,...") or remote URL
    if (typeof fileOrBuffer === 'string') {
      cloudinary.uploader.upload(fileOrBuffer, defaultOptions, (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      });
      return;
    }

    // Otherwise: Buffer
    const uploadStream = cloudinary.uploader.upload_stream(
      defaultOptions,
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(fileOrBuffer);
  });
};

// Multer instances — all use memory storage
const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    // Accept image/* MIME types
    // Also accept application/octet-stream because React Native's FormData
    // sometimes sends binary data with this generic MIME — Cloudinary handles detection
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const chatUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for audio/video
});

const postsUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for video/image posts
  fileFilter: (req, file, cb) => {
    const isImageOrVideoMime =
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/') ||
      file.mimetype === 'application/octet-stream';

    const hasMediaExt = /\.(jpg|jpeg|png|gif|webp|bmp|heic|mp4|mov|avi|mkv|webm|3gp|m4v)$/i.test(
      file.originalname || ''
    );

    if (isImageOrVideoMime || hasMediaExt) {
      cb(null, true);
    } else {
      cb(new Error('Only image/video files allowed'), false);
    }
  }
});

module.exports = { cloudinary, upload, chatUpload, postsUpload, uploadToCloudinary };
