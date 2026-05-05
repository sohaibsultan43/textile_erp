const jwt = require('jsonwebtoken');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const generateUserPayload = (user) => {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };
};

module.exports = {
  generateToken,
  verifyToken,
  generateUserPayload,
};