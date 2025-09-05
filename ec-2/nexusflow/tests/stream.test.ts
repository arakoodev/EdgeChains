import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Queue, QueueEvents } from "bullmq";
import { redisClient } from "../workers/streamAwareBullWorker";
import { startEchoWorker } from "../workers/echo";
import { canConnectRedis } from "./utils/redis";

let queue: any;
let queueEvents: any;
let worker: any;

const inputStream = "stream:test:in";
const outputStream = "stream:test:out";

const redisReadyPromise = canConnectRedis();
const suite = (await redisReadyPromise) ? describe : (describe as any).skip;

suite("stream-based action worker", () => {
  beforeAll(async () => {
    queue = new Queue("echo", { connection: redisClient });
    queueEvents = new QueueEvents("echo", { connection: redisClient });
    await queueEvents.waitUntilReady();
    worker = startEchoWorker();
  });

  afterAll(async () => {
    if (worker) await worker.close();
    if (queueEvents) await queueEvents.close();
    if (queue) await queue.close();
    await redisClient.del(inputStream, outputStream);
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
