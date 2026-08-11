const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Test connection on startup
redis.ping().then(() => {
  console.log('✅ Redis (Upstash) Connected Successfully');
}).catch((err) => {
  console.error('❌ Redis Connection Failed:', err.message);
});

module.exports = redis;
