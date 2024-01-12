import type { ArkRequest } from "@arakoodev/edgechains.js";
declare function hydeSearchAdaEmbedding(arkRequest: ArkRequest, apiKey: string, orgId: string): Promise<{
    wordEmbeddings: any;
    finalAnswer: any;
}>;
export { hydeSearchAdaEmbedding };
