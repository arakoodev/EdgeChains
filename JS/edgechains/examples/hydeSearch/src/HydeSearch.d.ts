import type { ArkRequest } from "@arakoodev/edgechains.js";
import { Hono } from "hono";
declare const HydeSearchRouter: Hono<import("hono").Env, {}, "/">;
export interface HydeFragmentData {
    responses: Array<{
        rawText?: string;
        metadata?: string;
        filename?: string;
        titleMetadata?: string;
        documentDate?: string;
    }>;
    final_answer?: string;
}
declare function hydeSearchAdaEmbedding(
    arkRequest: ArkRequest,
    apiKey: string,
    orgId: string
): Promise<{
    wordEmbeddings: any;
    finalAnswer: any;
}>;
export { hydeSearchAdaEmbedding };
export { HydeSearchRouter };
