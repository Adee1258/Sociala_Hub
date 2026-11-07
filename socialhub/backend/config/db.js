const { PrismaClient } = require('@prisma/client');

// Cache PrismaClient on global to prevent exhausting DB connections in dev & serverless environments
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

globalForPrisma.prisma = prisma;

module.exports = prisma;
