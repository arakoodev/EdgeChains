import { describe, it, expect, vi } from "vitest";

vi.mock("../lib/db", () => {
  class FakeClient {
    jobId: string | null = null;
    async query(text: string, values?: any[]) {
      if (text.startsWith("SET edgechains.job_id")) {
        this.jobId = values?.[0] ?? null;
        return { rows: [] };
      }
      if (text === "SELECT current_setting('edgechains.job_id', true)") {
        return { rows: [{ current_setting: this.jobId }] };
      }
      return { rows: [] };
    }
    release() {}
  }

  class FakePool {
    async connect() {
      return new FakeClient();
    }
  }

  const pool = new FakePool();
  return {
    get pool() {
      return pool;
    },
    async withJobClient(jobId: string, fn: (client: any) => Promise<any>) {
      const client = await pool.connect();
      try {
        await client.query("SET edgechains.job_id = $1", [jobId]);
        return await fn(client);
      } finally {
        client.release();
      }
    },
  };
});

import { withJobClient } from "../lib/db";

describe("withJobClient", () => {
  it("sets the job id session variable", async () => {
    const result = await withJobClient("job1", (client) =>
      client.query("SELECT current_setting('edgechains.job_id', true)")
    );
    expect(result.rows[0].current_setting).toBe("job1");
  });

  it("isolates job id per call", async () => {
    const r1 = await withJobClient("jobA", (client) =>
      client.query("SELECT current_setting('edgechains.job_id', true)")
    );
    const r2 = await withJobClient("jobB", (client) =>
      client.query("SELECT current_setting('edgechains.job_id', true)")
    );
    expect(r1.rows[0].current_setting).toBe("jobA");
    expect(r2.rows[0].current_setting).toBe("jobB");
  });
});
