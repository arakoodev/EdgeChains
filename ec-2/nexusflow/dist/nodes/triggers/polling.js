import { runWorkflow } from "../../lib/workflow";
export class CounterPollingTrigger {
    constructor(pool, producer, workflowId) {
        this.pool = pool;
        this.producer = producer;
        this.workflowId = workflowId;
    }
    async poll() {
        const res = await this.pool.query("SELECT state FROM trigger_state WHERE workflow_id=$1", [this.workflowId]);
        const prev = res.rows[0]?.state?.count ?? 0;
        const count = prev + 1;
        await this.pool.query(`INSERT INTO trigger_state (workflow_id, state) VALUES ($1, $2)
       ON CONFLICT (workflow_id) DO UPDATE SET state = EXCLUDED.state`, [this.workflowId, { count }]);
        await runWorkflow(this.workflowId, { message: `count:${count}` }, this.pool, this.producer);
        return count;
    }
}
