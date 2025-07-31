import { FlowProducer } from 'bullmq';
import { redisClient } from '../workers/streamBase';

export const flowProducer = new FlowProducer({ connection: redisClient });
