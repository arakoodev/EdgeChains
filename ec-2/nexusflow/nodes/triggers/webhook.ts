import { FlowProducer } from "bullmq";
import { Pool } from "pg";
import { runWorkflow } from "../../lib/workflow";

export class SimpleWebhookTrigger {
  constructor(
    private pool: Pool,
    private producer: FlowProducer,
    private workflowId: string,
  ) {}

  async webhook(message: string) {
    const { runId } = await runWorkflow(
      this.workflowId,
      { message },
      this.pool,
      this.producer,
    );
    return runId;
  }
}
