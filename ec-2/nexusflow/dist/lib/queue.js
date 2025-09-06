import { FlowProducer } from 'bullmq';
import { redisClient } from '../workers/streamAwareBullWorker';
export const flowProducer = new FlowProducer({ connection: redisClient });
