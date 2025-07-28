import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { newDb } from "pg-mem";
import { v4 as uuidv4 } from "uuid";
import { vi } from "vitest";
import { readFile } from "fs/promises";
import Redis from "ioredis";
import { runWorkflow } from "../lib/workflow";
let pool: any;
let flowProducer: any;
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

describe("merge workflow", () => {
  let queueEvents: any;
  let connection: any;

  beforeAll(async () => {
    const db = newDb();
    db.registerLanguage("plpgsql", () => {});
    db.public.registerFunction({
      name: "gen_random_uuid",
      returns: "text",
      implementation: uuidv4,
    });
    db.public.registerFunction({
      name: "are_fuzzy_equal",
      args: ["text", "text"],
      returns: "boolean",
      implementation: (v1: string, v2: string) => {
        const n1 = Number(v1);
        const n2 = Number(v2);
        if (!Number.isNaN(n1) && !Number.isNaN(n2)) return n1 === n2;
        return v1 === v2;
      },
    });
    db.public.registerFunction({
      name: "jsonb_deep_merge",
      args: ["jsonb", "jsonb"],
      returns: "jsonb",
      implementation: (a: any, b: any) => {
        const merge = (x: any, y: any): any => {
          if (typeof x !== "object" || typeof y !== "object") return y ?? x;
          const res: any = { ...x };
          for (const k of Object.keys(y)) {
            res[k] = k in res ? merge(res[k], y[k]) : y[k];
          }
          return res;
        };
        return merge(a, b);
      },
    });
    const pg = db.adapters.createPg();
    pool = new pg.Pool();

    // run migrations
    const migrations = ["001_init.sql", "002_runs_and_merge.sql"];
    for (const file of migrations) {
      const sql = await readFile(
        new URL(`../migrations/${file}`, import.meta.url),
        "utf8",
      );
      await pool.query(sql);
    }

    const { FlowProducer, QueueEvents } = await import("bullmq");
    connection = new Redis({ maxRetriesPerRequest: null });
    flowProducer = new FlowProducer({ connection });
    queueEvents = new QueueEvents("merge", { connection });
    await queueEvents.waitUntilReady();

    await import("../workers/merge");
  });

  afterAll(async () => {
    if (queueEvents) await queueEvents.close();
    if (flowProducer) await flowProducer.close();
    if (connection) await connection.quit();
  });

  afterEach(async () => {
    await pool.query("TRUNCATE workflows RESTART IDENTITY CASCADE");
    await pool.query("TRUNCATE workflow_runs RESTART IDENTITY CASCADE");
    await pool.query(
      "TRUNCATE workflow_merge_staging RESTART IDENTITY CASCADE",
    );
    await connection.flushall();
  });

  it("merges data from two branches", async () => {
    const wfDef = {
      root: "merge-root",
      nodes: {
        "merge-root": {
          name: "merge-root",
          queue: "merge",
          children: ["users", "scores"],
          data: { field2: "userId" },
        },
        users: {
          name: "users",
          queue: "merge",
          data: { parent_job_id: "merge-root" },
        },
        scores: {
          name: "scores",
          queue: "merge",
          data: { parent_job_id: "merge-root" },
        },
      },
    };
    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["merge", wfDef],
    );

    const { job } = await runWorkflow(rows[0].id);

    const result = await new Promise<any>((resolve, reject) => {
      queueEvents.on("completed", async ({ jobId, returnvalue }: any) => {
        if (jobId === job.id) {
          resolve(returnvalue);
        }
      });
      queueEvents.on("failed", ({ failedReason }: any) => reject(failedReason));
    });

    expect(result).toEqual([
      { id: 1, name: "Alice", score: 10, userId: 1 },
      { id: 2, name: "Bob", score: 20, userId: 2 },
    ]);
  });

  it("append mode concatenates items", async () => {
    const wfDef = {
      root: "merge-root",
      nodes: {
        "merge-root": {
          name: "merge-root",
          queue: "merge",
          children: ["a1", "a2"],
          data: { mode: "append", input1Name: "a1", input2Name: "a2" },
        },
        a1: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "a1",
            items: [{ x: 1 }, { x: 2 }],
          },
        },
        a2: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "a2",
            items: [{ y: 3 }, { y: 4 }],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["append", wfDef],
    );

    const { job } = await runWorkflow(rows[0].id);

    const result = await new Promise<any>((resolve, reject) => {
      queueEvents.on("completed", async ({ jobId, returnvalue }: any) => {
        if (jobId === job.id) {
          resolve(returnvalue);
        }
      });
      queueEvents.on("failed", ({ failedReason }: any) => reject(failedReason));
    });

    expect(result).toEqual([{ x: 1 }, { x: 2 }, { y: 3 }, { y: 4 }]);
  });

  it("combine by position merges by index", async () => {
    const wfDef = {
      root: "merge-root",
      nodes: {
        "merge-root": {
          name: "merge-root",
          queue: "merge",
          children: ["i1", "i2"],
          data: {
            mode: "position",
            input1Name: "i1",
            input2Name: "i2",
            deepMerge: true,
          },
        },
        i1: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "i1",
            items: [{ a: 1 }, { a: 2 }],
          },
        },
        i2: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "i2",
            items: [{ b: 10 }, { b: 20 }, { b: 30 }],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["position", wfDef],
    );

    const { job } = await runWorkflow(rows[0].id);

    const result = await new Promise<any>((resolve, reject) => {
      queueEvents.on("completed", async ({ jobId, returnvalue }: any) => {
        if (jobId === job.id) {
          resolve(returnvalue);
        }
      });
      queueEvents.on("failed", ({ failedReason }: any) => reject(failedReason));
    });

    expect(result).toEqual([{ a: 1, b: 10 }, { a: 2, b: 20 }, { b: 30 }]);
  });

  it("keepEverything join with fuzzy and deep merge", async () => {
    const wfDef = {
      root: "merge-root",
      nodes: {
        "merge-root": {
          name: "merge-root",
          queue: "merge",
          children: ["u", "s"],
          data: {
            mode: "match",
            joinType: "keepEverything",
            input1Name: "u",
            input2Name: "s",
            field1: "id",
            field2: "userId",
            fuzzyCompare: true,
            deepMerge: true,
          },
        },
        u: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "u",
            items: [
              { id: "1", meta: { a: 1 } },
              { id: "2", meta: { a: 2 } },
            ],
          },
        },
        s: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "s",
            items: [
              { userId: 1, meta: { b: 10 } },
              { userId: 3, meta: { b: 30 } },
            ],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["full", wfDef],
    );

    const { job } = await runWorkflow(rows[0].id);

    const result = await new Promise<any>((resolve, reject) => {
      queueEvents.on("completed", async ({ jobId, returnvalue }: any) => {
        if (jobId === job.id) {
          resolve(returnvalue);
        }
      });
      queueEvents.on("failed", ({ failedReason }: any) => reject(failedReason));
    });

    expect(result).toEqual([
      { id: "1", meta: { a: 1, b: 10 }, userId: 1 },
      { id: "2", meta: { a: 2 } },
      { userId: 3, meta: { b: 30 } },
    ]);
  });
});
