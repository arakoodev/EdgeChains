import { Worker } from 'bullmq';
import { redisClient } from './streamBase';

new Worker(
  'echo',
  async job => {
    console.log('Processing', job.name, job.data);
    return job.data;
  },
  { connection: redisClient }
);
