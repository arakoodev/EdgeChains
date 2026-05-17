import Retell from "retell-sdk";
import { AgentCreateParams, AgentResponse } from "retell-sdk/resources/agent.mjs";
import { LlmResponse, LlmCreateParams } from "retell-sdk/resources/llm.mjs";

declare module "retell-sdk/resources/llm.mjs" {
    interface LlmResponse {
        llm_websocket_url: string;
    }
}

export class RetellAI {
    retellClient: Retell;
    llm: LlmResponse | null;
    constructor(apiKey: string) {
        this.retellClient = new Retell({
            apiKey: apiKey,
        });
        this.llm = null;
    }

    async createAgent(
        body: AgentCreateParams,
        options?: Retell.RequestOptions
    ): Promise<AgentResponse> {
        const defaultParams = {
            voice_id: "11labs-Adrian",
            agent_name: "Ryan",
            llm_websocket_url: this?.llm?.llm_websocket_url,
        };
        const keys = Object.keys(defaultParams);
        for (let i = 0; i < keys.length; i++) {
            if (keys[i] in body) {
                delete defaultParams[keys[i]];
            }
        }
        const agent = await this.retellClient.agent.create({ ...defaultParams, ...body }, options);
        return agent;
    }
    async createLLM(data?: LlmCreateParams): Promise<LlmResponse> {
        const llm = await this.retellClient.llm.create(data || {});
        this.llm = llm;
        return llm;
    }

    async initiateWebCall(agent_id: string): Promise<string> {
        const webCallResponse = await this.retellClient.call.createWebCall({ agent_id });
        return webCallResponse.access_token;
    }
}
