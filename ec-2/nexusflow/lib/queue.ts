import { FlowProducer } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

export const flowProducer = new FlowProducer({ connection });
