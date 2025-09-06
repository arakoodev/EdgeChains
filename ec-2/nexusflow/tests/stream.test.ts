import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Queue, QueueEvents } from "bullmq";
import { redisClient } from "../workers/streamAwareBullWorker";
import { startEchoWorker } from "../workers/echo";
import { canConnectRedis, waitForRedis } from "./utils/redis";

let queue: any;
let queueEvents: any;
let worker: any;

const inputStream = "stream:test:in";
const outputStream = "stream:test:out";

// Wait for Redis to be available - fail if it never becomes available
console.log("Waiting for Redis to be available...");
const redisAvailable = await waitForRedis();
if (!redisAvailable) {
  throw new Error("Redis is required for integration tests. Please ensure Redis is running or use the all-in-one container for testing.");
}

describe("stream-based action worker", () => {
  beforeAll(async () => {
    queue = new Queue("echo", { connection: redisClient });
    queueEvents = new QueueEvents("echo", { connection: redisClient });
    await queueEvents.waitUntilReady();
    worker = startEchoWorker();
  });

  afterAll(async () => {
    // Close resources in reverse order with error handling
    try {
      if (worker) await worker.close();
    } catch (e) {
      console.warn('Worker close error:', e);
    }
    try {
      if (queueEvents) await queueEvents.close();
    } catch (e) {
      console.warn('QueueEvents close error:', e);
    }
    try {
      if (queue) await queue.close();
    } catch (e) {
      console.warn('Queue close error:', e);
    }
    try {
      await redisClient.del(inputStream, outputStream);
    } catch (e) {
      console.warn('Stream cleanup error:', e);
    }
  });

  it("reads from input stream and writes to output stream", async () => {
    await redisClient.xadd(
      inputStream,
      "*",
      "message",
      JSON.stringify("hello"),
    );

    const job = await queue!.add("echo", {
      workflow_run_id: "run1",
      inputStream,
      outputStream,
    });

    await new Promise<void>((resolve, reject) => {
      queueEvents!.on("completed", ({ jobId }) => {
        if (jobId === job.id) resolve();
      });
      queueEvents!.on("failed", ({ failedReason }) => reject(failedReason));
    });

    const outEntries = await redisClient.xrange(outputStream, "-", "+");
    expect(outEntries.length).toBe(1);
    const fields = outEntries[0][1];
    const data: Record<string, any> = {};
    for (let i = 0; i < fields.length; i += 2) {
      data[fields[i]] = JSON.parse(fields[i + 1]);
    }
    expect(data.message).toBe("hello");
  });
});
