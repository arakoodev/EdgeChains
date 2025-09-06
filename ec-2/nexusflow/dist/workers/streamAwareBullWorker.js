import { Worker } from 'bullmq';
import Redis from 'ioredis';
export const redisClient = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
// Avoid unhandled error event noise when Redis is unavailable in local tests
redisClient.on('error', () => { });
export class StreamAwareBullMQWorker extends Worker {
    constructor(queueName, processor, opts = {}) {
        super(queueName, processor, { connection: redisClient, ...opts });
    }
    async produce(streamName, data) {
        const fields = [];
        for (const [k, v] of Object.entries(data)) {
            fields.push(k, JSON.stringify(v));
        }
        return redisClient.xadd(streamName, '*', ...fields);
    }
    async createConsumerGroup(streamName, groupName) {
        try {
            await redisClient.xgroup('CREATE', streamName, groupName, '0', 'MKSTREAM');
        }
        catch (error) {
            if (!String(error.message).includes('BUSYGROUP')) {
                throw error;
            }
        }
    }
    parseMessage(fields) {
        const data = {};
        for (let i = 0; i < fields.length; i += 2) {
            data[fields[i]] = JSON.parse(fields[i + 1]);
        }
        return data;
    }
}
