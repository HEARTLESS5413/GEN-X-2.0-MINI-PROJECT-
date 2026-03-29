const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
const postsDir = path.join(uploadsDir, 'posts');
const messagesDir = path.join(uploadsDir, 'messages');
const storiesDir = path.join(uploadsDir, 'stories');

[uploadsDir, avatarsDir, postsDir, messagesDir, storiesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.uploadType || 'posts';
    const dirs = { avatars: avatarsDir, posts: postsDir, messages: messagesDir, stories: storiesDir };
    cb(null, dirs[type] || postsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Middleware factories
const uploadAvatar = (req, res, next) => {
  req.uploadType = 'avatars';
  upload.single('avatar')(req, res, next);
};

const uploadPostMedia = (req, res, next) => {
  req.uploadType = 'posts';
  upload.single('media')(req, res, next);
};

const uploadMessageMedia = (req, res, next) => {
  req.uploadType = 'messages';
  upload.single('media')(req, res, next);
};

const uploadStoryMedia = (req, res, next) => {
  req.uploadType = 'stories';
  upload.single('media')(req, res, next);
};

module.exports = { upload, uploadAvatar, uploadPostMedia, uploadMessageMedia, uploadStoryMedia };
