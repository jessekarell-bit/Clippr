import Redis from 'ioredis';

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return _redis;
}

export function chatActivityKey(streamId: string): string {
  return `chat_activity:${streamId}`;
}

// Store message count per 30s window as sorted set
// Score = unix timestamp (start of window), member = JSON {count, windowStart}
export async function recordChatActivity(
  streamId: string,
  windowStartUnix: number,
  messageCount: number
): Promise<void> {
  const redis = getRedis();
  const key = chatActivityKey(streamId);
  await redis.zadd(key, windowStartUnix, JSON.stringify({ count: messageCount, windowStart: windowStartUnix }));
  // Keep only last 2 hours of windows
  const twoHoursAgo = windowStartUnix - 7200;
  await redis.zremrangebyscore(key, '-inf', twoHoursAgo);
  await redis.expire(key, 7200);
}

// Returns total message count in a time range [fromUnix, toUnix]
export async function getChatActivityInRange(
  streamId: string,
  fromUnix: number,
  toUnix: number
): Promise<number> {
  const redis = getRedis();
  const members = await redis.zrangebyscore(
    chatActivityKey(streamId),
    fromUnix,
    toUnix
  );
  return members.reduce((sum, m) => {
    try {
      const parsed = JSON.parse(m) as { count: number };
      return sum + parsed.count;
    } catch {
      return sum;
    }
  }, 0);
}
