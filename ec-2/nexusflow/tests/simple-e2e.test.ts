import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Pool } from "pg";
import { readFile } from "fs/promises";
import Redis from "ioredis";
import { runWorkflow } from "../lib/workflow";

let pool: Pool;
let flowProducer: any;

describe("simple end-to-end test", () => {
  let queueEvents: any;
  let connection: any;

  beforeAll(async () => {
    // Connect to real PostgreSQL (use DATABASE_URL if available, otherwise local Docker)
    pool = new Pool(
      process.env.DATABASE_URL ? {
        connectionString: process.env.DATABASE_URL
      } : {
        host: "localhost",
        port: 5432,
        database: "postgres",
        user: "postgres", 
        password: "postgres",
      }
    );

    // Run basic migrations
    const migrations = ["001_init.sql", "002_runs_and_merge.sql"];
    for (const file of migrations) {
      try {
        const sql = await readFile(
          new URL(`../migrations/${file}`, import.meta.url),
          "utf8",
        );
        await pool.query(sql);
      } catch (error: any) {
        if (!error.message.includes("already exists")) {
          throw error;
        }
      }
    }

    // Set up Redis and BullMQ
    const { FlowProducer, QueueEvents } = await import("bullmq");
    connection = new Redis({ maxRetriesPerRequest: null });
    flowProducer = new FlowProducer({ connection });
    queueEvents = new QueueEvents("merge", { connection });
    await queueEvents.waitUntilReady();

    // Start merge worker
    await import("../workers/merge");
  });

  afterAll(async () => {
    if (queueEvents) await queueEvents.close();
    if (flowProducer) await flowProducer.close();
    if (connection) await connection.quit();
    if (pool) await pool.end();
  });

  afterEach(async () => {
    await pool.query("TRUNCATE workflows RESTART IDENTITY CASCADE");
    await pool.query("TRUNCATE workflow_runs RESTART IDENTITY CASCADE");
    
    // Clean up Redis streams
    const keys = await connection.keys("wf:*");
    if (keys.length > 0) {
      await connection.del(...keys);
    }
  });

  it("runs simple append workflow", async () => {
    const wfDef = {
      root: "simple-test",
      nodes: {
        "simple-test": {
          name: "merge-root",
          queue: "merge",
          children: ["data-a", "data-b"],
          data: { mode: "append", input1Name: "a", input2Name: "b" },
        },
        "data-a": {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "simple-test",
            input_name: "a",
            items: [{ id: 1, type: "A" }],
          },
        },
        "data-b": {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "simple-test",
            input_name: "b",
            items: [{ id: 2, type: "B" }],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["simple-wf", wfDef],
    );

    const { runId, job } = await runWorkflow(rows[0].id, {}, pool, flowProducer);
    console.log("Started workflow with runId:", runId, "jobId:", job.id);

    // Wait a moment for child jobs to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check what streams exist
    const allKeys = await connection.keys("wf:*");
    console.log("Redis streams created:", allKeys);
    
    // Check streams content
    for (const key of allKeys) {
      const entries = await connection.xrange(key, "-", "+");
      console.log(`Stream ${key}:`, entries);
    }

    const result = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Simple test timeout")), 5000);
      
      queueEvents.on("completed", ({ jobId, returnvalue }: any) => {
        console.log("Job completed:", jobId, "result:", returnvalue);
        if (jobId === job.id) {
          clearTimeout(timeout);
          resolve(returnvalue);
        }
      });
      
      queueEvents.on("failed", ({ jobId, failedReason }: any) => {
        console.log("Job failed:", jobId, "reason:", failedReason);
        if (jobId === job.id) {
          clearTimeout(timeout);
          reject(failedReason);
        }
      });
    });

    expect(result).toEqual([{ id: 1, type: "A" }, { id: 2, type: "B" }]);
  }, 10000);
});