import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { withJobClient } from "../lib/db";

const connection = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);

async function stageItems(job: any, items: any[], input: string) {
  const { workflow_run_id, parent_job_id } = job.data;
  await withJobClient(workflow_run_id, async (client) => {
    await client.query("BEGIN");
    try {
      for (let i = 0; i < items.length; i++) {
        await client.query(
          "INSERT INTO workflow_merge_staging (workflow_run_id, parent_job_id, input_name, item_index, item_data) VALUES ($1,$2,$3,$4,$5)",
          [workflow_run_id, parent_job_id, input, i, items[i]],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  });
}

function buildMergeSelect(joinType: string, deepMerge: boolean): string {
  const mergeExpr = "jsonb_deep_merge(a.item_data, b.item_data)";

  switch (joinType) {
    case "keepEverything":
      return `CASE
        WHEN a.item_data IS NULL THEN b.item_data
        WHEN b.item_data IS NULL THEN a.item_data
        ELSE ${mergeExpr}
      END AS data`;
    case "enrichInput1":
      return `CASE
        WHEN b.item_data IS NULL THEN a.item_data
        ELSE ${mergeExpr}
      END AS data`;
    case "enrichInput2":
      return `CASE
        WHEN a.item_data IS NULL THEN b.item_data
        ELSE ${mergeExpr}
      END AS data`;
    default:
      return `${mergeExpr} AS data`;
  }
}

new Worker(
  "merge",
  async (job) => {
    // generic data loader
    if (Array.isArray(job.data.items)) {
      const input = job.data.input_name ?? "input1";
      await stageItems(job, job.data.items, input);
      return job.data.items;
    }

    // predefined demo data
    if (job.name === "users") {
      const items = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];
      await stageItems(job, items, "input1");
      return items;
    }

    if (job.name === "scores") {
      const items = [
        { userId: 1, score: 10 },
        { userId: 2, score: 20 },
      ];
      await stageItems(job, items, "input2");
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

      if (mode === "append") {
        return withJobClient(workflow_run_id, async (client) => {
          const { rows } = await client.query(
            `SELECT item_data FROM workflow_merge_staging
             WHERE workflow_run_id=$1 AND parent_job_id=$2
             ORDER BY input_name, item_index`,
            [workflow_run_id, job.name],
          );
          await client.query(
            "DELETE FROM workflow_merge_staging WHERE workflow_run_id=$1",
            [workflow_run_id],
          );
          return rows.map((r) => r.item_data);
        });
      }

      if (mode === "position") {
        return withJobClient(workflow_run_id, async (client) => {
          const { rows } = await client.query(
            `SELECT ${buildMergeSelect("keepEverything", deepMerge)}, COALESCE(a.item_index, b.item_index) AS idx
             FROM workflow_merge_staging a
             LEFT JOIN workflow_merge_staging b
               ON a.item_index = b.item_index
              AND a.input_name=$3 AND b.input_name=$4
            WHERE a.workflow_run_id=$1 AND a.parent_job_id=$2 AND a.input_name=$3
            UNION ALL
            SELECT ${buildMergeSelect("keepEverything", deepMerge)}, b.item_index AS idx
             FROM workflow_merge_staging a
             RIGHT JOIN workflow_merge_staging b
               ON a.item_index = b.item_index
              AND a.input_name=$3 AND b.input_name=$4
            WHERE b.workflow_run_id=$1 AND b.parent_job_id=$2 AND b.input_name=$4 AND a.item_index IS NULL
            ORDER BY idx`,
            [workflow_run_id, job.name, input1Name, input2Name],
          );
          await client.query(
            "DELETE FROM workflow_merge_staging WHERE workflow_run_id=$1",
            [workflow_run_id],
          );
          return rows.map((r) => r.data);
        });
      }

      // mode === 'match'
      const comparator = fuzzyCompare
        ? `are_fuzzy_equal(a.item_data->>'${field1}', b.item_data->>'${field2}')`
        : `a.item_data->>'${field1}' = b.item_data->>'${field2}'`;

      const joinKeyword =
        joinType === "keepEverything"
          ? "FULL JOIN"
          : joinType === "enrichInput1"
            ? "LEFT JOIN"
            : joinType === "enrichInput2"
              ? "RIGHT JOIN"
              : "INNER JOIN";

      const selectExpr = buildMergeSelect(joinType, deepMerge);

      return withJobClient(workflow_run_id, async (client) => {
        let rows;
        if (joinType === "keepEverything") {
          const res = await client.query(
            `SELECT ${selectExpr}, COALESCE(a.item_index, b.item_index) AS idx
             FROM workflow_merge_staging a
             LEFT JOIN workflow_merge_staging b
               ON ${comparator}
              AND b.workflow_run_id=$1 AND b.parent_job_id=$2
              AND a.input_name=$3 AND b.input_name=$4
             WHERE a.workflow_run_id=$1 AND a.parent_job_id=$2 AND a.input_name=$3
             UNION ALL
             SELECT ${selectExpr}, b.item_index AS idx
             FROM workflow_merge_staging a
             RIGHT JOIN workflow_merge_staging b
               ON ${comparator}
              AND a.workflow_run_id=$1 AND a.parent_job_id=$2
              AND a.input_name=$3 AND b.input_name=$4
             WHERE b.workflow_run_id=$1 AND b.parent_job_id=$2 AND b.input_name=$4 AND a.item_index IS NULL
             ORDER BY idx`,
            [workflow_run_id, job.name, input1Name, input2Name],
          );
          rows = res.rows;
        } else {
          const res = await client.query(
            `SELECT ${selectExpr}
             FROM workflow_merge_staging a
             ${joinKeyword} workflow_merge_staging b
               ON ${comparator}
              AND a.workflow_run_id=$1 AND b.workflow_run_id=$1
              AND a.parent_job_id=$2 AND b.parent_job_id=$2
              AND a.input_name=$3 AND b.input_name=$4
             ORDER BY COALESCE(a.item_index, b.item_index)`,
            [workflow_run_id, job.name, input1Name, input2Name],
          );
          rows = res.rows;
        }
        await client.query(
          "DELETE FROM workflow_merge_staging WHERE workflow_run_id=$1",
          [workflow_run_id],
        );
        return rows.map((r) => r.data);
      });
    }
  },
  { connection },
);
