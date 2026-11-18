import path from "path";
import { fileURLToPath } from "url";
import { SmartRouter } from "@arakoodev/edgechains.js/ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const configPath = path.resolve(__dirname, "../jsonnet/router.jsonnet");
    const router = SmartRouter.fromJsonnet(configPath, {
        posthog: {
            distinctId: "demo-user",
            apiKey: process.env.POSTHOG_API_KEY,
        },
    });

    console.log("SmartRouter initialized from router.jsonnet!");
    console.log("Configured Deployments:", router.getDeploymentStats());

    // 1. Regular Chat with automatic least-token load balancing and failover
    console.log("\n--- Sending Chat Request ---");
    const response = await router.chat({
        prompt: "Explain LiteLLM routing principles in 2 sentences.",
        metadata: { purpose: "demo" },
    });
    console.log("Chosen Deployment:", response.deploymentId);
    console.log("Provider / Model:", response.provider, "/", response.model);
    console.log("Response:", response.content);
    console.log("Token Usage:", response.usage);

    // 2. Streaming Chat via AsyncGenerator
    console.log("\n--- Streaming Chat Request ---");
    process.stdout.write("Stream: ");
    for await (const token of router.streamChat({
        prompt: "Count to 5 separated by spaces.",
    })) {
        process.stdout.write(token);
    }
    console.log("\n");

    console.log("Total tokens consumed across all deployments:", router.getTotalTokensUsed());
}

main().catch(console.error);
