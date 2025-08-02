import { Job } from "bullmq";
import { StreamAwareBullMQWorker, redisClient } from "./streamBase";

function inputStreamName(runId: string, parent: string, name: string) {
  return `wf:${runId}:${parent}:${name}`;
}

function deepMerge(a: any, b: any): any {
  if (typeof a !== "object" || a === null) return b ?? a;
  if (typeof b !== "object" || b === null) return b ?? a;
  const res: any = { ...a };
  for (const k of Object.keys(b)) {
    res[k] = k in res ? deepMerge(res[k], b[k]) : b[k];
  }
  return res;
}

function equal(v1: any, v2: any, fuzzy: boolean): boolean {
  if (!fuzzy) return v1 === v2;
  const n1 = Number(v1);
  const n2 = Number(v2);
  if (!Number.isNaN(n1) && !Number.isNaN(n2)) return n1 === n2;
  return String(v1) === String(v2);
}

async function readStream(stream: string): Promise<any[]> {
  const entries = await redisClient.xrange(stream, "-", "+");
  return entries.map(([, fields]) => {
    const item: Record<string, any> = {};
    for (let i = 0; i < fields.length; i += 2) {
      item[fields[i]] = JSON.parse(fields[i + 1]);
    }
    return item;
  });
}

function mergeByPosition(a: any[], b: any[], deep: boolean): any[] {
  const len = Math.max(a.length, b.length);
  const out: any[] = [];
  for (let i = 0; i < len; i++) {
    const item1 = a[i];
    const item2 = b[i];
    if (item1 === undefined) out.push(item2);
    else if (item2 === undefined) out.push(item1);
    else out.push(deep ? deepMerge(item1, item2) : { ...item1, ...item2 });
  }
  return out;
}

interface MatchOpts {
  joinType: string;
  field1: string;
  field2: string;
  fuzzy: boolean;
  deep: boolean;
}

function mergeByMatch(a: any[], b: any[], opts: MatchOpts): any[] {
  const usedB = new Set<number>();
  const res: any[] = [];
  for (let i = 0; i < a.length; i++) {
    const itemA = a[i];
    let matched = false;
    for (let j = 0; j < b.length; j++) {
      if (equal(itemA[opts.field1], b[j][opts.field2], opts.fuzzy)) {
        matched = true;
        usedB.add(j);
        const merged = opts.deep
          ? deepMerge(itemA, b[j])
          : { ...itemA, ...b[j] };
        res.push(merged);
      }
    }
    if (
      !matched &&
      (opts.joinType === "enrichInput1" || opts.joinType === "keepEverything")
    ) {
      res.push(itemA);
    }
  }
  if (opts.joinType === "enrichInput2" || opts.joinType === "keepEverything") {
    for (let j = 0; j < b.length; j++) {
      if (!usedB.has(j)) res.push(b[j]);
    }
  }
  return res;
}

class MergeWorker extends StreamAwareBullMQWorker {
  constructor() {
    super("merge", (job) => this.processor(job));
  }

  async processor(job: Job): Promise<any> {
    if (Array.isArray(job.data.items)) {
      const input = job.data.input_name ?? "input1";
      const stream = inputStreamName(
        job.data.workflow_run_id,
        job.data.parent_job_id,
        input,
      );
      for (const item of job.data.items) {
        await this.produce(stream, item);
      }
      return job.data.items;
    }

    if (job.name === "users") {
      const items = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];
      const stream = inputStreamName(
        job.data.workflow_run_id,
        job.data.parent_job_id,
        "input1",
      );
      for (const item of items) {
        await this.produce(stream, item);
      }
      return items;
    }

    if (job.name === "scores") {
      const items = [
        { userId: 1, score: 10 },
        { userId: 2, score: 20 },
      ];
      const stream = inputStreamName(
        job.data.workflow_run_id,
        job.data.parent_job_id,
        "input2",
      );
      for (const item of items) {
        await this.produce(stream, item);
      }
      return items;
    }

    if (job.name === "merge-root") {
      const {
        workflow_run_id,
        input1Name = "input1",
        input2Name = "input2",
        mode = "match",
        joinType = "keepMatches",
        field1 = "id",
        field2 = "id",
        fuzzyCompare = false,
        deepMerge = false,
      } = job.data;

      const stream1 = inputStreamName(workflow_run_id, job.name, input1Name);
      const stream2 = inputStreamName(workflow_run_id, job.name, input2Name);
      const input1 = await readStream(stream1);
      const input2 = await readStream(stream2);
      await redisClient.del(stream1);
      await redisClient.del(stream2);

      if (mode === "append") {
        return input1.concat(input2);
      }

      if (mode === "position") {
        return mergeByPosition(input1, input2, deepMerge);
      }

      return mergeByMatch(input1, input2, {
        joinType,
        field1,
        field2,
        fuzzy: fuzzyCompare,
        deep: deepMerge,
      });
    }

    return null;
  }
}

new MergeWorker();
