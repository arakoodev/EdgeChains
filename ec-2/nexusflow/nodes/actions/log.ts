import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { withJobClient } from "../../lib/db";

const defaultConnection = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);

export function startLogWorker(conn: Redis = defaultConnection) {
  return new Worker(
    "log",
    async (job) => {
      const { workflow_run_id, message } = job.data;
      if (!workflow_run_id) throw new Error("missing workflow_run_id");
      await withJobClient(workflow_run_id, async (client) => {
        await client.query(
          "INSERT INTO action_logs (workflow_run_id, message) VALUES ($1, $2)",
          [workflow_run_id, message],
        );
      });
      return { logged: true };
    },
    { connection: conn },
  );
}
