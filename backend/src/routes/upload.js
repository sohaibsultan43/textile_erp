const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// We will use the auth middleware if the user has tokens in their localStorage.
// The frontend typically includes it in the api.js helper, but here we can keep it simple.
const { authMiddleware } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../../doc/dyeing');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Using authMiddleware since most routes use it
router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const fileUrl = `/doc/dyeing/${req.file.filename}`;
    res.json({ success: true, data: { url: fileUrl } });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

module.exports = router;
