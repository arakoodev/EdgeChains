import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Pool } from "pg";
import { readFile } from "fs/promises";
import Redis from "ioredis";
import { runWorkflow } from "../lib/workflow";

let pool: Pool;
let flowProducer: any;

describe("end-to-end workflow tests", () => {
  let queueEvents: any;
  let connection: any;
  let actionWorker: any;
  let mergeWorker: any;

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

    // Run all migrations on real PostgreSQL
    const migrations = [
      "001_init.sql",
      "002_runs_and_merge.sql", 
      "003_merge_functions.sql",
      "004_job_rls.sql", 
      "005_trigger_state.sql",
      "006_action_logs.sql"
    ];
    for (const file of migrations) {
      try {
        const sql = await readFile(
          new URL(`../migrations/${file}`, import.meta.url),
          "utf8",
        );
        await pool.query(sql);
      } catch (error: any) {
        // Skip if migration already exists
        if (!error.message.includes("already exists")) {
          throw error;
        }
      }
    }

    // Set up Redis and BullMQ
    const { FlowProducer, QueueEvents } = await import("bullmq");
    connection = new Redis({ maxRetriesPerRequest: null });
    flowProducer = new FlowProducer({ connection });
    
    // Listen to the merge queue since that's what our workflows use
    queueEvents = new QueueEvents("merge", { connection });
    await queueEvents.waitUntilReady();

    // Start workers
    const { startLogWorker } = await import("../nodes/actions/log");
    actionWorker = startLogWorker();
    await import("../workers/merge");
  });

  afterAll(async () => {
    if (actionWorker) await actionWorker.close();
    if (queueEvents) await queueEvents.close();
    if (flowProducer) await flowProducer.close();
    if (connection) await connection.quit();
    if (pool) await pool.end();
  });

  afterEach(async () => {
    await pool.query("TRUNCATE workflows RESTART IDENTITY CASCADE");
    await pool.query("TRUNCATE workflow_runs RESTART IDENTITY CASCADE");
    await pool.query("TRUNCATE action_logs RESTART IDENTITY CASCADE");
    await pool.query("TRUNCATE trigger_state RESTART IDENTITY CASCADE");
    
    // Clean up Redis streams
    const keys = await connection.keys("wf:*");
    if (keys.length > 0) {
      await connection.del(...keys);
    }
  });

  it("executes multi-stage data processing pipeline", async () => {
    // Complex workflow: fetch -> transform -> merge -> log
    const wfDef = {
      root: "pipeline-root",
      nodes: {
        "pipeline-root": {
          name: "merge-root",
          queue: "merge",
          children: ["fetch-users", "fetch-orders"],
          data: { 
            mode: "match",
            joinType: "enrichInput1",
            input1Name: "users",
            input2Name: "orders",
            field1: "userId",
            field2: "customerId",
            fuzzyCompare: false,
            deepMerge: true
          },
        },
        "fetch-users": {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "pipeline-root",
            input_name: "users",
            items: [
              { userId: 1, name: "Alice", email: "alice@example.com" },
              { userId: 2, name: "Bob", email: "bob@example.com" },
              { userId: 3, name: "Charlie", email: "charlie@example.com" }
            ],
          },
        },
        "fetch-orders": {
          name: "load", 
          queue: "merge",
          data: {
            parent_job_id: "pipeline-root",
            input_name: "orders",
            items: [
              { customerId: 1, orderId: 101, amount: 250.50, status: "shipped" },
              { customerId: 2, orderId: 102, amount: 99.99, status: "pending" },
              { customerId: 1, orderId: 103, amount: 175.00, status: "delivered" }
            ],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["data-pipeline", wfDef],
    );

    const { runId, job } = await runWorkflow(rows[0].id, {}, pool, flowProducer);

    const result = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Test timeout")), 10000);
      queueEvents.on("completed", async ({ jobId, returnvalue }: any) => {
        if (jobId === job.id) {
          clearTimeout(timeout);
          resolve(returnvalue);
        }
      });
      queueEvents.on("failed", ({ failedReason }: any) => {
        clearTimeout(timeout);
        reject(failedReason);
      });
    });

    // Verify enriched data structure
    expect(result).toHaveLength(3);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        userId: 1,
        name: "Alice", 
        email: "alice@example.com",
        customerId: 1,
        orderId: expect.any(Number),
        amount: expect.any(Number),
        status: expect.any(String)
      }),
      expect.objectContaining({
        userId: 2,
        name: "Bob",
        email: "bob@example.com", 
        customerId: 2
      }),
      expect.objectContaining({
        userId: 3,
        name: "Charlie",
        email: "charlie@example.com"
      })
    ]));

    // Verify workflow run was tracked
    const { rows: runRows } = await pool.query(
      "SELECT status FROM workflow_runs WHERE id = $1",
      [runId]
    );
    expect(runRows[0]).toBeDefined();
  }, 15000);

  it("handles concurrent workflow executions", async () => {
    const wfDef = {
      root: "concurrent-test",
      nodes: {
        "concurrent-test": {
          name: "merge-root",
          queue: "merge", 
          children: ["data-a", "data-b"],
          data: { mode: "append", input1Name: "a", input2Name: "b" },
        },
        "data-a": {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "concurrent-test",
            input_name: "a",
            items: [{ id: 1, type: "A" }, { id: 2, type: "A" }],
          },
        },
        "data-b": {
          name: "load",
          queue: "merge", 
          data: {
            parent_job_id: "concurrent-test",
            input_name: "b",
            items: [{ id: 3, type: "B" }, { id: 4, type: "B" }],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["concurrent-wf", wfDef],
    );
    const workflowId = rows[0].id;

    // Start multiple workflows concurrently
    const promises = Array.from({ length: 3 }, async (_, i) => {
      const { runId, job } = await runWorkflow(workflowId, { batchId: i }, pool, flowProducer);
      
      return new Promise<{ runId: string; result: any }>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Workflow ${i} timeout`)), 8000);
        queueEvents.on("completed", ({ jobId, returnvalue }: any) => {
          if (jobId === job.id) {
            clearTimeout(timeout);
            resolve({ runId, result: returnvalue });
          }
        });
        queueEvents.on("failed", ({ failedReason }: any) => {
          clearTimeout(timeout);
          reject(failedReason);
        });
      });
    });

    const results = await Promise.all(promises);
    
    // Verify all workflows completed successfully
    expect(results).toHaveLength(3);
    results.forEach(({ result }) => {
      expect(result).toEqual([
        { id: 1, type: "A" },
        { id: 2, type: "A" },
        { id: 3, type: "B" },
        { id: 4, type: "B" }
      ]);
    });

    // Verify all runs were tracked in database
    const { rows: runRows } = await pool.query(
      "SELECT COUNT(*) as count FROM workflow_runs WHERE workflow_id = $1",
      [workflowId]
    );
    expect(parseInt(runRows[0].count)).toBe(3);
  }, 20000);

  it("processes complex branching workflow with fan-out/fan-in", async () => {
    const wfDef = {
      root: "branch-root",
      nodes: {
        "branch-root": {
          name: "merge-root",
          queue: "merge",
          children: ["branch-left", "branch-right"], 
          data: { 
            mode: "position",
            input1Name: "left-results",
            input2Name: "right-results",
            deepMerge: true
          },
        },
        "branch-left": {
          name: "merge-root",
          queue: "merge",
          children: ["left-a", "left-b"],
          data: {
            parent_job_id: "branch-root",
            input_name: "left-results", 
            mode: "append",
            input1Name: "la",
            input2Name: "lb"
          },
        },
        "branch-right": {
          name: "merge-root", 
          queue: "merge",
          children: ["right-a", "right-b"],
          data: {
            parent_job_id: "branch-root",
            input_name: "right-results",
            mode: "append", 
            input1Name: "ra",
            input2Name: "rb"
          },
        },
        "left-a": {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "branch-left",
            input_name: "la",
            items: [{ step: "left-a", data: "processed" }],
          },
        },
        "left-b": {
          name: "load",
          queue: "merge", 
          data: {
            parent_job_id: "branch-left",
            input_name: "lb",
            items: [{ step: "left-b", data: "processed" }],
          },
        },
        "right-a": {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "branch-right", 
            input_name: "ra",
            items: [{ step: "right-a", data: "processed" }],
          },
        },
        "right-b": {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "branch-right",
            input_name: "rb", 
            items: [{ step: "right-b", data: "processed" }],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["branching-wf", wfDef],
    );

    const { runId, job } = await runWorkflow(rows[0].id, {}, pool, flowProducer);

    const result = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Branching test timeout")), 12000);
      queueEvents.on("completed", ({ jobId, returnvalue }: any) => {
        if (jobId === job.id) {
          clearTimeout(timeout);
          resolve(returnvalue);  
        }
      });
      queueEvents.on("failed", ({ failedReason }: any) => {
        clearTimeout(timeout);
        reject(failedReason);
      });
    });

    // Verify complex merge structure
    expect(result).toEqual([
      expect.objectContaining({
        step: expect.stringMatching(/left-[ab]/),
        data: "processed"
      }),
      expect.objectContaining({
        step: expect.stringMatching(/right-[ab]/), 
        data: "processed"
      })
    ]);

    // Verify workflow tracking
    const { rows: runRows } = await pool.query(
      "SELECT status FROM workflow_runs WHERE id = $1",
      [runId]
    );
    expect(runRows[0].status).toBe("running"); // May still be running due to async nature
  }, 18000);

  it("maintains data integrity across Redis streams and PostgreSQL", async () => {
    const wfDef = {
      root: "integrity-test",
      nodes: {
        "integrity-test": {
          name: "merge-root",
          queue: "merge",
          children: ["source1", "source2"],
          data: { 
            mode: "match",
            joinType: "keepEverything", 
            input1Name: "s1",
            input2Name: "s2",
            field1: "id",
            field2: "refId",
            fuzzyCompare: true,
            deepMerge: false
          },
        },
        "source1": {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "integrity-test",
            input_name: "s1", 
            items: [
              { id: "100", name: "Item 100", category: "A" },
              { id: "200", name: "Item 200", category: "B" },
              { id: "300", name: "Item 300", category: "C" }
            ],
          },
        },
        "source2": {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "integrity-test",
            input_name: "s2",
            items: [
              { refId: 100, price: 29.99, inStock: true },
              { refId: 250, price: 15.50, inStock: false },
              { refId: 300, price: 75.00, inStock: true }
            ],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id", 
      ["integrity-test", wfDef],
    );

    const { runId, job } = await runWorkflow(rows[0].id, {}, pool, flowProducer);

    const result = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Integrity test timeout")), 8000);
      queueEvents.on("completed", ({ jobId, returnvalue }: any) => {
        if (jobId === job.id) {
          clearTimeout(timeout);
          resolve(returnvalue);
        }
      });
      queueEvents.on("failed", ({ failedReason }: any) => {
        clearTimeout(timeout); 
        reject(failedReason);
      });
    });

    // Verify fuzzy matching worked correctly
    expect(result).toHaveLength(4); // keepEverything should include all items
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "100", refId: 100, price: 29.99 }),
      expect.objectContaining({ id: "200", category: "B" }), // no match
      expect.objectContaining({ id: "300", refId: 300, price: 75.00 }),
      expect.objectContaining({ refId: 250, inStock: false }) // no match
    ]));

    // Verify workflow state consistency in PostgreSQL
    const { rows: runRows } = await pool.query(
      "SELECT * FROM workflow_runs WHERE id = $1",
      [runId]
    );
    expect(runRows[0]).toMatchObject({
      id: runId,
      workflow_id: rows[0].id,
      status: "running"
    });

    // Verify Redis streams were cleaned up after processing
    const streamKeys = await connection.keys(`wf:${runId}:*`);
    expect(streamKeys).toHaveLength(0); // Streams should be deleted after merge
  }, 12000);
});