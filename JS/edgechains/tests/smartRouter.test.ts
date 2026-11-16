import { SmartRouter, ModelDeployment } from "../lib/router/SmartRouter";

describe("SmartRouter (#286)", () => {
    it("selects deployment below rate-limit with lowest tokens used across openai, palm, and cohere", () => {
        const deployments: ModelDeployment[] = [
            { id: "openai-1", provider: "openai", endpoint: "https://api.openai.com/v1/chat/completions", apiKey: "k1", model: "gpt-4o-mini", rpmLimit: 60, tpmLimit: 90000, currentTokensUsed: 4500 },
            { id: "palm-1", provider: "palm", endpoint: "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText", apiKey: "k2", model: "text-bison-001", rpmLimit: 60, tpmLimit: 90000, currentTokensUsed: 1200 },
            { id: "cohere-1", provider: "cohere", endpoint: "https://api.cohere.ai/v1/generate", apiKey: "k3", model: "command", rpmLimit: 60, tpmLimit: 90000, currentTokensUsed: 3100 },
        ];
        const router = new SmartRouter(deployments);
        const chosen = router.selectOptimalDeployment(200);
        expect(chosen.id).toBe("palm-1");
    });
});
