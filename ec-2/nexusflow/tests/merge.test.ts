import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { newDb } from "pg-mem";
import { v4 as uuidv4 } from "uuid";
import { vi } from "vitest";
import { readFile } from "fs/promises";
import Redis from "ioredis";
import { canConnectRedis } from "./utils/redis";
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

// Fail if Redis is not available - no more skipping tests
const redisAvailable = await canConnectRedis();
if (!redisAvailable) {
  throw new Error("Redis is required for integration tests. Please ensure Redis is running or use the all-in-one container for testing.");
}

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

  it("enrichInput1 (left join) keeps unmatched left rows", async () => {
    const wfDef = {
      root: "merge-root",
      nodes: {
        "merge-root": {
          name: "merge-root",
          queue: "merge",
          children: ["left", "right"],
          data: {
            mode: "match",
            joinType: "enrichInput1",
            input1Name: "left",
            input2Name: "right",
            field1: "id",
            field2: "userId",
            fuzzyCompare: false,
            deepMerge: false,
          },
        },
        left: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "left",
            items: [
              { id: 1, a: 10 },
              { id: 2, a: 20 },
            ],
          },
        },
        right: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "right",
            items: [
              { userId: 1, b: 100 },
            ],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["left-join", wfDef],
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
      { id: 1, a: 10, userId: 1, b: 100 },
      { id: 2, a: 20 },
    ]);
  });

  it("enrichInput2 (right join) keeps unmatched right rows; fuzzy compare", async () => {
    const wfDef = {
      root: "merge-root",
      nodes: {
        "merge-root": {
          name: "merge-root",
          queue: "merge",
          children: ["left", "right"],
          data: {
            mode: "match",
            joinType: "enrichInput2",
            input1Name: "left",
            input2Name: "right",
            field1: "id",
            field2: "userId",
            fuzzyCompare: true,
            deepMerge: false,
          },
        },
        left: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "left",
            items: [
              { id: "3", a: 30 },
            ],
          },
        },
        right: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "right",
            items: [
              { userId: 2, b: 200 },
              { userId: 3, b: 300 },
            ],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["right-join", wfDef],
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

    // fuzzy compare causes "3" == 3 to match
    expect(result).toEqual([
      { id: "3", a: 30, userId: 3, b: 300 },
      { userId: 2, b: 200 },
    ]);
  });

  it("deep recursive merge (keepMatches)", async () => {
    const wfDef = {
      root: "merge-root",
      nodes: {
        "merge-root": {
          name: "merge-root",
          queue: "merge",
          children: ["l", "r"],
          data: {
            mode: "match",
            joinType: "keepMatches",
            input1Name: "l",
            input2Name: "r",
            field1: "id",
            field2: "userId",
            fuzzyCompare: true,
            deepMerge: true,
          },
        },
        l: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "l",
            items: [
              { id: 1, meta: { a: { x: 1 }, shared: { k1: true } } },
            ],
          },
        },
        r: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "r",
            items: [
              { userId: "1", meta: { a: { y: 2 }, shared: { k2: true } }, extra: 5 },
            ],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["deep-recursive", wfDef],
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
      { id: 1, userId: "1", extra: 5, meta: { a: { x: 1, y: 2 }, shared: { k1: true, k2: true } } },
    ]);
  });

  it("multiple matches fan-out produces multiple merged rows", async () => {
    const wfDef = {
      root: "merge-root",
      nodes: {
        "merge-root": {
          name: "merge-root",
          queue: "merge",
          children: ["l", "r"],
          data: {
            mode: "match",
            joinType: "keepMatches",
            input1Name: "l",
            input2Name: "r",
            field1: "id",
            field2: "userId",
            fuzzyCompare: false,
            deepMerge: false,
          },
        },
        l: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "l",
            items: [
              { id: 1, a: 10 },
            ],
          },
        },
        r: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "r",
            items: [
              { userId: 1, b: 100 },
              { userId: 1, b: 101 },
            ],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["multi-match", wfDef],
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
      { id: 1, a: 10, userId: 1, b: 100 },
      { id: 1, a: 10, userId: 1, b: 101 },
    ]);
  });

  it("keepMatches with no matches yields empty result", async () => {
    const wfDef = {
      root: "merge-root",
      nodes: {
        "merge-root": {
          name: "merge-root",
          queue: "merge",
          children: ["l", "r"],
          data: {
            mode: "match",
            joinType: "keepMatches",
            input1Name: "l",
            input2Name: "r",
            field1: "id",
            field2: "userId",
            fuzzyCompare: false,
            deepMerge: false,
          },
        },
        l: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "l",
            items: [ { id: 1 } ],
          },
        },
        r: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "r",
            items: [ { userId: 2 } ],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["keepmatches-none", wfDef],
    );

    const { job } = await runWorkflow(rows[0].id);

    const result = await new Promise<any>((resolve, reject) => {
      queueEvents.on("completed", async ({ jobId, returnvalue }: any) => {
        if (jobId === job.id) resolve(returnvalue);
      });
      queueEvents.on("failed", ({ failedReason }: any) => reject(failedReason));
    });

    expect(result).toEqual([]);
  });

  it("position mode where left longer than right (shallow)", async () => {
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
            deepMerge: false,
          },
        },
        i1: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "i1",
            items: [{ a: 1 }, { a: 2 }, { a: 3 }],
          },
        },
        i2: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "i2",
            items: [{ b: 10 }, { b: 20 }],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["position-left-longer", wfDef],
    );

    const { job } = await runWorkflow(rows[0].id);

    const result = await new Promise<any>((resolve, reject) => {
      queueEvents.on("completed", async ({ jobId, returnvalue }: any) => {
        if (jobId === job.id) resolve(returnvalue);
      });
      queueEvents.on("failed", ({ failedReason }: any) => reject(failedReason));
    });

    expect(result).toEqual([{ a: 1, b: 10 }, { a: 2, b: 20 }, { a: 3 }]);
  });

  it("keepMatches with fuzzy true, shallow merge", async () => {
    const wfDef = {
      root: "merge-root",
      nodes: {
        "merge-root": {
          name: "merge-root",
          queue: "merge",
          children: ["l", "r"],
          data: {
            mode: "match",
            joinType: "keepMatches",
            input1Name: "l",
            input2Name: "r",
            field1: "id",
            field2: "userId",
            fuzzyCompare: true,
            deepMerge: false,
          },
        },
        l: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "l",
            items: [ { id: "10", a: 1 } ],
          },
        },
        r: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "r",
            items: [ { userId: 10, b: 2 } ],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["keepmatches-fuzzy", wfDef],
    );

    const { job } = await runWorkflow(rows[0].id);

    const result = await new Promise<any>((resolve, reject) => {
      queueEvents.on("completed", async ({ jobId, returnvalue }: any) => {
        if (jobId === job.id) resolve(returnvalue);
      });
      queueEvents.on("failed", ({ failedReason }: any) => reject(failedReason));
    });

    expect(result).toEqual([{ id: "10", a: 1, userId: 10, b: 2 }]);
  });

  it("keepEverything without fuzzy, shallow merge (no matches)", async () => {
    const wfDef = {
      root: "merge-root",
      nodes: {
        "merge-root": {
          name: "merge-root",
          queue: "merge",
          children: ["l", "r"],
          data: {
            mode: "match",
            joinType: "keepEverything",
            input1Name: "l",
            input2Name: "r",
            field1: "id",
            field2: "userId",
            fuzzyCompare: false,
            deepMerge: false,
          },
        },
        l: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "l",
            items: [ { id: 1, a: 1 } ],
          },
        },
        r: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "r",
            items: [ { userId: "1", b: 2 } ],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["fulleverything-no-match", wfDef],
    );

    const { job } = await runWorkflow(rows[0].id);

    const result = await new Promise<any>((resolve, reject) => {
      queueEvents.on("completed", async ({ jobId, returnvalue }: any) => {
        if (jobId === job.id) resolve(returnvalue);
      });
      queueEvents.on("failed", ({ failedReason }: any) => reject(failedReason));
    });

    expect(result).toEqual([
      { id: 1, a: 1 },
      { userId: "1", b: 2 },
    ]);
  });

  it("enrichInput2 with no matches yields only right rows", async () => {
    const wfDef = {
      root: "merge-root",
      nodes: {
        "merge-root": {
          name: "merge-root",
          queue: "merge",
          children: ["l", "r"],
          data: {
            mode: "match",
            joinType: "enrichInput2",
            input1Name: "l",
            input2Name: "r",
            field1: "id",
            field2: "userId",
            fuzzyCompare: false,
            deepMerge: false,
          },
        },
        l: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "l",
            items: [ { id: 5, a: 1 } ],
          },
        },
        r: {
          name: "load",
          queue: "merge",
          data: {
            parent_job_id: "merge-root",
            input_name: "r",
            items: [ { userId: 6, b: 2 } ],
          },
        },
      },
    };

    const { rows } = await pool.query(
      "INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id",
      ["right-no-matches", wfDef],
    );

    const { job } = await runWorkflow(rows[0].id);

    const result = await new Promise<any>((resolve, reject) => {
      queueEvents.on("completed", async ({ jobId, returnvalue }: any) => {
        if (jobId === job.id) resolve(returnvalue);
      });
      queueEvents.on("failed", ({ failedReason }: any) => reject(failedReason));
    });

    expect(result).toEqual([
      { userId: 6, b: 2 },
    ]);
  });
});
