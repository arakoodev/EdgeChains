import { Worker } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

new Worker(
  'echo',
  async job => {
    console.log('Processing', job.name, job.data);
    return job.data;
  },
  { connection }
);
