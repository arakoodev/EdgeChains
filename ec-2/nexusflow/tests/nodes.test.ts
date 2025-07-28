import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { newDb } from "pg-mem";
import { readFile } from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import Redis from "ioredis";
import { execSync } from "child_process";

import { SimpleWebhookTrigger } from "../nodes/triggers/webhook";
import { CounterPollingTrigger } from "../nodes/triggers/polling";
import { startLogWorker } from "../nodes/actions/log";

vi.mock("../lib/db", () => ({
  get pool() {
    return pool;
  },
  async withJobClient(_jobId: string, fn: (client: any) => Promise<any>) {
    return fn(pool);
  },
}));

vi.mock("../lib/queue", () => ({
  get flowProducer() {
    return flowProducer;
  },
}));

let pool: any;
let connection: any;
let flowProducer: any;
let queueEvents: any;
let worker: any;

function startRedis() {
  execSync("redis-server --save '' --appendonly no --daemonize yes");
}
function stopRedis() {
  try {
    execSync("redis-cli shutdown");
  } catch {}
}

describe("action and trigger nodes", () => {
  beforeAll(async () => {
    startRedis();

    const db = newDb();
    db.registerLanguage("plpgsql", () => {});
    db.public.registerFunction({
      name: "gen_random_uuid",
      returns: "text",
      implementation: uuidv4,
    });
    const pg = db.adapters.createPg();
    pool = new pg.Pool();

    const migrationFiles = [
      "001_init.sql",
      "002_runs_and_merge.sql",
      "005_trigger_state.sql",
      "006_action_logs.sql",
    ];
    for (const file of migrationFiles) {
      const sql = await readFile(
        new URL(`../migrations/${file}`, import.meta.url),
        "utf8",
      );
      await pool.query(sql);
    }

    const { FlowProducer, QueueEvents } = await import("bullmq");
    connection = new Redis({ maxRetriesPerRequest: null });
    flowProducer = new FlowProducer({ connection });
    queueEvents = new QueueEvents("log", { connection });
    await queueEvents.waitUntilReady();

    worker = startLogWorker(connection);
  });

  afterAll(async () => {
    await worker.close();
    await queueEvents.close();
    await flowProducer.close();
    await connection.quit();
    stopRedis();
  });

  afterEach(async () => {
    await pool.query("TRUNCATE workflows RESTART IDENTITY CASCADE");
    await pool.query("TRUNCATE workflow_runs RESTART IDENTITY CASCADE");
    await pool.query("TRUNCATE trigger_state RESTART IDENTITY CASCADE");
    await pool.query("TRUNCATE action_logs RESTART IDENTITY CASCADE");
    await connection.flushall();
  });

  it("webhook trigger starts workflow and logs message", async () => {
    const wfDef = {
      root: "log",
      nodes: {
        log: { name: "log", queue: "log" },
      },
    };
    const { rows: wfRows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["wf", wfDef],
    );
    const workflowId = wfRows[0].id;
    const trigger = new SimpleWebhookTrigger(pool, flowProducer, workflowId);
    await trigger.webhook("hello");

    await new Promise((resolve) => {
      queueEvents.on("completed", () => resolve(null));
    });

    const { rows: logRows } = await pool.query(
      "SELECT message FROM action_logs",
    );
    expect(logRows[0].message).toBe("hello");
  });

  it("polling trigger increments state", async () => {
    const wfDef = {
      root: "log",
      nodes: {
        log: { name: "log", queue: "log" },
      },
    };
    const { rows: wfRows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["wf", wfDef],
    );
    const workflowId = wfRows[0].id;
    const trigger = new CounterPollingTrigger(pool, flowProducer, workflowId);
    await trigger.poll();
    await new Promise((resolve) => {
      queueEvents.on("completed", () => resolve(null));
    });

    const { rows: stateRows } = await pool.query(
      "SELECT state FROM trigger_state WHERE workflow_id=$1",
      [workflowId],
    );
    expect(stateRows[0].state.count).toBe(1);
  });
});
