/**
 * Cohere Adapter — thin re-export that uses CohereAI as the LLMProvider
 *
 * The CohereAI class already implements LLMProvider directly,
 * so this adapter is a convenience factory for the SmartRouter config flow.
 */

import { CohereAI, CohereAIConfig } from "../../cohere/cohere.js";
import { AxiosInstance } from "axios";

export interface CohereAdapterConfig {
    apiKey: string;
    axiosInstance?: AxiosInstance;
}

export function createCohereAdapter(config: CohereAdapterConfig): CohereAI {
    return new CohereAI({
        apiKey: config.apiKey,
        axiosInstance: config.axiosInstance,
    });
}

export { CohereAI as CohereAdapter } from "../../cohere/cohere.js";
