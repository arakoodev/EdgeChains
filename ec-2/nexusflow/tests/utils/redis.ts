import Redis from 'ioredis';

export async function canConnectRedis(url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379') {
  const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null });
  try {
    client.on('error', () => {});
    // try a fast connect + ping with a short timeout
    await Promise.race([
      (async () => {
        await client.connect();
        await client.ping();
      })(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 500)),
    ]);
    return true;
  } catch (_) {
    return false;
  } finally {
    try { await client.quit(); } catch {}
  }
}
