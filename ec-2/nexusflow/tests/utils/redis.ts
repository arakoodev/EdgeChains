import Redis from 'ioredis';

export async function canConnectRedis(url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379') {
  const client = new Redis(url, { 
    lazyConnect: true, 
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
  });
  
  try {
    // Suppress error events during connection test
    client.on('error', () => {});
    
    // try a connect + ping with longer timeout for container startup
    await Promise.race([
      (async () => {
        await client.connect();
        await client.ping();
      })(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)), // Increased timeout
    ]);
    return true;
  } catch (error) {
    return false;
  } finally {
    try { 
      await client.quit(); 
    } catch {
      // Ignore cleanup errors
    }
  }
}

export async function waitForRedis(url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await canConnectRedis(url)) {
      return true;
    }
    console.log(`Waiting for Redis... (attempt ${i + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}
