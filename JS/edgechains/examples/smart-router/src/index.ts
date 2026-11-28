import "dotenv/config";
import Jsonnet from "@arakoodev/jsonnet";
import {
    posthogCallback,
    sentryCallback,
    SmartRouter,
} from "@arakoodev/edgechains.js/ai";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonnet = new Jsonnet();
const config = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/router.jsonnet")),
);

const deployments = config.deployments.map((deployment) => ({
    ...deployment,
    apiKey: process.env.OPENAI_API_KEY || "",
}));

const router = new SmartRouter({ deployments });

router.addCallback(
    sentryCallback({
        captureException: (error, context) => {
            console.error("SmartRouter failure", error, context);
        },
    }),
);

router.addCallback(
    posthogCallback({
        capture: (event) => {
            console.log("SmartRouter event", event);
        },
    }),
);

const response = await router.chat({
    model: "gpt-4o",
    prompt: "Explain why smart routing improves LLM reliability in one sentence.",
    max_tokens: 100,
});

console.log(JSON.stringify(response, null, 2));
