import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';

let _redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!_redisClient) {
    _redisClient = new Redis(
      process.env.REDIS_URL ?? 'redis://localhost:6379',
      { maxRetriesPerRequest: null },
    );
    // Avoid unhandled error event noise when Redis is unavailable in local tests
    _redisClient.on('error', () => {});
  }
  return _redisClient;
}

// Use getter to make it truly lazy
export const redisClient = new Proxy({} as Redis, {
  get(target, prop) {
    const client = getRedisClient();
    const value = client[prop as keyof Redis];
    // If it's a function, bind it to the client
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

export abstract class StreamAwareBullMQWorker extends Worker {
  constructor(
    queueName: string,
    processor: (job: Job) => Promise<any>,
    opts: Record<string, any> = {},
  ) {
    super(queueName, processor, { connection: redisClient, ...opts });
  }

  protected async produce(
    streamName: string,
    data: Record<string, any>,
  ): Promise<string> {
    const fields: string[] = [];
    for (const [k, v] of Object.entries(data)) {
      fields.push(k, JSON.stringify(v));
    }
    return redisClient.xadd(streamName, '*', ...fields);
  }

  protected async createConsumerGroup(
    streamName: string,
    groupName: string,
  ): Promise<void> {
    try {
      await redisClient.xgroup('CREATE', streamName, groupName, '0', 'MKSTREAM');
    } catch (error: any) {
      if (!String(error.message).includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  protected parseMessage(fields: string[]): Record<string, any> {
    const data: Record<string, any> = {};
    for (let i = 0; i < fields.length; i += 2) {
      data[fields[i]] = JSON.parse(fields[i + 1]);
    }
    return data;
  }
}
