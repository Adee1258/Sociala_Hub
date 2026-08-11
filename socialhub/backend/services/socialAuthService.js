const prisma = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const generateTokens = async (userId) => {
  const accessToken = jwt.sign(
    { id: userId },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'access_secret',
    { expiresIn: '1h' }
  );
  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET || 'refresh_secret',
    { expiresIn: '30d' }
  );

  // Save refresh token
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshTokens: [...user.refreshTokens, refreshToken] }
    });
  }

  return { accessToken, refreshToken };
};

const generateUniqueUsername = async (displayName) => {
  let baseUsername = (displayName || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15) || 'user';

  let username = baseUsername;
  let counter = 1;

  while (true) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (!existing) break;
    username = `${baseUsername}_${counter++}`;
  }

  return username;
};

const handleAccountLinking = async ({ provider, providerId, email, firstName, lastName, profilePicture }) => {
  let user = null;

  // Find by email
  if (email) {
    user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  if (user) {
    // Link provider if not already linked
    const providers = user.providers || {};
    if (!providers[provider]) {
      await prisma.user.update({
        where: { id: user.id },
        data: { providers: { ...providers, [provider]: { id: providerId } } }
      });
    }
    const tokens = await generateTokens(user.id);
    const { password: _, ...userData } = user;
    return { user: userData, tokens };
  }

  // Create new user
  const username = await generateUniqueUsername(`${firstName || 'user'} ${lastName || ''}`);
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(Math.random().toString(36).slice(-12), salt);

  const newUser = await prisma.user.create({
    data: {
      firstName: firstName || 'User',
      lastName: lastName || '',
      username,
      email: email ? email.toLowerCase() : null,
      profilePicture: profilePicture || null,
      emailVerified: true,
      password: hashedPassword,
      dobDay: '01', dobMonth: 'January', dobYear: '2000',
      gender: 'Other',
      providers: { [provider]: { id: providerId } }
    }
  });

  const tokens = await generateTokens(newUser.id);
  const { password: _, ...userData } = newUser;
  return { user: userData, tokens };
};

module.exports = { generateTokens, generateUniqueUsername, handleAccountLinking };
