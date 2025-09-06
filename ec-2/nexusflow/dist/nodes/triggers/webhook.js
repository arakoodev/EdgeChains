import { runWorkflow } from "../../lib/workflow";
export class SimpleWebhookTrigger {
    constructor(pool, producer, workflowId) {
        this.pool = pool;
        this.producer = producer;
        this.workflowId = workflowId;
    }
    async webhook(message) {
        const { runId } = await runWorkflow(this.workflowId, { message }, this.pool, this.producer);
        return runId;
    }
}
