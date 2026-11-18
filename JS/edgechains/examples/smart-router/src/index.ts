import path from "path";
import { SmartRouter } from "@arakoodev/edgechains.js/ai";

async function main() {
    const configPath = path.join(process.cwd(), "jsonnet", "router.jsonnet");
    const router = SmartRouter.fromJsonnet(configPath, {
        sentry: {
            captureException: (err, ctx) => {
                console.error("[Sentry]", err?.message || err, ctx);
            },
        },
        posthog: {
            distinctId: "example-user",
            capture: (evt) => {
                console.log("[PostHog]", evt.event, evt.properties);
            },
        },
    });

    console.log("Loaded deployments:", router.getDeploymentStats());

    if (process.env.OPENAI_API_KEY || process.env.PALM_API_KEY || process.env.COHERE_API_KEY) {
        const response = await router.chat({
            prompt: "Explain load balancing in one sentence.",
        });
        console.log("Router Response:", response);
    }
}

main().catch(console.error);
