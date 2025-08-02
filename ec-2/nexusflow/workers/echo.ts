import { Job } from "bullmq";
import { StreamAwareBullMQWorker, redisClient } from "./streamBase";

class EchoWorker extends StreamAwareBullMQWorker {
  constructor() {
    super("echo", (job) => this.processor(job));
  }

  async processor(job: Job): Promise<any> {
    const { workflow_run_id, inputStream, outputStream } = job.data;
    if (!workflow_run_id) throw new Error("missing workflow_run_id");
    if (!inputStream || !outputStream) throw new Error("missing stream names");

    const groupName = `group:${workflow_run_id}`;
    const consumerName = `consumer:${job.id}`;
    await this.createConsumerGroup(inputStream, groupName);

    while (true) {
      const messages = await redisClient.xreadgroup(
        "GROUP",
        groupName,
        consumerName,
        "COUNT",
        1,
        "BLOCK",
        2000,
        "STREAMS",
        inputStream,
        ">",
      );

      if (!messages || messages.length === 0) break;
      const [, entries] = messages[0];
      if (!entries || entries.length === 0) break;
      for (const [id, fields] of entries) {
        const item = this.parseMessage(fields);
        await this.produce(outputStream, item);
        await redisClient.xack(inputStream, groupName, id);
      }
    }

    return { echoed: true };
  }
}

export function startEchoWorker() {
  return new EchoWorker();
}
